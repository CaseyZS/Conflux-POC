# Non-functional requirements & tech stack

_Part of the [Conflux requirements](../requirements.md). Cross-cutting. The enforcement guardrails for these choices live in [architecture.md](../architecture.md)._

## Chosen stack

| Concern         | Choice                                   | Why                                                                                                             |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Language        | **TypeScript** (end-to-end)              | Static types suit an OOP/typedef mindset and catch bugs before runtime; one language across the whole app.      |
| Framework       | **Next.js** (App Router)                 | Industry-standard SaaS stack; largest ecosystem for auth, multi-tenancy, and polished UI.                       |
| Database        | **SQLite → Postgres**                    | SQLite is a zero-config local file for the POC; Postgres is the SaaS target. The ORM makes the swap a config change. |
| ORM             | **Prisma**                               | Schema file reads like strongly-typed typedefs; trivial SQLite↔Postgres switch; generated TS types.             |
| UI / styling    | **Tailwind CSS + shadcn/ui**             | Accessible, own-your-code components that hit the "looks professional" bar without hand-rolled CSS.             |
| Auth            | **Auth.js (NextAuth)**                    | A clean boundary so seeded-login-now becomes full-accounts-later by swapping providers, not rewriting.          |
| PDF             | **HTML→PDF via headless Chromium (Playwright)** | The PDF renders from the *same* styled invoice component as the on-screen view, so they can never drift.  |
| Money           | **Integer minor units**                  | Avoids floating-point rounding on currency (see [Invoicing](./invoicing.md)).                                   |
| IDs             | **UUIDs**                                | Non-guessable and safe for multi-tenant / distributed data.                                                     |

## Non-functional requirements

- **Devices:** desktop-first. Design for a desktop browser (how the demo is shown and how time/invoicing work happens); responsive/mobile layouts are deferred.
- **Browsers:** current evergreen browsers (latest Chrome, Edge, Firefox, Safari). No legacy support.
- **Performance:** no formal targets for a single-user POC; interactions should feel snappy and the live timer should update smoothly.
- **Persistence:** data lives in a real database and survives restarts (no in-memory-only state).
- **Security (POC-level, don't design out):** the seeded account's password is hashed (never plaintext), and **every query is scoped by `organization_id`** so tenant isolation is habitual from day one. Full hardening (rate limiting, CSRF depth, audit logs) is deferred.
- **Accessibility:** rely on the component library's sensible defaults; not a POC focus area.

## Structure / modularity (per AGENTS.md)

Organize by **feature** (clients, projects, time tracking, invoicing, access) so adding or changing a feature touches a minimal, predictable set of files. Keep the authorization check (`can(user, capability)`) and the org-scoping in **one shared place** each, so the golden rules from [Users & access](./access-control.md) are enforced consistently rather than re-implemented per feature.
