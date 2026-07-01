# Conflux — Project Status

The single source of "where we are and what's next," so any session can resume without relying on memory or chat history. **Update this at the end of every working session** (see the end-of-session ritual in `AGENTS.md`).

## Snapshot

- **Date:** 2026-07-01
- **Phase:** Requirements + four gap-review passes complete (reviewer concurs — no further gaps); cleared to write the implementation plan. No app code yet.
- **Git:** `develop` holds the merged first gap review; the three external-review passes sit on `feature/reviewer-gap-pass` (12 commits) pending your merge.
- **App runnable?** No — nothing scaffolded yet.

## Done

- Working conventions established (`AGENTS.md`).
- Full requirements interview captured in `docs/requirements.md` — 6 sections + in/out scope summary.
- Architecture guardrails and decision log established (`docs/architecture.md`).
- This status/continuity file created.
- `AGENTS.md` conventions extended: one-way/two-way door test (design-check trigger C), decision-log upkeep rule, forward-compat working-style bullet. `.gitattributes` added to normalize line endings.
- Requirements split into an index (`docs/requirements.md`) + per-topic docs under `docs/requirements/` (data model, time tracking, invoicing, access-control, tech-and-nfr); cross-references in `architecture.md` updated.
- Requirements **gap review** completed: Tier-1 one-way doors resolved via interview (identity/membership split, multi-role union, org-shared ownership, Organization fields, currency + rounding) and Tier-2/3 clarifications folded into the requirements docs; decision log updated (D7–D10, G4 refresh, new G11).
- **Second gap pass** (external review) resolved: defer field-level rate stripping (record `rate.view` capability + G2/G10 seam), plan period-based invoice selection (month/quarter/custom, not built), and store time-entry dates as date-only/browser-local (decision D11).
- **Structural gap pass** (external, DB-focused) resolved: added Invoice/InvoiceLine + Time Entry to the data model and ER diagram with billed-link FKs; deletion/archive guardrail G12 (`Restrict`, archive-don't-delete) + `ProjectTask.active`; By-Person invoice grouping splits per rate; optional Harvest-style line-item detail (date/person/task/note); future-dated entries warn-and-acknowledge.
- **Compliance/lifecycle gap pass** (external, Pass 3) resolved: snapshot bill-to + from/branding onto the invoice at finalize; `Membership.active` gating access; optional `project_id` on manual invoice lines; user-overridable invoice due date; resume-timer behavior — encourage new entry, offer same-entry continue (decision D12).

## In progress

- `develop` holds the merged first gap review (Tier-1/2/3). The external-review follow-ups sit on `feature/reviewer-gap-pass` (unmerged, ready for your review/merge): pass A — `rate.view` seam, deferred invoice period-selection, date-only entry dates; pass B (structural) — Invoice/InvoiceLine entities + billed-link FKs, archive-not-delete guardrail G12 + `ProjectTask.active`, By-Person split-per-rate, optional line-item detail, future-date warn-and-acknowledge; pass C (compliance/lifecycle) — finalize snapshots bill-to/branding, `Membership.active`, manual-line `project_id`, due-date override, resume-timer behavior (D12).

## Next up (ordered)

1. **Implementation plan** (`docs/plan.md`): the Prisma schema (entities from the [data model](requirements/data-model.md) — Organization, User/Membership/Role, Client, Project, Task, assignment, Time Entry, Invoice — honoring decisions D7–D10), a milestone breakdown, and the first vertical slice to build. Include the required Progress table.
2. **Scaffold the app:** Next.js + TypeScript + Prisma (SQLite) + Tailwind/shadcn + Auth.js, with the shared authz + org-scoping helpers (guardrails G10) stubbed in from the start.
3. **First vertical slice:** seeded login → create a client → list clients. Proves the auth boundary, org-scoping, and the data layer end-to-end on one thin path.

## Open questions / deferred decisions

- Manager time visibility **policy** (own vs. only-managed-projects vs. all) is still open; the **mechanism** is settled — owner-scoped rows widened by `time.view.all` (see [access-control](requirements/access-control.md)). Moot while single-user.
- Production hosting target. Deferred, but a SaaS is inherently hosted (see `architecture.md`).
- Whether Admin is an orthogonal flag or a top role — intentionally left open because roles become customizable (see [access-control](requirements/access-control.md)).

## Doc map (where things live)

- `docs/requirements.md` — **index** of what we're building; links to the per-topic docs in `docs/requirements/` (data model, time tracking, invoicing, access-control, tech & NFR).
- `docs/architecture.md` — **guardrails + decisions**; read before changing the architecture.
- `docs/status.md` — **this file**; where we are and what's next.
- `AGENTS.md` — **how** we work (git flow, conventions, design checks).
