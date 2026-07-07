# Non-functional requirements & tech stack

_Part of the [Conflux requirements](../requirements.md). Cross-cutting. The enforcement guardrails for these choices live in [architecture.md](../architecture.md)._

## Chosen stack

| Concern | Choice | Why |
| --- | --- | --- |
| Language | **TypeScript** (end-to-end) | Static types suit an OOP/typedef mindset and catch bugs before runtime; one language across the whole app. |
| Framework | **Next.js** (App Router) | Industry-standard SaaS stack; largest ecosystem for auth, multi-tenancy, and polished UI. |
| Database | **SQLite → Postgres** | SQLite is a zero-config local file for the POC; Postgres is the SaaS target. The ORM makes the swap a config change. |
| ORM | **Prisma** | Schema file reads like strongly-typed typedefs; trivial SQLite↔Postgres switch; generated TS types. |
| UI / styling | **Tailwind CSS + shadcn/ui** | Accessible, own-your-code components that hit the "looks professional" bar without hand-rolled CSS. |
| Auth | **Auth.js (NextAuth)** | A clean boundary so seeded-login-now becomes full-accounts-later by swapping providers, not rewriting. |
| PDF | **HTML→PDF via headless Chromium (Playwright)** | The PDF renders from the _same_ styled invoice component as the on-screen view, so they can never drift. |
| Money | **Integer minor units** | Avoids floating-point rounding; formatted only at display via one currency-aware formatter, POC assumes 2-decimal (see [Invoicing](./invoicing.md)). |
| IDs | **UUIDs** | Non-guessable and safe for multi-tenant / distributed data. |

## Non-functional requirements

- **Devices:** desktop-first. Design for a desktop browser (how the demo is shown and how time/invoicing work happens); responsive/mobile layouts are deferred.
- **Browsers:** current evergreen browsers (latest Chrome, Edge, Firefox, Safari). No legacy support.
- **Performance:** no formal targets for a single-user POC; interactions should feel snappy and the live timer should update smoothly.
- **Persistence:** data lives in a real database and survives restarts (no in-memory-only state).
- **Asset storage:** uploaded assets (e.g. the company logo) are stored **in the database**, not on the local filesystem, so nothing depends on a local path — object storage (S3-style) is a later swap behind an asset abstraction. This keeps "runs locally now, hosted later" honest.
- **Security (POC-level, don't design out):** the seeded account's password is hashed (never plaintext), and **every query is scoped by `organization_id`** so tenant isolation is habitual from day one. Full hardening (rate limiting, CSRF depth, audit logs) is deferred.
- **Accessibility:** rely on the component library's sensible defaults; not a POC focus area.
- **Testing:** a light approach for the POC — cover the money math (rounding) and the org-scoping/authz helpers, where correctness bugs are costly; the plan picks the framework. Exhaustive coverage is not a POC goal.

## Seed & demo data

The primary goal is a clickable walkthrough, so the demo can't start from an empty database. Seed: one Organization, its seeded Admin user, a handful of Clients (with invoice-ready details), Projects covering all three billing types and both wired billing methods (per-project and per-task), the global Task list, some logged time across a few days, and at least one **finalized** sample invoice — enough that every screen has something real to show.

## Structure / modularity

Organize by **feature** (clients, projects, time tracking, invoicing, access) so adding or changing a feature touches a minimal, predictable set of files. Keep the authorization check (`can(user, capability)`) and the org-scoping in **one shared place** each, so the golden rules from [Users & access](./access-control.md) are enforced consistently rather than re-implemented per feature.
