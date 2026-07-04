# Conflux — Deployment & Hosting

Where and how Conflux runs once it's off a laptop. This is the design doc for the hosting decision; companion docs are [architecture.md](./architecture.md) (guardrails this decision must honor, esp. G8) and [status.md](./status.md) (where the POC stands overall).

## Progress

| Step | Status |
| --- | --- |
| Requirements interview | ✅ Done (2026-07-03) |
| Platform decided | ✅ Done (2026-07-03) — Vercel (app) + Neon (Postgres) |
| Prisma datasource switched SQLite → Postgres | ⬜ Not started |
| Neon project provisioned | ⬜ Not started |
| Vercel project connected + env vars set | ⬜ Not started |
| First deploy verified against `docs/demo.md` | ⬜ Not started |
| Custom domain (if needed) | ⬜ Not started |

## Requirements gathered (interview, 2026-07-03)

- **Purpose:** not yet decided — demo vs. early production is still open (see `status.md`'s open questions). The recommendation below is chosen to work for either without a re-architecture.
- **Ops style:** fully managed — no server to administer (patching, restarts, monitoring).
- **Budget:** not a hard constraint.
- **Database:** open to migrating off SQLite to a hosted Postgres for deployment.

## Recommendation: Vercel (app) + Neon (Postgres)

**Why:** Vercel is built by the Next.js team, so App Router features (server actions, the on-demand PDF route) deploy with zero config — connect the repo, push, it builds. It also gives every git branch its own preview URL automatically, which matches this repo's gitflow convention for free: a `feature/*` branch can be handed to a stakeholder as a live link without touching `develop` or `main`. Nothing to patch or restart — matches the "fully managed" answer. Free tier covers a demo; paid tiers scale the same app without an architecture change, which covers "purpose not yet decided."

Neon (or "Vercel Postgres," which is Neon under the hood) is a managed Postgres with connection pooling built in — serverless functions open many short-lived DB connections, which plain Postgres handles poorly but Neon's pooler is built for.

**LabVIEW analogy:** this is like deploying a built EXE to a hosted runtime engine that auto-scales instances for you — you hand over the artifact, not the machine.

**Main tradeoff:** Vercel's model is serverless — no long-running process. That's fine for this app's shape (request/response CRUD + on-demand PDF), but would be the wrong fit if a background worker, websocket, or persistent process were ever needed (Vercel Cron covers simple scheduled jobs if that comes up).

**Alternative considered:** Railway — one dashboard for app + Postgres, still fully managed and git-push deploy, simpler mental model (one vendor, one runtime) at the cost of no automatic per-branch database and less Next.js-specific tooling.

## Migration: SQLite → Postgres

This was already anticipated as a swappable seam (D3, G8, D13) — Prisma is the only thing that talks to the database, so the switch is a config change, not a rewrite.

1. Provision a Neon project (directly, or via Vercel's Neon integration) and get the pooled connection string.
2. `prisma/schema.prisma`: change the `datasource db` provider from `sqlite` to `postgresql`.
3. `prisma.config.ts`: drop the `better-sqlite3` driver adapter — Postgres doesn't need it.
4. Re-issue migrations against Postgres from scratch (`prisma migrate dev` / `migrate deploy`). D13's SQLite-dialect workarounds (string-typed enums, integer basis points) carry over unchanged; tightening them to native Postgres types is optional later work, not required for the switch.
5. Point `DATABASE_URL` at the Neon connection string, in Vercel's project env vars and locally in `.env` for anyone developing against it.
6. Reseed (`npm run db:seed`) against the new database.
7. Smoke-test with `docs/demo.md`.

## Deployment steps (once ready to execute)

1. Connect the GitHub repo to a new Vercel project.
2. Vercel auto-detects Next.js; add `DATABASE_URL`, `AUTH_SECRET`, and any other env vars `auth.ts` needs.
3. First deploy off `develop` (or a `release/*` branch, once the `release` skill is used) — feature branches get preview URLs with no extra config.
4. Verify against `docs/demo.md`.
5. Add a custom domain when needed — Vercel handles DNS + TLS.

## Open questions

- Purpose (demo vs. production) is still undecided — revisit before provisioning anything beyond free tiers.
- Vercel Postgres (Neon, managed through Vercel's dashboard) vs. a standalone Neon account are functionally identical; standalone Neon avoids coupling the database's billing/account to Vercel if the app host ever changes.
