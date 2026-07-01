# Conflux — Requirements (Proof of Concept)

Conflux is a self-built alternative to [Harvest](https://www.getharvest.com/): a web app for tracking time against client projects and turning those hours into professional invoices. This document captures the requirements for the **proof-of-concept (POC)** milestone.

This file is the **index**. Detailed requirements live in per-topic documents under [`requirements/`](./requirements/); this page holds the framing, the scope boundary, and links to everything else. It's split this way so requirements can grow feature-by-feature without one giant file — a reversible (two-way-door) organization choice, see [architecture.md](./architecture.md).

## Progress & document map

Each requirements topic is its own document. To add a feature, create a new doc under `requirements/`, add a row here, and have it **link to the [data model](./requirements/data-model.md) rather than restate it**.

| Document                                                    | Covers                                                                    | Status |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| _(this index)_                                              | Framing & scope, POC in/out boundary                                      | ✅     |
| [Data model](./requirements/data-model.md)                  | Org, identity (User/Membership/Role), Clients, Projects, Tasks, billing selectors — the **shared spine** | ✅     |
| [Time tracking](./requirements/time-tracking.md)            | Live timer + manual entry, day & weekly timesheet views                   | ✅     |
| [Invoicing](./requirements/invoicing.md)                    | Invoice sources, grouping, draft→finalize lifecycle, output, fields       | ✅     |
| [Users & access](./requirements/access-control.md)          | Authentication, multi-tenancy, capability-based RBAC                       | ✅     |
| [Tech & non-functional](./requirements/tech-and-nfr.md)     | Stack choices and non-functional requirements                             | ✅     |

Related: [architecture.md](./architecture.md) (guardrails + decisions that keep these forward-compatible), [status.md](./status.md) (where we are / what's next).

## Framing & scope

### Primary goal

The POC's job is to **demo the vision to stakeholders** to secure buy-in before committing to a full build. Success is measured by "does a clickable walkthrough convince a decision-maker," not by production hardening.

### Users & multi-tenancy

The first working version targets a **single user**, but the data model carries the organization + membership concept from the start so that multi-user support is an **additive change, not a rewrite**.

### Eventual scale

The product should eventually serve a **small business of 6–20 people**, which implies real roles (admin vs. member) and per-user reporting down the road. The POC does not implement these, but must not design them out.

### Deployment

Undecided between local-only and hosted. The POC is designed to **run locally now and be hosted later** without major rework — no assumptions that only hold on `localhost`.

### Guiding principles (derived from the above)

- **Polish over robustness.** Because the goal is a stakeholder demo, visible quality (professional-looking invoices, a smooth core click-path) outranks backend edge cases, hardened auth, permissions, and concurrency.
- **Design for multi-user, build for one.** Every row is tenant-scoped (`organization_id`) from the start, and genuinely per-person data (time entries) carries a member attribution — so multi-user is additive, not a re-key. (See the [data model](./requirements/data-model.md).)
- **No local-only lock-in.** Avoid choices that would make later hosting a rewrite.

## POC scope summary (in / out)

A single at-a-glance boundary for the demo milestone. "Modeled" means the data model supports it even though the POC doesn't fully build the UI/flow.

### In scope (built for the demo)

- Single seeded user + login screen, inside one Organization.
- Clients with invoice-ready details; global reusable Tasks.
- Projects with billing type (hourly / fixed-fee / non-billable) and billing method (per-project + per-task fully wired).
- Time tracking: live timer + manual entry, day and weekly views, one running timer.
- Invoicing: draft from tracked time / fixed fee / manual lines; selectable grouping; finalize→snapshot; polished on-screen + PDF; branding, PO number, tax, discount, mark-as-paid.

### Modeled, not fully built (additive later)

- Multi-user, multi-tenant isolation (Organization + org-scoping exist now).
- Per-person and flat billing methods.
- Customizable Discord-style roles (capability system exists; editor UI deferred).
- Full account management (signup, password reset).

### Explicitly out of scope (POC)

- Email delivery and online payment/collection of invoices.
- Expenses/reimbursables as a first-class module (manual invoice lines cover the demo).
- Reporting/analytics dashboards beyond the timesheet views.
- Automatic time rounding rules, native mobile apps, third-party integrations.
