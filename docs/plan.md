# Conflux — Implementation Plan (POC)

How we get from approved requirements to the clickable stakeholder demo. This is the build companion to [requirements.md](./requirements.md) (what), [architecture.md](./architecture.md) (guardrails + decision log), and [status.md](./status.md) (where we are). Where this plan makes a call, it cites the guardrail (G#) or decision (D#) it honors; new decisions made while planning get logged in the architecture doc, not here.

## Progress

### Drafting progress (this document)

The plan itself is written in committed segments so a session can resume mid-draft. Remove this checklist once all segments land.

- [x] Segment 1 — skeleton: framing, progress tables, milestone summaries
- [x] Segment 2 — Prisma schema, part 1: the spine (Organization, User, Membership, Role, Client, Project, Task, ProjectTask)
- [ ] Segment 3 — Prisma schema, part 2: the activity (TimeEntry, Invoice, InvoiceLine, enums, FK rules)
- [ ] Segment 4 — shared foundations: folder layout, authz/org-scoping seams, money module, testing choice
- [ ] Segment 5 — milestone details M0–M5 incl. the first vertical slice
- [ ] Segment 6 — wrap-up: status.md refresh, changelog check

### Build progress (milestones)

Updated as milestones land; this is the table that persists build state across sessions.

| Milestone | Deliverable (one line)                                                                 | Status         |
| --------- | -------------------------------------------------------------------------------------- | -------------- |
| M0        | Scaffolded app boots: Next.js + TS + Prisma/SQLite + Tailwind/shadcn + Auth.js, schema migrated, seed runs | ⬜ Not started |
| M1        | First vertical slice: seeded login → create a client → list clients (proves G1/G3/G10 end-to-end) | ⬜ Not started |
| M2        | Projects & tasks: project CRUD with billing type/method, global task list, project↔task assignment | ⬜ Not started |
| M3        | Time tracking: live timer + manual entry, day + weekly views, single-timer policy       | ⬜ Not started |
| M4        | Invoicing lifecycle: draft from time / fixed fee / manual lines, grouping, finalize→snapshot, mark-as-paid | ⬜ Not started |
| M5        | Invoice output & demo polish: on-screen + PDF from one component (G9), branding, full demo seed + walkthrough | ⬜ Not started |

## Milestones at a glance

Each milestone ends **clickable** — the app demos something real at every stage, matching the POC's "convince a stakeholder" success metric. Seed data is not a separate milestone: each milestone extends the seed script with the data its screens need, so the demo database is always one `db seed` away.

- **M0 — Scaffold.** The full stack stood up empty: repo layout, Prisma schema migrated to SQLite, Auth.js wired to the seeded credentials, shadcn/ui installed, CI-ish scripts (`lint`, `test`, `format`) in place. Nothing user-visible beyond a shell page, but every later milestone builds on a known-good base.
- **M1 — First vertical slice.** Seeded login → create a client → list clients. Deliberately thin; its job is to prove the one-way-door seams (auth boundary G3, org-scoping G1, shared authz G10, ORM-only access G8) on one path before any breadth is built.
- **M2 — Projects & tasks.** Client detail grows projects (billing type + method, rates per D6); the global task list and per-project task assignment come alive. After this, everything time tracking needs exists.
- **M3 — Time tracking.** The core daily loop: live timer (open time entry per D5), manual entry, day view, weekly view, resume behavior per D12, date-only days per D11.
- **M4 — Invoicing lifecycle.** Draft invoices from unbilled time / fixed fee / manual lines with selectable grouping; finalize snapshots money + bill-to/from per G5; anti-double-bill links; mark-as-paid.
- **M5 — Invoice output & demo polish.** The stakeholder-facing finish: polished invoice styled once and rendered to both screen and PDF (G9, Playwright), org branding/logo, the complete demo seed, and a scripted walkthrough.

## Prisma schema — part 1: the spine

The tenancy + work structure: Organization, identity (User/Membership/Role), Client, Project, Task, and the Project↔Task assignment. Part 2 adds the activity records (TimeEntry, Invoice, InvoiceLine) and completes the relations marked `part 2` below.

### Schema-wide conventions (apply to both parts)

- **SQLite dialect limits (Prisma):** SQLite supports neither `enum`, `Json`, nor `Decimal` column types. So: semantic enums (billing type/method, invoice status, capability names, asset kind) are `String` columns constrained by TypeScript union types + validation in the data layer; role capabilities are child rows (`RoleCapability`), not a JSON blob; the tax rate is integer **basis points** (8.25% → 825). The Postgres switch (G8) can tighten these to native enums later — an additive migration.
- **Money** columns are integer minor units (G4) and carry a `Minor` suffix (`hourlyRateMinor`) so the unit is unmissable at every use site.
- **`organizationId` on every org-scoped row — including join/child tables** (G1). On joins/children it's deliberately denormalized (the licensed exception to G5): uniform tenancy filtering now, and Postgres **row-level security** later needs the column present on each table it guards. On entity tables it's a real FK; on join/child tables it's a plain indexed scalar (integrity already flows through the parents, and this keeps `Organization`'s relation list from bloating).
- **Archival** (G12): retire-able entities (Client, Project, Task) use `archivedAt DateTime?` — null means active, non-null timestamps the retirement; this is the schema form of the requirement docs' "status (active/archived)". The `Membership.active` and `ProjectTask.active` **switches** stay booleans per their docs — they're reversible toggles, not archivals.
- **Referential actions:** `Restrict` by default (G12); `Cascade` only where nothing financial can be lost — role/grant joins, and `ProjectTask → Project` (safe because any assignment with logged time is itself protected by the TimeEntry `Restrict` in part 2). Invoice-side actions land in part 2.
- **IDs** are UUIDs via `@default(uuid())` (G7); rows get `createdAt`/`updatedAt`, joins just `createdAt`.
- **Logo storage:** the logo lives in a small org-scoped `Asset` table (`kind = "logo"`), not as a `Bytes` column on `Organization` — the Organization row is read constantly (defaults, name) and shouldn't drag a blob along, and the NFR's asset abstraction gets exactly one table to point at S3-style storage later.

