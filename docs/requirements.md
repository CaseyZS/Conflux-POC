# Conflux — Requirements (Proof of Concept)

Conflux is a self-built alternative to [Harvest](https://www.getharvest.com/): a web app for tracking time against client projects and turning those hours into professional invoices. This document captures the requirements for the **proof-of-concept (POC)** milestone. It is built up interactively and will grow as decisions are made.

## Progress

Interview-driven requirements gathering. Each round produces one section below.

| #   | Section              | Status         |
| --- | -------------------- | -------------- |
| 1   | Framing & scope      | ✅ Done        |
| 2   | Clients & projects   | ⬜ Not started |
| 3   | Time tracking        | ⬜ Not started |
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

<!-- Sections 2–6 added as the interview progresses. -->
