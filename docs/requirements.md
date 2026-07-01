# Conflux — Requirements (Proof of Concept)

Conflux is a self-built alternative to [Harvest](https://www.getharvest.com/): a web app for tracking time against client projects and turning those hours into professional invoices. This document captures the requirements for the **proof-of-concept (POC)** milestone. It is built up interactively and will grow as decisions are made.

## Progress

Interview-driven requirements gathering. Each round produces one section below.

| #   | Section              | Status         |
| --- | -------------------- | -------------- |
| 1   | Framing & scope      | ✅ Done        |
| 2   | Clients & projects   | ✅ Done        |
| 3   | Time tracking        | ✅ Done        |
| 4   | Invoicing            | ⬜ Not started |
| 5   | Users & access       | ⬜ Not started |
| 6   | Non-functional & tech | ⬜ Not started |

## 1. Framing & scope

### Primary goal

The POC's job is to **demo the vision to stakeholders** to secure buy-in before committing to a full build. Success is measured by "does a clickable walkthrough convince a decision-maker," not by production hardening.

### Users & multi-tenancy

The first working version targets a **single user**, but the data model carries a user/owner concept from the start so that multi-user support is an **additive change, not a rewrite**.

### Eventual scale

The product should eventually serve a **small business of 6–20 people**, which implies real roles (admin vs. member) and per-user reporting down the road. The POC does not implement these, but must not design them out.

### Deployment

Undecided between local-only and hosted. The POC is designed to **run locally now and be hosted later** without major rework — no assumptions that only hold on `localhost`.

### Guiding principles (derived from the above)

- **Polish over robustness.** Because the goal is a stakeholder demo, visible quality (professional-looking invoices, a smooth core click-path) outranks backend edge cases, hardened auth, permissions, and concurrency.
- **Design for multi-user, build for one.** Every table/entity that will eventually be per-user gets an owner reference now, even while only one user exists.
- **No local-only lock-in.** Avoid choices that would make later hosting a rewrite.

## 2. Clients & projects (data-model spine)

This section defines the core entities and how they relate. Everything else (time entries, invoices) wires into these.

### Entities

- **Client** — the company being billed. Fields: name, contact person, email, billing address, currency. Owns projects.
- **Project** — a body of work for one client. Fields: name, `billing type`, `billing method` (when hourly), rate/fee fields (see below), status (active/archived). Belongs to a client. Owns its task assignments.
- **Task** — a reusable, company-wide kind of work (e.g. Design, Development, Meeting, Admin). Maintained as one global list and assigned to projects. Fields: name, default billable flag, active flag.
- **Project ↔ Task assignment** — the join that says "this task is available on this project." Carries the per-project details: billable flag (overrides the task default) and, when the project's billing method is per-task, the task's rate on this project.
- **User** — the owner of the data. Single user for now; every entity above carries an owner reference so multi-user is additive. Will later carry a per-person rate (for the per-person billing method).

### Project billing: two independent selectors

Mirrors Harvest. A project chooses **how it is billed overall** and, when hourly, **where the rate comes from**.

- **Billing type** (all three supported in the POC):
  - `hourly` — bill tracked billable hours × the applicable rate.
  - `fixed fee` — bill a flat agreed amount regardless of hours; time is still tracked for internal cost.
  - `non-billable` — internal/overhead work that is never invoiced (time still tracked for reporting).
- **Billing method** (rate source; only meaningful when `hourly`). All four are modeled; per-project and per-task are fully wired for the demo, per-person and flat are additive later:
  - `per-project` — one rate on the project. Simplest; single source of truth.
  - `per-task` — rate lives on each Project↔Task assignment (Design $150, Admin $75).
  - `per-person` — rate follows the user who logged the time. Needs multi-user to be meaningful.
  - `flat` — one app-wide rate.

### Relationships (at a glance)

```mermaid
erDiagram
    USER ||--o{ CLIENT : owns
    CLIENT ||--o{ PROJECT : "billed for"
    PROJECT ||--o{ PROJECT_TASK : offers
    TASK ||--o{ PROJECT_TASK : "assigned via"
    PROJECT_TASK ||--o{ TIME_ENTRY : "logged against"
    USER ||--o{ TIME_ENTRY : records
```

### Rate storage: derive, don't duplicate (until finalized)

The rate that applies to a given hour is **derived** from the project's billing method at read time — it is not copied onto every time entry. The one deliberate exception is invoicing: when an invoice is **finalized**, the rates and amounts are **snapshotted onto the invoice**, because a sent invoice is an immutable financial record that must not change if a project's rate is edited later. That stored copy is justified by a real need (historical accuracy), not convenience. Detail lives in the Invoicing section.

## 3. Time tracking

The daily-use feature. Design goal: minimal friction to log an hour, because that is what makes or breaks adoption.

### The time entry, and what a "running timer" really is

A **time entry** captures: date, the project↔task assignment it belongs to, a duration, a free-text note, and its owner. A running timer is not a separate concept — it is a time entry in an **open** state:

- **Running (open):** the entry keeps a start timestamp so the UI can show elapsed time counting up live. This timestamp is timer plumbing, not a user-facing audit record.
- **Stopped (closed):** on stop, elapsed time collapses into a plain stored **duration**; the start timestamp is no longer needed. Manual entries are created closed, with the duration typed directly.

This means "live tracking" and "manual entry" are the same entity in two states, not two systems.

### Ways to log time (both supported)

- **Live timer** — start/stop for real-time work; the headline demo feature.
- **Manual entry** — type project, task, hours, and a note after the fact, for forgotten or estimated time.

### Timesheet views (both supported)

- **Day view** — one day's entries as an editable list, navigate day to day. The default, fast to read.
- **Weekly grid** — a projects×days grid for the week, good for reviewing and bulk entry.

### Single running timer — a policy, not a schema constraint

The POC enforces **at most one running timer** per user (starting a new one stops the current one), matching Harvest and preventing accidental double-billing. This rule is enforced in the **application/business layer**, deliberately **not** as a database uniqueness constraint — so switching to multiple concurrent timers later is a policy change, not a data migration. ("Design for multi-user, build for one" applied to timer concurrency.)

### Assumptions (sensible defaults, revisit if wrong)

- Time entries are **editable and deletable** after creation.
- Duration is stored at fine precision and **displayed as decimal hours** (e.g. `1.5h`); `h:mm` display can be added later.
- **No automatic rounding rules** in the POC (Harvest has configurable rounding; deferred).

<!-- Sections 4–6 added as the interview progresses. -->
