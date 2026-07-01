# Users & access — auth, tenancy & RBAC

_Part of the [Conflux requirements](../requirements.md). Cross-cutting: these rules apply across every feature. Enforcement guardrails live in [architecture.md](../architecture.md)._

Almost none of this is *built* in the single-user POC, but the *shape* is decided now so multi-user, multi-tenant, and customizable roles are all additive rather than retrofits.

## Authentication (POC vs. target)

- **POC:** a real-looking login screen backed by **one seeded account** (no self-signup). Enough to exercise the "current user" plumbing and look like a product in the demo.
- **Target:** full account management — self-signup, password reset, sessions. The POC's auth is built behind a boundary so this is a swap-in, not a teardown.

## Tenancy: multi-tenant SaaS

Conflux is intended to serve **many isolated companies** from one deployment. Therefore:

- An **Organization** (tenant) is the **top-level owner of all data** and exists from the POC's first table. The single POC user belongs to one Organization.
- **Every entity is keyed by `organization_id`** (Client, Project, Task, Time Entry, Invoice, User, Role, …). Tenant isolation is enforced as a standing query rule, so going from one org to many is additive, not a re-key.
- A SaaS is inherently hosted, so the earlier "hosting undecided" resolves toward **hosted** for the real product; the POC may still run locally.

## Authorization: capability-based RBAC (Discord-style, eventual)

The end goal is **fully customizable roles**: admins can add/modify/delete roles and choose each role's permissions, like Discord. The architecture is built for this from the start:

- **Permissions are granular capabilities** (e.g. `time.track`, `time.view.all`, `client.manage`, `project.manage`, `invoice.manage`, `company.settings`, `users.manage`, `roles.manage`, `billing.account`).
- **Roles are data, not code** — a role is a named set of capabilities stored per Organization, not a hardcoded enum.
- **The golden rule:** business logic checks **capabilities, never role names** (`can(user, "invoice.manage")`, never `if user.role == "manager"`). This is what makes a future role editor a pure addition with no changes to enforcement code.

## POC seed roles

The POC ships three fixed seed roles (rows in the roles table, backed by the capability system above — no role-editor UI yet):

| Role        | Holds capabilities                                                                                     | In plain terms                                              |
| ----------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **Member**  | `time.track`                                                                                           | Logs and views their **own** time.                         |
| **Manager** | Member + `time.view.all`, `client.manage`, `project.manage`, `invoice.manage`                          | Operational: runs clients/projects/tasks and invoicing.    |
| **Admin**   | Manager + `company.settings`, `users.manage`, `roles.manage`, `billing.account`                        | Company/tenant administration.                             |

Notes on intent:

- Admin's distinguishing powers (from the interview) are **company profile & branding**, **tax & currency defaults**, **user management**, and **subscription & billing** (the org's own Conflux SaaS account, distinct from client invoicing) — plus **role management** (`roles.manage`) for the eventual editor.
- The Member↔Manager line is the main operational split: Members track their own time; Managers additionally invoice and manage work.
- Whether "Admin" is an orthogonal flag or a top role is left open — because roles become fully customizable, the seed layout is just a starting configuration, not a fixed hierarchy.
