# Conflux — Implementation Plan (POC)

How we get from approved requirements to the clickable stakeholder demo. This is the build companion to [requirements.md](./requirements.md) (what), [architecture.md](./architecture.md) (guardrails + decision log), and [status.md](./status.md) (where we are). Where this plan makes a call, it cites the guardrail (G#) or decision (D#) it honors; new decisions made while planning get logged in the architecture doc, not here.

## Progress

### Drafting progress (this document)

The plan itself is written in committed segments so a session can resume mid-draft. Remove this checklist once all segments land.

- [x] Segment 1 — skeleton: framing, progress tables, milestone summaries
- [ ] Segment 2 — Prisma schema, part 1: the spine (Organization, User, Membership, Role, Client, Project, Task, ProjectTask)
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

_(To be drafted — segment 2.)_

## Prisma schema — part 2: the activity

_(To be drafted — segment 3.)_

## Shared foundations

_(To be drafted — segment 4.)_

## Milestone details

_(To be drafted — segment 5.)_
