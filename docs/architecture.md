# Conflux — Architecture Guardrails & Decisions

The load-bearing rules and decisions that keep the POC from painting us into a corner as Conflux grows from a single-user demo into a multi-tenant SaaS. The POC implementation stays deliberately small; these guardrails keep its *shape* forward-compatible. This is the **first doc to read before making or changing an architectural decision**.

Companion docs: [requirements.md](./requirements.md) (what we're building), [status.md](./status.md) (where we are / what's next), [AGENTS.md](../AGENTS.md) (how we work).

## How to use this file

- Before any significant design decision, classify it as a **one-way door** or a **two-way door** (see below).
- **Guard one-way doors** against the guardrails here; **build two-way doors the simplest way** that works (per the back-of-the-envelope check in `AGENTS.md`) and change them when the need is real.
- When a decision establishes a new **seam** (a place future growth plugs in), add it under _Guardrails_. When it's a notable choice worth remembering the _why_ for, add a row to the _Decision log_.
- Keep this file current as decisions land — it only prevents corners if it stays honest.

## Doors: where to spend forward-compatibility effort

The goal is **not** to future-proof everything. That over-builds the POC and burns the time the demo needs. Spend forward-compat effort only where reversal is expensive.

- **Two-way door (reversible, cheap to change):** build the obvious, simplest version now. Examples here: which timesheet view is the default, invoice styling, whether grouping is a dropdown or tabs, most feature/UI logic. Changing these later is a normal edit.
- **One-way door (foundational, costly to reverse):** get the *shape* right now, at design time, even though the POC stays single-user. Examples here: tenant keying, identifier scheme, the auth boundary, money representation, capability-vs-role authorization, ORM-mediated data access. These are the guardrails below.

The discipline is a single question per decision: **"If I build the simple version and I'm wrong, how expensive is the reversal?"** Cheap → build simple. Expensive → shape the seam now.

## Architectural guardrails (invariants / seams)

Every change must honor these. Each names the rule, the reason, and the future growth it protects. All are already established across the [requirements docs](./requirements.md); this is the consolidated, enforceable list.

| #   | Guardrail                                                                                          | Why / what it protects                                                                                     |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| G1  | **Every row carries `organization_id`; every query filters by it.**                                | Multi-tenant isolation. Going from one org to many becomes additive instead of a re-key of every table.    |
| G2  | **Authorization checks capabilities, never role names** (`can(user, "invoice.manage")`).           | Lets roles become fully customizable (Discord-style) later with zero changes to enforcement code.          |
| G3  | **Authentication sits behind a boundary** (Auth.js). App code asks "who is the current user," not how they logged in. | Seeded-login-now → full accounts (signup, reset, SSO) becomes a provider swap, not a rewrite.       |
| G4  | **Money is stored as integer minor units**, formatted only at display by one **currency-aware** formatter (no hardcoded ÷100), with a fixed **per-line, half-up** rounding rule. | Avoids floating-point rounding and keeps printed lines summing to the total — non-negotiable for anything that bills. |
| G5  | **Derive, don't duplicate; snapshot only for immutable records.**                                  | One source of truth for rates/totals. The one licensed copy is invoice finalize (a legal record).          |
| G6  | **Foreseeably-changing rules live in application policy, not the schema.** (e.g. single running timer). | Relaxing the rule (concurrent timers) is a policy edit, not a data migration.                          |
| G7  | **Identifiers are UUIDs.**                                                                          | Non-guessable and safe across tenants and distributed/merged data.                                          |
| G8  | **All DB access goes through the ORM** (Prisma); no raw SQL bound to one engine.                   | Keeps the SQLite (POC) → Postgres (prod) switch a config change.                                            |
| G9  | **Rendered deliverables have a single source.** The invoice PDF renders from the same component as the on-screen view. | The customer-facing artifact can't silently drift between preview and PDF.                          |
| G10 | **Authz and org-scoping each live in one shared place**, not re-implemented per feature.            | The golden rules (G1, G2) are enforced consistently; a new feature inherits them by construction.          |
| G11 | **`User` (global identity) is separate from `Membership` (per-org seat); `organization_id` and roles attach to the Membership, never the global User.** | Keeps the login clean so one person joining multiple orgs later is additive, not a User-table re-key.       |

