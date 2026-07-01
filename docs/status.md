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

## In progress

- Nothing mid-flight. Clean stopping point.

## Next up (ordered)

1. **Implementation plan** (`docs/plan.md`): the Prisma schema (entities from §2/§5), a milestone breakdown, and the first vertical slice to build. Include the required Progress table.
2. **Scaffold the app:** Next.js + TypeScript + Prisma (SQLite) + Tailwind/shadcn + Auth.js, with the shared authz + org-scoping helpers (guardrails G10) stubbed in from the start.
3. **First vertical slice:** seeded login → create a client → list clients. Proves the auth boundary, org-scoping, and the data layer end-to-end on one thin path.

## Open questions / deferred decisions

- Manager time visibility: own vs. only-managed-projects vs. all. Deferred (single-user POC makes it moot for now).
- Production hosting target. Deferred, but a SaaS is inherently hosted (see `architecture.md`).
- Whether Admin is an orthogonal flag or a top role — intentionally left open because roles become customizable (§5).

## Doc map (where things live)

- `docs/requirements.md` — **what** we're building (the feature/data decisions).
- `docs/architecture.md` — **guardrails + decisions**; read before changing the architecture.
- `docs/status.md` — **this file**; where we are and what's next.
- `AGENTS.md` — **how** we work (git flow, conventions, design checks).