### Models

```prisma
datasource db {
  provider = "sqlite" // → "postgresql" at hosting time; a config change, not a rewrite (G8)
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Organization {
  id                      String   @id @default(uuid())
  name                    String
  fromDetails             String?  // free-text "from" block (address, email, phone) for invoice headers
  defaultCurrency         String   @default("USD") // ISO-4217; pre-fills new clients
  defaultTaxRateBps       Int      @default(0) // basis points: 8.25% = 825
  defaultPaymentTermsDays Int      @default(30)
  invoiceFooter           String?
  invoiceNumberPrefix     String   @default("INV-")
  invoiceNextNumber       Int      @default(1) // sequence value consumed at finalize
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  memberships Membership[]
  roles       Role[]
  clients     Client[]
  projects    Project[]
  tasks       Task[]
  assets      Asset[]
  // part 2 adds: timeEntries, invoices
}

model Asset {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  kind           String       // "logo" for now (TS union in code)
  mimeType       String
  data           Bytes
  createdAt      DateTime     @default(now())

  @@index([organizationId])
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  displayName  String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  memberships Membership[] // global identity: deliberately NO organizationId (G11)
}

model Membership {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Restrict)
  active         Boolean      @default(true) // seat switch: inactive ⇒ authn + authz both deny

  roles           MembershipRole[]
  clientsCreated  Client[]         @relation("ClientCreatedBy")
  projectsCreated Project[]        @relation("ProjectCreatedBy")
  tasksCreated    Task[]           @relation("TaskCreatedBy")
  // part 2 adds: timeEntries
  // later (additive): per-person billing rate, when the "per_person" method gets wired (D6)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([organizationId, userId])
  @@index([organizationId])
}

model Role {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  name           String

  capabilities RoleCapability[]
  memberships  MembershipRole[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([organizationId, name])
  @@index([organizationId])
}

model RoleCapability {
  roleId         String
  role           Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)
  organizationId String
  capability     String // e.g. "invoice.manage" — data, not enum, so roles stay editable (G2)

  @@id([roleId, capability])
  @@index([organizationId])
}

model MembershipRole {
  membershipId   String
  membership     Membership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  roleId         String
  role           Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  organizationId String
  createdAt      DateTime   @default(now())

  @@id([membershipId, roleId])
  @@index([organizationId])
}

model Client {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  name           String
  contactPerson  String?
  email          String?
  billingAddress String?      // free-text block, rendered as-is on invoices
  currency       String       // ISO-4217; set from org default at creation, then owned here — projects derive it, never re-store (G5)
  archivedAt     DateTime?
  createdById    String
  createdBy      Membership   @relation("ClientCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  projects Project[]
  // part 2 adds: invoices

  @@index([organizationId])
}

model Project {
  id                String       @id @default(uuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  clientId          String
  client            Client       @relation(fields: [clientId], references: [id], onDelete: Restrict)
  name              String
  billingType       String       // "hourly" | "fixed_fee" | "non_billable"
  billingMethod     String?      // when hourly: "per_project" | "per_task" | "per_person" | "flat" — all modeled, first two wired (D6)
  hourlyRateMinor   Int?         // when hourly + per_project (G4)
  fixedFeeMinor     Int?         // when fixed_fee
  fixedFeeInvoiceId String?      // anti-double-bill link, set at finalize — relation completed in part 2
  archivedAt        DateTime?
  createdById       String
  createdBy         Membership   @relation("ProjectCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  taskAssignments ProjectTask[]
  // part 2 adds: fixedFeeInvoice relation, manual-line InvoiceLine back-relation

  @@index([organizationId])
  @@index([clientId])
}

model Task {
  id              String       @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  name            String
  defaultBillable Boolean      @default(true)
  archivedAt      DateTime?    // retire from the org list; existing assignments/entries keep working (G12)
  createdById     String
  createdBy       Membership   @relation("TaskCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  assignments ProjectTask[]

  @@unique([organizationId, name])
  @@index([organizationId])
}

model ProjectTask {
  id              String   @id @default(uuid()) // own UUID because TimeEntry FKs target this row (part 2)
  organizationId  String
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade) // zero-hour joins only; TimeEntry Restrict blocks the rest
  taskId          String
  task            Task     @relation(fields: [taskId], references: [id], onDelete: Restrict)
  billable        Boolean  // initialized from task.defaultBillable at assignment, then owned per-assignment
  hourlyRateMinor Int?     // when project.billingMethod = "per_task"
  active          Boolean  @default(true) // drop from the picker without touching history (G12)
  createdAt       DateTime @default(now())

  // part 2 adds: timeEntries

  @@unique([projectId, taskId])
  @@index([organizationId])
}
```

## Prisma schema — part 2: the activity

_(To be drafted — segment 3.)_

## Shared foundations

_(To be drafted — segment 4.)_

## Milestone details

_(To be drafted — segment 5.)_
