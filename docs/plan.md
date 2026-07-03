# Conflux — Implementation Plan (POC)

How we get from approved requirements to the clickable stakeholder demo. This is the build companion to [requirements.md](./requirements.md) (what), [architecture.md](./architecture.md) (guardrails + decision log), and [status.md](./status.md) (where we are). Where this plan makes a call, it cites the guardrail (G#) or decision (D#) it honors; new decisions made while planning get logged in the architecture doc, not here.

## Progress

Updated as milestones land; this is the table that persists build state across sessions. (The plan document itself is complete — drafted 2026-07-01.)

| Milestone | Deliverable (one line) | Status |
| --- | --- | --- |
| M0 | Scaffolded app boots: Next.js + TS + Prisma/SQLite + Tailwind/shadcn + Auth.js, schema migrated, seed runs | ✅ Done (2026-07-02) |
| M1 | First vertical slice: seeded login → create a client → list clients (proves G1/G3/G10 end-to-end) | ✅ Done (2026-07-02) |
| M2 | Projects & tasks: project CRUD with billing type/method, global task list, project↔task assignment | ✅ Done (2026-07-02) |
| M3 | Time tracking: live timer + manual entry, day + weekly views, single-timer policy | ⬜ Not started |
| M4 | Invoicing lifecycle: draft from time / fixed fee / manual lines, grouping, finalize→snapshot, mark-as-paid | ⬜ Not started |
| M5 | Invoice output & demo polish: on-screen + PDF from one component (G9), branding, full demo seed + walkthrough | ⬜ Not started |

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

The records the demo actually produces: TimeEntry, Invoice, InvoiceLine, plus `InvoiceProject` — the draft's stored selection of which projects (time and/or fee) feed the invoice. The schema-wide conventions from part 1 apply. Part-2 specific notes:

- **Running timer = open entry (D5):** `startedAt` non-null means running; stop collapses the session into `durationSeconds` and clears it. The single-timer rule is **application policy** — deliberately no DB uniqueness constraint (G6). Resume-as-continue (D12) just re-opens the row: `durationSeconds` accumulates across sessions, `startedAt` times only the live one.
- **Date-only days (D11):** `TimeEntry.date` is a `String` `"YYYY-MM-DD"` from the user's local calendar — and invoice issue/due dates use the same convention. A welcome side effect: ISO date strings sort lexicographically in chronological order, so range queries and ordering just work. Postgres can tighten to native `DATE` later (D13 spirit).
- **Draft derives, finalize fills (G5):** on a draft, currency, totals, bill-to, and from/branding are **derived live** — so their Invoice columns are nullable and stay `NULL` until finalize snapshots them. A `NULL` snapshot column on a `draft` invoice is normal; on a `sent`/`paid` invoice it's a bug.
- **Quantity as integer millis:** SQLite has no `Decimal`, and floats are banned near money, so line quantity is `quantityMilli` — thousandths of a unit (12.5 h → `12500`; a manual line's "1" → `1000`). Same integer discipline as money, one convention for hours and counts.
- **Discount is two mutually exclusive columns** (`discountPercentBps` / `discountFlatMinor`) rather than a type+value pair — each column has exactly one unit, so a basis-point value can never be misread as minor units (G4's "unit unmissable" rule). App validation enforces at-most-one.
- **Referential actions:** everything financial is `Restrict` — including `TimeEntry → Invoice` and the invoice's logo `Asset` reference. `Cascade` only from Invoice down to its own lines and project-selection rows, which implements "deleting a draft removes just the draft and its manual lines" (only drafts are ever deletable, by app policy). Line order gets an explicit `position` — print order is part of the financial record.
- **Gapless invoice numbers:** finalize runs in one transaction that reads + increments `Organization.invoiceNextNumber` and writes the snapshot — the number is assigned nowhere else.

### Models

```prisma
model TimeEntry {
  id              String       @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  membershipId    String
  membership      Membership   @relation(fields: [membershipId], references: [id], onDelete: Restrict)
  projectTaskId   String
  projectTask     ProjectTask  @relation(fields: [projectTaskId], references: [id], onDelete: Restrict)
  date            String       // "YYYY-MM-DD", user-local calendar day (D11); timer spanning midnight keeps its start day
  durationSeconds Int          @default(0) // closed sessions' total; a running entry adds live elapsed from startedAt at display
  note            String?
  startedAt       DateTime?    // non-null = running (D5); timer plumbing only, not an audit record
  invoiceId       String?      // set at finalize = billed, immutable thereafter (anti-double-bill)
  invoice         Invoice?     @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([organizationId])
  @@index([membershipId, date]) // day + week views: my entries for a date range
  @@index([projectTaskId])
  @@index([invoiceId]) // unbilled pool: invoiceId IS NULL
}

model Invoice {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  clientId       String
  client         Client       @relation(fields: [clientId], references: [id], onDelete: Restrict)
  status         String       @default("draft") // "draft" | "sent" | "paid"
  number         String?      // assigned at finalize from org prefix + sequence; never on drafts

  // draft choices (stored from the start, editable while draft)
  grouping           String  @default("task") // "task" | "person" | "summary" | "detailed"
  showDate           Boolean @default(false)  // optional line-item detail toggles
  showPerson         Boolean @default(false)
  showTask           Boolean @default(false)
  showNote           Boolean @default(false)
  issueDate          String? // "YYYY-MM-DD"
  dueDate            String? // null on draft = derive issueDate + terms at display; resolved + frozen at finalize (user-overridable)
  paymentTermsDays   Int     // pre-filled from org default at creation, then owned here
  poNumber           String?
  discountPercentBps Int?    // XOR discountFlatMinor (app-validated)
  discountFlatMinor  Int?
  taxRateBps         Int?    // single tax, applied after discount; pre-filled from org default
  footer             String? // pre-filled from org default

  // snapshot columns — NULL until finalize (draft derives these live, G5)
  currency      String?
  subtotalMinor Int?
  discountMinor Int?
  taxMinor      Int?
  totalMinor    Int?
  billToName    String?
  billToContact String?
  billToAddress String?
  fromName      String?
  fromDetails   String?
  logoAssetId   String? // logo by reference
  logoAsset     Asset?  @relation("InvoiceLogo", fields: [logoAssetId], references: [id], onDelete: Restrict)

  lines             InvoiceLine[]
  projectSelections InvoiceProject[]
  billedTimeEntries TimeEntry[]
  billedFixedFees   Project[]        @relation("ProjectFixedFeeInvoice") // completes Project.fixedFeeInvoiceId from part 1

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([organizationId, number]) // SQLite + Postgres both allow many NULLs here, so drafts don't collide
  @@index([organizationId])
  @@index([clientId])
}

model InvoiceProject {
  invoiceId       String
  invoice         Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  projectId       String
  project         Project @relation(fields: [projectId], references: [id], onDelete: Restrict)
  organizationId  String
  includeTime     Boolean @default(true)  // pull this project's unbilled billable time
  includeFixedFee Boolean @default(false) // include this project's flat fee as a line
  createdAt       DateTime @default(now())

  @@id([invoiceId, projectId])
  @@index([organizationId])
}

model InvoiceLine {
  id             String   @id @default(uuid())
  organizationId String
  invoiceId      String
  invoice        Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade) // only drafts are deletable; takes manual lines with it
  source         String   // "time" | "fixed_fee" | "manual" — time + fee lines written only at finalize; manual lines exist from the draft
  description    String
  quantityMilli  Int      // thousandths of a unit: hours for time lines (12.5h = 12500), count for fee/manual (1 = 1000)
  unitRateMinor  Int
  amountMinor    Int      // per-line, half-up (D9); subtotal = sum of these
  projectId      String?  // manual lines: optional project attribution, captured at entry (can't backfill a finalized invoice)
  project        Project? @relation(fields: [projectId], references: [id], onDelete: Restrict)
  position       Int      @default(0) // print order is part of the financial record
  createdAt      DateTime @default(now())

  @@index([organizationId])
  @@index([invoiceId])
  @@index([projectId])
}
```

Part 1's `part 2` placeholders resolve as: `Organization` gains `timeEntries TimeEntry[]` + `invoices Invoice[]`, `Membership` gains `timeEntries TimeEntry[]`, `Client` gains `invoices Invoice[]`, `Asset` gains `invoiceLogos Invoice[] @relation("InvoiceLogo")`, `Project` gains `fixedFeeInvoice Invoice? @relation("ProjectFixedFeeInvoice", ...)` on its part-1 `fixedFeeInvoiceId` plus `invoiceSelections InvoiceProject[]` and `manualLines InvoiceLine[]`, and `ProjectTask` gains `timeEntries TimeEntry[]`.

## Shared foundations

The seams every feature builds on. These exist from M0/M1 so features inherit the guardrails by construction (G10) instead of re-implementing them — the whole point is that adding a feature later touches its own folder plus nothing.

### Folder layout (feature-first)

```
prisma/
  schema.prisma          # the schema above
  seed.ts                # demo seed; grows with every milestone
src/
  app/                   # Next.js App Router: thin route files that call into features
    (auth)/login/        # public segment
    (app)/               # authenticated segment: clients/ projects/ time/ invoices/ settings/
  features/              # one folder per feature: its components + server actions + queries
    clients/  projects/  tasks/  time/  invoices/  org/
  lib/                   # the shared seams (below) — the only code features may not duplicate
  components/            # cross-feature UI; shadcn/ui primitives live here
```

Routes stay thin (parse params, call the feature, render); logic lives in the feature folder; anything two features need graduates to `lib/`. In LabVIEW terms: `lib/` is the shared subVI library, features are self-contained modules wired to it.

### The seams in `lib/` (one file each)

- **`db.ts` — Prisma client singleton (G8).** The only file that instantiates Prisma; everything imports from here, no raw SQL anywhere.
- **`scope.ts` — org scoping (G1, G10).** A `scopedDb(organizationId)` built as a **Prisma client extension** that injects `where: { organizationId }` into every query/mutation on org-scoped models automatically. Feature code never touches the bare client — the tenant filter can't be forgotten, only bypassed on purpose (which review catches). This one helper is what makes G1 "habitual from day one".
- **`authz.ts` — capabilities (G2, G10).** The `Capability` TS union + `CAPABILITIES` const (the ten from [access-control](./requirements/access-control.md)), and `can(actor, capability)` computing the union over the membership's roles. `requireCapability(...)` is the server-action guard: throws → error UI. Checks deny an **inactive membership** outright. Business code never mentions role names.
- **`auth.ts` — the auth boundary (G3).** Auth.js (v5) with the Credentials provider verifying against `User.passwordHash` (bcrypt). `currentActor()` resolves session → User → active Membership (+ org, + capability union) — the one object server code asks for "who is calling"; the POC's single membership is picked automatically, so a later org-switcher slots in here without touching callers.
- **`money.ts` — integer money (G4, D9).** `mulRateByHours`, the invoice pipeline (`lineAmount` → subtotal-as-sum-of-rounded-lines → discount → tax → total, each step **per-line half-up**), and the **single** `formatMoney(amountMinor, currency)` built on `Intl.NumberFormat` with a currency-exponent map (defaulting 2) — no hardcoded `÷100` anywhere. Pure functions, no I/O: the most unit-testable code in the app.
- **`dates.ts` — date-only days (D11).** Make/parse/compare `"YYYY-MM-DD"` in the **user's local calendar**, week-window math for the timesheet views, and "is this date in the future?" for the warn-and-acknowledge rule. No `Date`-at-UTC-midnight anti-patterns escape this file.
- **`assets.ts` — asset abstraction (NFR).** `getAsset`/`putAsset` over the `Asset` table now; the S3-style swap later replaces this file's internals only.

### Testing: Vitest

**Vitest** for unit tests — TS-native with zero transpile ceremony, Jest-compatible API, and the default in the Next.js ecosystem the stack already sits in. Per the NFR, coverage is deliberately narrow but non-negotiable where correctness is costly:

- `money.ts` — the rounding pipeline (odd rates, 8.25% tax, discount-then-tax ordering, lines-sum-to-total invariant).
- `dates.ts` — local-calendar day, midnight-spanning timer keeps its start day, week windows.
- `authz.ts` — capability union across multiple roles, inactive-membership denial.
- `scope.ts` — the extension injects the org filter on every verb (the tenant-isolation habit, tested once, trusted everywhere).

E2E/browser automation is **out** for the POC — the demo walkthrough itself is the manual E2E. Prettier (with `proseWrap: "never"` for Markdown) and ESLint arrive with the M0 scaffold, giving `AGENTS.md`'s `npm run format:md` / `lint:md` their real targets.

## Milestone details

Milestones are strictly sequential — each builds on the previous one's seams and seed data. Working rhythm per milestone: one or more `feature/` branches off `develop`, changelog entries for user-facing changes as they land, and the build-progress table above updated when the milestone's exit criteria pass.

### M0 — Scaffold

Everything stood up empty, so every later milestone starts from a known-good base.

- `create-next-app` (TypeScript, App Router, Tailwind, `src/` layout) + shadcn/ui init.
- Prisma + SQLite: the full schema above, first migration, `db.ts` singleton (G8).
- Auth.js v5 skeleton wired (Credentials provider, session plumbing) — login works against the seeded user even if the page is unstyled.
- Vitest, ESLint, Prettier (`proseWrap: "never"`) with scripts: `dev` / `build` / `test` / `lint` / `format` / `format:md` / `lint:md`.
- Seed v0: one Organization (with invoice defaults), the Admin User + Membership, the three seed roles with their capability rows, Admin granted to the seeded member.
- **Exit:** `npm run dev` boots a shell page; `prisma migrate dev` and the seed run clean; `npm test` green (a placeholder money test proves the harness).

### M1 — First vertical slice: seeded login → create a client → list clients

Deliberately thin; its whole job is to prove the one-way-door seams end-to-end on one path before any breadth exists. After M1, every further feature is "more of the same," not "first time through."

1. **Login/logout** — styled Credentials form → Auth.js session; middleware guards the `(app)` segment; logged-out access redirects to login (G3 exercised).
2. **The seams under load** — `currentActor()` resolves the seeded membership; the clients page (server component) reads through `scopedDb` (G1); the "New client" server action is guarded by `requireCapability("client.manage")` (G2/G10) and pre-fills currency from the org default.
3. **UI floor** — client list table + create dialog in shadcn/ui, plus the app shell (nav sidebar). The "looks professional" bar starts being enforced here.
4. **Tests land with their code** — `authz.ts` (union, inactive-member denial) and `scope.ts` (filter injected on every verb) unit tests.

- Seed v1: two sample clients with invoice-ready details.
- **Exit:** log in as the seeded admin, create a client, see it listed, log out and get redirected — with the authz/scoping tests green.

### M2 — Projects & tasks

The client detail page grows the work structure; after M2, everything time tracking needs exists.

- Clients: detail page, edit, archive (`archivedAt`; archived drop out of pickers but keep history — G12).
- Projects: CRUD under a client; billing-type selector; per-type fields (hourly → method + rate per D6, fixed fee → amount); archive. Per-person/flat stay visible in the selector but disabled ("modeled, not wired").
- Tasks: the org-wide list (name, default-billable, archive); project↔task assignment editor with per-assignment billable override, per-task rate (when the method is per-task), and the `active` retire toggle.
- Rates render through the shared read layer so `rate.view` field-stripping stays a later addition, not a refactor (G10).
- Seed v2: projects covering all three billing types and both wired methods; the global task list; assignments with mixed billable/rates.
- **Exit:** a real client → project → assigned-tasks structure can be built entirely in the UI.

### M3 — Time tracking

The daily-use loop, and the first half of the demo story.

- **Day view** (default): one date's entries as an editable list; prev/next/today; manual entry via a project→task picker (active assignments only), decimal-hours duration, note, date — future dates warn-and-acknowledge.
- **Live timer:** start fresh or from an existing entry; starting one stops the running one (app-layer policy, G6/D5); elapsed ticks live (`durationSeconds` + now−`startedAt`); stop collapses the session into the stored duration. Resume offers **new pre-filled entry (encouraged)** or **continue the original** (accumulates, keeps the original's day — D12).
- **Weekly grid:** projects×days cells for review and bulk entry.
- Billability is displayed as derived from the assignment — no per-entry flag anywhere in the UI.
- Tests: `dates.ts` (local-calendar day, midnight-spanning timer keeps its start day, week windows).
- Seed v3: a working week of entries across projects (including today, so the day view and timer demo aren't empty).
- **Exit:** track a real day live and retroactively; both timesheet views browsable; exactly one timer can run.

### M4 — Invoicing lifecycle

Tracked work becomes money — draft → finalize → paid, with the anti-double-bill links doing their job.

- **New invoice:** pick the client, select which projects feed it (time and/or fixed fee → `InvoiceProject` rows) → draft.
- **Draft editor:** time lines derived live from the unbilled pool (`invoiceId IS NULL`, billable only) per the chosen grouping (task / person-split-by-rate / summary / detailed) + detail toggles; manual lines with optional project attribution; discount (percent XOR flat), tax, PO, issue/due dates (due derived from terms until overridden), footer; totals through the `money.ts` pipeline only.
- **Finalize (one transaction):** assign number (org prefix + counter, increment — gapless), snapshot lines/totals/currency/bill-to/from-branding (logo by reference), link the billed time entries and any fixed fees. Finalized = immutable; no void/credit path in the POC (known deferral). Draft deletion stays allowed (cascade cleans lines + selections).
- **Sent / paid:** manual status transitions.
- Tests: the pipeline against real grouping scenarios (odd rates, 8.25% tax, discount-then-tax, person-split-by-rate, lines-sum-to-total); finalize's gapless numbering.
- Seed v4: one finalized invoice (so history exists) and one open draft.
- **Exit:** full draft→finalize→paid walkthrough in the UI; a finalized entry can't be pulled into a second invoice.

### M5 — Invoice output & demo polish

The stakeholder-facing finish — this milestone is the demo.

- **Invoice document:** one styled component renders both the on-screen view and the PDF (G9) — Playwright's headless Chromium prints the same route to PDF for download. Print CSS tuned so the PDF looks like a real invoice, not a webpage.
- **Org settings page:** business name, "from" block, logo upload (→ `Asset`), currency/tax/terms defaults, default time display format (H:MM vs decimal hours — requested 2026-07-02; the seam is `features/time/duration.ts`), invoice prefix + next number, footer — the branding that finalize snapshots.
- **Polish pass over the demo path only:** consistent theming, empty states, loading/error states, a simple landing/dashboard after login. Polish over robustness, per the requirements' guiding principle.
- **Demo assets:** the full seed (everything above, plus enough variety that every screen shows real data) and `docs/demo.md` — the scripted walkthrough: login → timesheet → live timer → client/project tour → draft invoice → finalize → PDF.
- **Exit:** the complete stakeholder demo runs from seed in one sitting, ending with a professional PDF in hand.
