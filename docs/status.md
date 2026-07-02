# Conflux — Project Status

The single source of "where we are and what's next," so any session can resume without relying on memory or chat history. **Update this at the end of every working session** (see the end-of-session ritual in `AGENTS.md`).

## Snapshot

- **Date:** 2026-07-02
- **Phase:** Building **M0 — Scaffold** on `feature/m0-scaffold` (see the segment checklist under "In progress").
- **Git:** `develop` holds requirements + the implementation plan (all merged). Working branch: `feature/m0-scaffold`.
- **App runnable?** Not yet — scaffold in progress.

## Done

- Working conventions established (`AGENTS.md`).
- Full requirements interview captured in `docs/requirements.md` — 6 sections + in/out scope summary.
- Architecture guardrails and decision log established (`docs/architecture.md`).
- This status/continuity file created.
- `AGENTS.md` conventions extended: one-way/two-way door test (design-check trigger C), decision-log upkeep rule, forward-compat working-style bullet. `.gitattributes` added to normalize line endings.
- Requirements split into an index (`docs/requirements.md`) + per-topic docs under `docs/requirements/` (data model, time tracking, invoicing, access-control, tech-and-nfr); cross-references in `architecture.md` updated.
- Requirements **gap review** completed across four passes (Tier-1 one-way doors, external pass A: rate.view/periods/date-only, pass B structural: Invoice entities/G12/grouping, pass C compliance/lifecycle: finalize snapshots/Membership.active/D12); decision log current through D12. All merged to `develop`.
- **Implementation plan written** (`docs/plan.md`): the full Prisma schema (15 models honoring D1–D14, with schema-wide conventions for SQLite's dialect limits), the shared foundations (feature-first layout, the `lib/` seams for auth/authz/scoping/money/dates/assets, Vitest), and milestones M0–M5, each with scope, a staged seed increment, and a demoable exit criterion.
- Planning fallout captured where it belongs: decisions **D13** (SQLite dialect strategy) and **D14** (org-id on join rows) logged in `architecture.md`; the **Invoice↔Project selection** entity added to `docs/requirements/data-model.md` (+ ER diagram).

## In progress

**M0 — Scaffold** on `feature/m0-scaffold`, built in committed segments (one green commit each) so any session can resume from the last tick. Details per segment live in `docs/plan.md` § M0.

- [x] **Seg 0** — branch + this checklist + status refresh
- [x] **Seg 1** — Next.js scaffold (TS, App Router, Tailwind, `src/`) + ESLint/Prettier + npm scripts
- [x] **Seg 2** — Prisma + SQLite: full 15-model schema, first migration, `db.ts` (Prisma 7: `prisma-client` generator + better-sqlite3 driver adapter)
- [x] **Seg 3** — Seed v0: org, admin User/Membership, three roles + capability rows (idempotent upserts; `npm run db:seed`)
- [ ] **Seg 4** — Auth.js v5 skeleton: Credentials + bcrypt; login works (unstyled)
- [ ] **Seg 5** — Vitest + shadcn/ui init + placeholder test; verify M0 exit criteria

## Next up (ordered)

1. **Finish M0** per the checklist above. Exit: dev server boots a shell page, migrate + seed run clean, tests green — then you review/merge `feature/m0-scaffold`.
2. **M1 — First vertical slice:** seeded login → create a client → list clients, proving G1/G2/G3/G10 end-to-end on one path.

## Open questions / deferred decisions

- Manager time visibility **policy** (own vs. only-managed-projects vs. all) is still open; the **mechanism** is settled — owner-scoped rows widened by `time.view.all` (see [access-control](requirements/access-control.md)). Moot while single-user.
- Production hosting target. Deferred, but a SaaS is inherently hosted (see `architecture.md`).
- Whether Admin is an orthogonal flag or a top role — intentionally left open because roles become customizable (see [access-control](requirements/access-control.md)).

## Doc map (where things live)

- `docs/requirements.md` — **index** of what we're building; links to the per-topic docs in `docs/requirements/` (data model, time tracking, invoicing, access-control, tech & NFR).
- `docs/plan.md` — **the build plan**: Prisma schema, shared foundations, milestones M0–M5 + build-progress table.
- `docs/architecture.md` — **guardrails + decisions**; read before changing the architecture.
- `docs/status.md` — **this file**; where we are and what's next.
- `AGENTS.md` — **how** we work (git flow, conventions, design checks).
