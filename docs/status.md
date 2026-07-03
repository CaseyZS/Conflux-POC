# Conflux — Project Status

The single source of "where we are and what's next," so any session can resume without relying on memory or chat history. **Update this at the end of every working session** (see the end-of-session ritual in `AGENTS.md`).

## Snapshot

- **Date:** 2026-07-02
- **Phase:** **M3 — Time tracking** in progress on `feature/m3-time-tracking` (plan.md § M3).
- **Git:** `develop` holds requirements + plan + M0–M2; working branch `feature/m3-time-tracking` (publishing branches stays with the maintainer).
- **App runnable?** **Yes** — `npm run dev`; log in as the seeded admin (credentials in `README.md`) and build/browse clients → projects → assigned tasks; seed v2 provides a full demo structure.

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
- **M1 — First vertical slice built** (2026-07-02, `feature/m1-vertical-slice`, segs 0–5): the one-way-door seams proven on one path — `scopedDb` org-scoping extension (G1) with pure `scopeArgs` + tests, `can()`/`requireCapability` (G2/G10) + `currentActor()` (G3) with tests; route guard at `src/proxy.ts` (cookie-presence redirect; authoritative check is `requireActor()` in the `(app)` layout); styled login; app shell (sidebar nav, org + user identity, sign-out); `/clients` list through `scopedDb`; first `src/features/` folder — create-client dialog + `client.manage`-guarded server action, currency pre-filled from org default; seed v1 (Acme/USD, Globex/EUR). 42 unit tests, lint/build/live-smoke green. Convention set: Prisma `create` types still require `organizationId`, call sites pass the actor's and `scopeArgs` stamps over it (documented in `scope.ts`).
- **M2 — Projects & tasks built and merged** (2026-07-02, `feature/m2-projects-tasks`, segs 0–5): client detail page with edit + archive/unarchive (G12); projects under a client (billing-type selector; hourly → per-project/per-task method + rate per D6, fixed fee → amount; per-person/flat visible but disabled); org-wide task list (default-billable flag, archive, duplicate names arbitrated by the DB unique constraint → friendly P2002 error); project detail page with the assignment editor (assign/retire via `active` keeping the (project, task) slot, per-assignment billable override seeded from the task default, per-task rates only on hourly+per-task projects, re-derived server-side); all rate display through the projects read layer (G10 seam for `rate.view`); seed v2 (4 projects across all billing shapes, 4 tasks, 11 mixed assignments incl. a retired one). 73 unit tests, 32-check live smoke, lint/build green. Exit criterion met: the client → project → assigned-tasks structure is buildable entirely in the UI.

## In progress

**M3 — Time tracking** on `feature/m3-time-tracking` (plan.md § M3). Segments — each lands committed and green (lint + tests + build + live smoke):

- [x] **Seg 0** — open the milestone: this checklist + status refresh.
- [x] **Seg 1** — the dates seam (`lib/dates.ts`: local-calendar "YYYY-MM-DD" day per D11, prev/next/today arithmetic, week windows; unit tests) + day view page (`/time` in the sidebar): one date's entries as a read-only list through a `features/time` read layer, billability shown as derived from the assignment.
- [x] **Seg 2** — manual entry: create/edit/delete on the day view via a project→task picker (active assignments only), decimal-hours duration, note, date; future dates warn-and-acknowledge.
- [ ] **Seg 3** — live timer: start fresh or from an entry, starting one stops the running one (app-layer policy, G6/D5), elapsed ticks live, stop collapses into `durationSeconds`; resume offers new pre-filled entry (encouraged) or continue-the-original (accumulates, keeps its day — D12).
- [ ] **Seg 4** — weekly grid: projects×days cells for review and bulk entry.
- [ ] **Seg 5** — seed v3 (a working week of entries across projects, including today), exit-criteria sweep, changelog, wrap-up.

## Next up (ordered)

1. Finish the M3 segments above; **you review + merge** `feature/m3-time-tracking` after the hands-on exit check (track a real day live and retroactively; both timesheet views browsable; exactly one timer can run).
2. **Projects index page** (requested 2026-07-02) — small side item on its own `feature/projects-index` branch off `develop` after M3 merges: a top-level `/projects` list across clients + sidebar link, reusing the M2 projects read layer. Not part of any milestone; nothing depends on it.
3. **M4 — Invoicing lifecycle** per `docs/plan.md`.

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
