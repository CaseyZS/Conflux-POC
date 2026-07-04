# Conflux — Deployment & Hosting

Where and how Conflux runs once it's off a laptop, decided deliberately on disk rather than in chat. Companion docs: [architecture.md](./architecture.md) (guardrails this must honor, esp. G8) and [status.md](./status.md) (where the POC stands overall).

This is a **design reference, not an implementation plan.** No migration work starts until the open questions (§7) are settled.

## Progress

| Step | Status |
| --- | --- |
| Requirements interview | ✅ Done (2026-07-03) |
| Decompose what actually needs a host | ✅ Done (2026-07-03) — §2 |
| Decision criterion stated | ✅ Done (2026-07-03) — §3 |
| Platform decided | ✅ Done (2026-07-03) — Railway (app + Postgres), D18 |
| Prisma datasource switched SQLite → Postgres | ⬜ Not started |
| Railway project provisioned + env vars set | ⬜ Not started |
| First deploy verified against `docs/demo.md` | ⬜ Not started |
| Custom domain (if needed) | ⬜ Not started |

## 1. Requirements gathered (interview, 2026-07-03)

- **Purpose:** not yet decided — demo vs. early production is still open (see `status.md`'s open questions). The recommendation is chosen to serve either without a re-architecture.
- **Ops style:** fully managed — no server to administer (patching, restarts, monitoring).
- **Budget:** not a hard constraint.
- **Database:** open to migrating off SQLite to a hosted Postgres for deployment.
- **Scaling ambition:** not just this app growing — a **home flexible enough for other personal projects too**, so hosting cost and ops learning amortize across several apps rather than being re-solved per project.

## 2. Decompose: what actually needs a host?

Conflux itself has a simple hosting shape — it's request/response CRUD plus on-demand PDF, with no background workers, no scheduled jobs, and no push/outbound notifications. On its own, that shape fits almost anywhere, including serverless.

Two things pull the decision away from "cheapest serverless deploy":

1. **PDF generation via headless Chromium.** The invoice PDF renders through Playwright driving headless Chromium (`lib/pdf.ts`, G9). That's an awkward fit for serverless functions: a full Chromium binary exceeds typical function size limits (forcing a special slimmed-down build), and nothing stays warm between invocations, so every PDF pays a cold browser spin-up. On an always-on host this is a non-issue — install Playwright normally and keep one browser instance alive.
2. **The multi-project ambition (§1).** Wanting one flexible home for several personal projects is the textbook description of a small general-purpose backend, not a single-function serverless deploy. This is the real decision driver.

## 3. Decision criterion

**If the goal were only "host this one CRUD app," serverless would be the obvious call.** The multi-project ambition changes that: a single small **always-on instance** with attached storage becomes the cost-effective home, because one flat monthly fee amortizes across every app added and removes per-function timeout/metering friction. Conflux becomes the platform's first tenant, and the Chromium wrinkle (§2.1) resolves for free on an always-on box.

The rest of this doc assumes that ambition holds. If it turns out this is and stays the only app, a serverless host (e.g. Vercel + a managed Postgres) is a perfectly good simpler answer — revisit then.

## 4. Recommendation: Railway (app + managed Postgres)

**Why:** Railway is a fully-managed, git-push-to-deploy platform where an always-on service, a background worker, and a managed database live side by side in one project under one predictable bill. That matches both drivers: Chromium runs on a normal always-on container (no serverless size/cold-start workarounds), and multiple projects/services share one platform instead of a separate serverless stack per app. Its one-click managed Postgres means the database is a peer service in the same project, not a bolted-on second vendor — the right shape once the point is _one platform_, not one-stack-per-app.

**LabVIEW analogy:** this is closer to owning one always-on RT target that hosts several deployed applications, versus spinning up a fresh, separately-metered execution context per call. The flat-rate box you administer-lightly amortizes across everything you deploy to it.

**Database:** Railway's managed Postgres. Prisma already anticipates this switch as a swappable seam (D3, G8, D13) — Prisma is the only thing that talks to the database, so moving off SQLite is a config change, not a rewrite.

### Cost (back-of-the-envelope)

Figures are rough and drift — **re-check before committing.** The right _tier_ is **Hobby** (Pro's per-seat pricing buys team features and higher ceilings a personal platform doesn't need). But the tier's base fee and the actual bill differ, because Railway meters real resource usage on top of the base:

| Component | Rough monthly cost | Note |
| --- | --- | --- |
| Hobby base | ~$5, includes ~$5 usage credit | The always-on Next.js server (~0.5 GB RAM held continuously) roughly consumes this credit by itself |
| Managed Postgres | ~$2–4 | A second always-on container |
| Chromium PDF spikes | pennies | Brief RAM spikes during a render; size RAM with headroom, but it's overage, not a big line |
| **Realistic total** | **~$10–15/mo** | Base + overage; well inside budget, and amortizes as more projects join |

## 5. Migration: SQLite → Postgres

Anticipated as a swappable seam (D3, G8, D13); the switch is config, not a rewrite.

1. Provision Railway's managed Postgres and get the connection string.
2. `prisma/schema.prisma`: change the `datasource db` provider from `sqlite` to `postgresql`.
3. `prisma.config.ts`: drop the `better-sqlite3` driver adapter — Postgres doesn't need it.
4. Re-issue migrations against Postgres (`prisma migrate dev` / `migrate deploy`). D13's SQLite-dialect workarounds (string-typed enums, integer basis points) carry over unchanged; tightening them to native Postgres types is optional later work, not required for the switch.
5. Point `DATABASE_URL` at the Railway connection string, in the Railway service env vars and locally in `.env` for development.
6. Reseed (`npm run db:seed`) against the new database.
7. Smoke-test with `docs/demo.md`.

## 6. Deployment steps (once ready to execute)

1. Create a Railway project; connect the GitHub repo as a service.
2. Railway detects Next.js; add `DATABASE_URL`, `AUTH_SECRET`, and any other env vars `auth.ts` needs.
3. Add the managed Postgres service in the same project (§5).
4. Deploy; verify against `docs/demo.md`.
5. Add a custom domain when needed — Railway handles DNS + TLS.

## 7. Open questions

- **Q1 — Is the multi-project ambition real, or aspirational?** This is the hinge of §3. If it's aspirational and Conflux stays the only app, a serverless host is a simpler answer; revisit when a second project actually appears.
- **Q2 — Purpose (demo vs. production)** is still undecided — settle before provisioning anything beyond the smallest tier.
- **Q3 — When to add Postgres vs. keep SQLite for a pure demo.** A throwaway stakeholder demo could ship SQLite on a single always-on box with a persistent disk; production or multi-project use wants the Postgres switch (§5). Pick per Q2.

## 8. What this does NOT solve (honest caveats)

- **It trades away zero-config per-branch preview URLs.** A serverless host like Vercel gives every git branch its own preview URL automatically, which fit this repo's gitflow nicely. Railway has branch/PR environments but they're less automatic — a real, if minor, loss against solving the Chromium ops and consolidating onto one platform.
- **It adds ops surface.** An always-on host means uptime, deploys, and (over time) database backups become your responsibility — costs a serverless setup hides. Modest on a managed platform like Railway, but non-zero, and the price of a reusable home.
- **The multi-project payoff is only real if more projects actually land.** For Conflux alone, this is a slightly heavier choice than a pure serverless deploy; the justification is the platform ambition (§3), not this one app.