## Decision log (lightweight ADRs)

Point-in-time decisions with their rationale, so future sessions can revisit deliberately rather than rediscover. Graduate to per-decision files under `docs/adr/` only if this table gets unwieldy.

| ID  | Decision                                                              | Door     | Rationale / forward-compat note                                                                 | Date       |
| --- | -------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- | ---------- |
| D1  | Multi-tenant from day one via an `Organization` owning all data      | One-way  | Retro-fitting tenancy is the classic SaaS rewrite; cheap to carry now ([access-control](./requirements/access-control.md), G1).                 | 2026-06-30 |
| D2  | Capability-based RBAC; seed roles Member/Manager/Admin               | One-way  | Enables customizable roles later with no enforcement changes ([access-control](./requirements/access-control.md), G2).                           | 2026-06-30 |
| D3  | TypeScript · Next.js · Prisma · SQLite→Postgres · Tailwind/shadcn · Auth.js | Mixed | Stack picked for SaaS ecosystem + newcomer ergonomics; DB/auth chosen as swappable seams ([tech & NFR](./requirements/tech-and-nfr.md)). | 2026-06-30 |
| D4  | Money as integer minor units                                         | One-way  | Changing money representation after data exists is painful and error-prone ([invoicing](./requirements/invoicing.md), G4).            | 2026-06-30 |
| D5  | Running timer modeled as an open time entry; single-timer as policy  | Two-way  | Simple now; concurrent timers is a later policy relaxation ([time tracking](./requirements/time-tracking.md), G6).                             | 2026-06-30 |
| D6  | POC billing methods: model all four, fully wire per-project + per-task | Two-way | Per-person/flat are additive; no schema lock-in from deferring them ([data model](./requirements/data-model.md)).                        | 2026-06-30 |
| D7  | Split `User` (global identity) from `Membership` (per-org seat); roles attach to Membership | One-way | Retro-fitting the split after users exist is a painful re-key; cheap to carry now ([access-control](./requirements/access-control.md), G11).                 | 2026-07-01 |
| D8  | A Membership holds **multiple** Roles; effective capabilities are their union | One-way | Many-to-many now avoids a later role→roles migration and matches the Discord-style goal (refines D2).                             | 2026-07-01 |
| D9  | Money rounding = per-line, half-up, then sum; currency-aware formatting, 2-decimal POC | Mixed | Rounding shapes immutable finalized snapshots (one-way); other exponents stay additive (two-way) (refines D4, [invoicing](./requirements/invoicing.md)). | 2026-07-01 |
| D10 | Clients/Projects/Tasks are org-shared (org-scoped + `created_by` audit); only Time Entries are member-attributed | Two-way | Resolves the "owner" ambiguity toward shared org assets; per-user privacy was never required (clarifies D1, [data model](./requirements/data-model.md)). | 2026-07-01 |
| D11 | Time-entry day stored as date-only `YYYY-MM-DD` from the user's local calendar | One-way | Sidesteps UTC-rollover and is correct across timezones without migration; a separate timestamp drives live elapsed ([time tracking](./requirements/time-tracking.md)). | 2026-07-01 |

## When to revisit a guardrail

Guardrails are defaults, not dogma. Re-open one deliberately (and log the change) when a real signal arrives:

- The **first genuine second tenant** or the **first non-seed user** — exercise G1/G2/G3 for real before relying on them.
- A **measured performance problem** — only then trade a "derive" (G5) for a cached/stored value, with the measurement recorded.
- A requirement that a guardrail actively blocks — change the guardrail on purpose and note why, don't quietly work around it.
