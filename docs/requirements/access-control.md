# Users & access — auth, tenancy & RBAC

_Part of the [Conflux requirements](../requirements.md). Cross-cutting: these rules apply across every feature. Enforcement guardrails live in [architecture.md](../architecture.md)._

Almost none of this is *built* in the single-user POC, but the *shape* is decided now so multi-user, multi-tenant, and customizable roles are all additive rather than retrofits.

## Authentication (POC vs. target)

- **POC:** a real-looking login screen backed by **one seeded account** (no self-signup). Enough to exercise the "current user" plumbing and look like a product in the demo.
- **Target:** full account management — self-signup, password reset, sessions. The POC's auth is built behind a boundary so this is a swap-in, not a teardown.
- **Identity vs. membership:** a **User** is the global login (credentials, behind Auth.js); a **Membership** is that user's seat in one Organization and carries their roles. The POC seeds one User with one Membership in one Organization, so letting a User belong to several orgs later is additive. (See the [data model](./data-model.md).)
- **Deactivating a seat:** a Membership carries an `active` flag; authentication and authorization **deny an inactive Membership**, so a company can revoke someone's access (e.g. a departed contractor) without deleting their time history — which G12 forbids anyway. Reactivating restores access.

## Tenancy: multi-tenant SaaS

Conflux is intended to serve **many isolated companies** from one deployment. Therefore:

- An **Organization** (tenant) is the **top-level owner of all data** and exists from the POC's first table. The single POC user belongs to one Organization.
- **Every org-scoped entity is keyed by `organization_id`** (Client, Project, Task, Time Entry, Invoice, Membership, Role, …). The one deliberate exception is the global **User** identity, which is not org-scoped — it reaches a tenant _through_ its Membership. Tenant isolation is enforced as a standing query rule, so going from one org to many is additive, not a re-key.
- A SaaS is inherently hosted, so the earlier "hosting undecided" resolves toward **hosted** for the real product; the POC may still run locally.

## Authorization: capability-based RBAC (Discord-style, eventual)

The end goal is **fully customizable roles**: admins can add/modify/delete roles and choose each role's permissions, like Discord. The architecture is built for this from the start:

- **Permissions are granular capabilities** (e.g. `time.track`, `time.view.all`, `rate.view`, `client.manage`, `project.manage`, `invoice.manage`, `company.settings`, `users.manage`, `roles.manage`, `billing.account`).
- **Roles are data, not code** — a role is a named set of capabilities stored per Organization, not a hardcoded enum.
- **A Membership can hold several Roles**, and its effective capabilities are the **union** of them (Discord-style). Permissions resolve from the active Membership, never from a single role field.
- **The golden rule:** business logic checks **capabilities, never role names** (`can(user, "invoice.manage")`, never `if user.role == "manager"`). This is what makes a future role editor a pure addition with no changes to enforcement code.

## Read vs. manage (visibility model)

The capability list is deliberately all about _managing_ (writing) — reads follow two simple rules:

- **Operational data is org-readable.** Any authenticated member can _read_ the Clients, Projects, and Tasks in their Organization, because you can't log time against work you can't see. Only _changing_ it is gated (`client.manage`, `project.manage`).
- **Time is owner-scoped.** A member sees **their own** time entries by default; `time.view.all` widens that to everyone's. This is a row-level filter (by the owning Membership) layered on top of org-scoping, and it lives in the same shared authz/scoping place as the golden rule (guardrail G10), not sprinkled per feature.
- **Rate/amount fields are sensitive.** The money on Projects (rates, fixed fee), on per-task assignments, and on Invoices is gated by `rate.view` (held by Manager/Admin); a plain Member reads the work but not its pricing. _Enforcement is deferred_ in the single-Admin POC — nobody to hide from — so the only requirement now is that these reads route through the shared read layer (G10), making field-stripping a later addition, not a refactor. This is **field-level** authorization, one layer finer than the row-level rules above.

## POC seed roles

The POC ships three fixed seed roles (rows in the roles table, backed by the capability system above — no role-editor UI yet):

| Role        | Holds capabilities                                                                                     | In plain terms                                              |
| ----------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **Member**  | `time.track`                                                                                           | Logs and views their **own** time.                         |
| **Manager** | Member + `time.view.all`, `rate.view`, `client.manage`, `project.manage`, `invoice.manage`              | Operational: runs clients/projects/tasks and invoicing.    |
| **Admin**   | Manager + `company.settings`, `users.manage`, `roles.manage`, `billing.account`                        | Company/tenant administration.                             |

Notes on intent:

- Admin's distinguishing powers (from the interview) are **company profile & branding**, **tax & currency defaults**, **user management**, and **subscription & billing** (the org's own Conflux SaaS account, distinct from client invoicing) — plus **role management** (`roles.manage`) for the eventual editor.
- The Member↔Manager line is the main operational split: Members track their own time; Managers additionally invoice and manage work.
- Whether "Admin" is an orthogonal flag or a top role is left open — because roles become fully customizable, the seed layout is just a starting configuration, not a fixed hierarchy.
- **The seeded demo user holds the Admin role** (so it has every capability), letting one login walk the entire demo — track time, manage clients/projects/tasks, and invoice. Since a Membership can hold multiple roles, that's just one row in the join, not a ceiling.
