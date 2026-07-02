# Conflux — Project Status

The single source of "where we are and what's next," so any session can resume without relying on memory or chat history. **Update this at the end of every working session** (see the end-of-session ritual in `AGENTS.md`).

## Snapshot

- **Date:** 2026-07-02
- **Phase:** Building **M1 — First vertical slice** on `feature/m1-vertical-slice` (see the segment checklist under "In progress"). M0 merged.
- **Git:** `develop` holds requirements + plan + the M0 scaffold. Working branch: `feature/m1-vertical-slice`.
- **App runnable?** **Yes** — `npm run dev` boots the shell page; login with the seeded admin works (credentials in `README.md`).

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
- **M0 — Scaffold built** (2026-07-02, `feature/m0-scaffold`): Next.js 16 + TS + Tailwind v4 scaffold with Prettier/ESLint; the full 15-model Prisma schema migrated on SQLite (Prisma 7: `prisma-client` generator, better-sqlite3 driver adapter, `prisma.config.ts`); idempotent seed v0 (org, admin user, 3 roles / 17 capability rows); Auth.js v5 credentials login working end-to-end with a session-aware shell page; Vitest + `money.ts` formatter with first tests; shadcn/ui initialized (Base UI preset).

## In progress

**M1 — First vertical slice** on `feature/m1-vertical-slice`, built in committed segments (one green commit each) so any session can resume from the last tick. Details in `docs/plan.md` § M1.

- [x] **Seg 0** — branch + this checklist + status refresh
- [x] **Seg 1** — the seams under load: `scope.ts` (`scopedDb` extension), `authz.ts` grows `can()`/`requireCapability`, `auth.ts` grows `currentActor()`; authz + scope unit tests
- [x] **Seg 2** — route guard (`src/proxy.ts` — Next 16 renamed "middleware" to "proxy") redirects logged-out visitors to /login; login page styled (shadcn/ui)
- [x] **Seg 3** — app shell: guarded `(app)` route group (layout calls `requireActor()`), nav sidebar + sign-out, dashboard placeholder, `/clients` list reading through `scopedDb`
- [x] **Seg 4** — create-client dialog + capability-guarded server action (currency pre-filled from org default); seed v1 (two clients); first `src/features/` folder (clients) per the feature-first layout
- [ ] **Seg 5** — exit-criteria sweep + changelog + wrap-up

## Next up (ordered)

1. **Finish M1** per the checklist above. Exit: log in as the seeded admin, create a client, see it listed, log out and get redirected — with the authz/scoping tests green. Then you review/merge.
2. **M2 — Projects & tasks:** client detail page, project CRUD (billing type/method per D6), global task list, project↔task assignments; seed v2.

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
