# Conflux — Project Status

The single source of "where we are and what's next," so any session can resume without relying on memory or chat history. **Update this at the end of every working session** (see the end-of-session ritual in `AGENTS.md`).

## Snapshot

- **Date:** 2026-07-03
- **Phase:** **M5 — Invoice output & demo polish** — in progress on `feature/m5-invoice-output`. M4 (invoicing lifecycle) is merged into `develop`.
- **Git:** `develop` holds requirements + plan + M0–M4 (invoicing merged 2026-07-03, plus a `derive.ts` NUL→`\x00` hotfix); working branch `feature/m5-invoice-output` (publishing branches stays with the maintainer).
- **App runnable?** **Yes** — `npm run dev`; log in as the seeded admin (credentials in `README.md`), build/browse clients → projects → assigned tasks, track time in the day (`/time`) and week (`/time/week`) views, then turn it into money at `/invoices`: draft → grouping/manual lines/discount/tax → Finalize → Mark as paid. Seed v4 adds a paid INV-0001 plus an open draft over the demo week's pool.

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

- **M3 — Time tracking built and merged** (2026-07-02/03, `feature/m3-time-tracking`, segs 0–5): the dates seam (`lib/dates.ts`, local-calendar "YYYY-MM-DD" per D11); day view (`/time`) with manual create/edit/delete via a project→task picker, billability derived from the assignment, future dates warn-and-acknowledge; live timer (single-timer app policy G6/D5, D12 resume with fresh-vs-continue — skipped same-day, sidebar widget, running entries locked until stopped); weekly grid (`/time/week`, Day|Week tabs, editable H:MM cells, row/day/week totals, add-row picker, ambiguous cells defer to the day view); H:MM as the default duration display (inputs accept `1:30` and `1.5`); seed v3 — a demo working week dated by offset-from-today that re-seeding slides onto the current week. 110 unit tests, live smokes 24 (timer) + 20 (week) + 40 (regression), lint/build green; exit criterion (track a real day live + retroactively, both views browsable, exactly one timer) accepted hands-on and merged.

- **Projects index** (side item requested 2026-07-02, `feature/projects-index`, merged 2026-07-03): an org-wide `/projects` list across clients — project, client, and billing-summary columns through the M2 projects read layer (new `listOrgProjects`, keeping the `rate.view` gate in the one seam), archived projects in a muted section, Projects link in the sidebar. Creation stays on the client's page and management on the project detail page; the index is a pure read.

- **M4 — Invoicing lifecycle built & merged** (2026-07-03, `feature/m4-invoicing`, segs 0–5): the invoice money pipeline in `lib/money.ts` (integer half-up rounding, percent-XOR-flat discount clamped to the subtotal, single tax after discount — 15 tests incl. the lines-sum-to-total invariant); `/invoices` list + new-invoice flow (active client → project selection with unbilled H:MM / fee amounts → draft with `InvoiceProject` rows, org defaults copied in); the draft editor — time lines derived live from the unbilled pool (billable, hourly, not running, never billed) through pure `derive.ts` (task grouping splits by rate like person does — every line carries one rate; person gets the "Bob (Design)" parenthetical when rate-split; summary collapses to hours × rate when uniform, 1 × amount when mixed; detailed keeps notes; date/person/task/note toggles annotate without stuttering — 14 tests), fixed-fee lines, manual lines (thousandth quantities, optional project attribution), settings (grouping/toggles, issue + due dates with due derived from terms until overridden, discount, tax, PO, footer), delete-draft; **finalize** in one transaction (`finalize.ts`, shared with the seed): gapless `INV-####` consumed from the org counter, snapshot of lines (print positions), totals, currency, bill-to, from + logo-by-reference, anti-double-bill links for time entries and fixed fees, with the pool predicate re-run inside the tx; sent→paid as the second forward-only flag; billed entries render locked in the day view. Status vocabulary settled: the stored lifecycle is the schema's three states — **Finalize is the draft→sent transition**. Seed v4: paid INV-0001 over the dedicated Brand Refresh history (billed through the real finalize; the seed never touches billed entries on re-run) + an open Acme draft with manual line/8.25% tax/PO. 141 unit tests; live checks 23 (finalize domain: snapshot fields, five entries linked, second finalize refused, second draft finds an empty pool, fee link, counter) + 12 (finalized view + day-view locks) + 44 (regression incl. exact derived amounts); lint/build green. Merged into `develop` 2026-07-03; a follow-up `hotfix/derive-nul-escape` rewrote `derive.ts`'s raw-NUL group-key delimiter as the `\x00` escape (git had classified the file binary) — identical runtime byte, no behavior change.

## In progress

**M5 — Invoice output & demo polish** on `feature/m5-invoice-output` (off `develop`). Segment plan:

- [x] **Seg 0 — Open the milestone.** Plan progress + status + this segment checklist; M4 merged into `develop` (plus the `derive.ts` NUL→`\x00` hotfix).
- [x] **Seg 1 — Invoice document.** One styled `InvoiceDocument` component; the finalized invoice renders through it on screen (the polished view) with print CSS tuned. Drafts keep the working editor.
- [x] **Seg 2 — PDF output (G9).** Playwright headless Chromium prints the same document to PDF; a "Download PDF" action on finalized invoices. `lib/pdf.ts` seam owns the browser; a bare `/print/[id]` route (shell-free, outside `(app)`) is the print surface; `/invoices/[id]/pdf` forwards the session cookie so Chromium loads it as the same user.
- [ ] **Seg 3 — Org settings + branding.** The `lib/assets.ts` seam; a `/settings` page (business name, from block, currency/tax/terms defaults, invoice prefix + next number, footer, logo upload → `Asset`) behind the org-settings capability — the branding finalize snapshots.
- [ ] **Seg 4 — Time display format.** Org default H:MM vs decimal wired through the existing `duration.ts` seam to the time views.
- [ ] **Seg 5 — Dashboard + polish.** A post-login dashboard/landing; empty / loading / error states over the demo path; a theming pass.
- [ ] **Seg 6 — Full demo seed + `docs/demo.md`.** The complete demo seed and the scripted walkthrough.

## Next up (ordered)

1. **M5 segments 1–6** (checklist above) — the styled invoice document + PDF, org settings/branding, the time-format preference, the dashboard/polish pass, and the full demo seed + `docs/demo.md`.
2. **You review + merge** `feature/m5-invoice-output` once the milestone is green — after which the POC is demo-ready end to end.

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
