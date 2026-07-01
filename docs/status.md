# Conflux — Project Status

The single source of "where we are and what's next," so any session can resume without relying on memory or chat history. **Update this at the end of every working session** (see the end-of-session ritual in `AGENTS.md`).

## Snapshot

- **Date:** 2026-06-30
- **Phase:** Requirements complete; pre-implementation (no app code yet).
- **Git:** `develop` holds merged requirements; work continues on short-lived `feature/` branches.
- **App runnable?** No — nothing scaffolded yet.

## Done

- Working conventions established (`AGENTS.md`).
- Full requirements interview captured in `docs/requirements.md` — 6 sections + in/out scope summary.
- Architecture guardrails and decision log established (`docs/architecture.md`).
- This status/continuity file created.
- `AGENTS.md` conventions extended: one-way/two-way door test (design-check trigger C), decision-log upkeep rule, forward-compat working-style bullet. `.gitattributes` added to normalize line endings.
- Requirements split into an index (`docs/requirements.md`) + per-topic docs under `docs/requirements/` (data model, time tracking, invoicing, access-control, tech-and-nfr); cross-references in `architecture.md` updated.

## In progress

- Nothing mid-flight. Clean stopping point.

## Next up (ordered)

1. **Requirements gap review (before planning):** review the requirements docs for gaps, omissions, and unstated assumptions using a max-effort model pass (Fable or Opus 4.8 at max effort). Feed anything found back into the relevant `docs/requirements/` docs before moving to the plan.
2. **Implementation plan** (`docs/plan.md`): the Prisma schema (entities from the [data model](requirements/data-model.md) and [access-control](requirements/access-control.md) docs), a milestone breakdown, and the first vertical slice to build. Include the required Progress table.
3. **Scaffold the app:** Next.js + TypeScript + Prisma (SQLite) + Tailwind/shadcn + Auth.js, with the shared authz + org-scoping helpers (guardrails G10) stubbed in from the start.
4. **First vertical slice:** seeded login → create a client → list clients. Proves the auth boundary, org-scoping, and the data layer end-to-end on one thin path.

## Open questions / deferred decisions

- Manager time visibility: own vs. only-managed-projects vs. all. Deferred (single-user POC makes it moot for now).
- Production hosting target. Deferred, but a SaaS is inherently hosted (see `architecture.md`).
- Whether Admin is an orthogonal flag or a top role — intentionally left open because roles become customizable (see [access-control](requirements/access-control.md)).

## Doc map (where things live)

- `docs/requirements.md` — **index** of what we're building; links to the per-topic docs in `docs/requirements/` (data model, time tracking, invoicing, access-control, tech & NFR).
- `docs/architecture.md` — **guardrails + decisions**; read before changing the architecture.
- `docs/status.md` — **this file**; where we are and what's next.
- `AGENTS.md` — **how** we work (git flow, conventions, design checks).
