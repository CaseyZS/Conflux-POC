# Conflux — Demo Walkthrough

A scripted, ~10-minute tour that shows the whole product working end to end, from a seeded database to a finished PDF invoice. Follow it top to bottom for a stakeholder demo, or jump to a scene. Everything here runs against the demo seed — no data entry required to get started, though the script pauses to _create_ real data at the moments that land best.

## Before you start (one-time setup)

From the repo root:

```bash
npm install
npx prisma migrate dev      # create/upgrade the local SQLite database
npm run db:seed             # load the demo data
npm run dev                 # start the app at http://localhost:3000
```

Shortcut: after the one-time `install` / `migrate` / `seed` above, double-click **`dev.bat`** (repo root) to start the server and open `http://localhost:3000` in your browser once it's ready — it replaces the `npm run dev` step.

Sign-in (seeded demo admin, documented in `README.md`):

- **Email:** `admin@conflux.test`
- **Password:** `conflux-demo`

The admin holds every capability, so nothing is gated during the demo.

### Resetting between runs

The seed is **idempotent** and the demo week is **anchored to today** — re-running `npm run db:seed` slides the week of time entries onto the current week (so "today" always has entries) without disturbing already-finalized invoices. Re-seeding is the right reset for the timesheet.

If your demo _finalizes the draft invoice_ (Scene 6) and you want it back as a draft for the next run, do a full reset — this drops the database, re-migrates, and re-seeds from scratch:

```bash
npx prisma migrate reset
```

> Don't run `npm run build` while `npm run dev` is running — it corrupts the dev cache. Stop the dev server first if you need a production build.

## What's in the seed (your backdrop)

| Thing | Seeded data |
| --- | --- |
| **Organization** | Conflux Demo Co. (from-block: Austin, TX) |
| **Clients** | Acme Corporation (USD) · Globex GmbH (EUR) |
| **Projects** | Website Redesign (Acme, hourly $125/hr) · Mobile App (Acme, hourly, per-task rates) · ERP Migration (Globex, fixed fee €18,000) · Internal Support (Globex, non-billable) · Brand Refresh (Acme, billed history) |
| **Tasks** | Development · Design · Project Management · Internal Meeting (non-billable by default) |
| **Time** | A working week anchored to today (today carries two entries, 3:00 total) + billed history behind INV-0001 |
| **Invoices** | **INV-0001** Paid ($1,430.00, Acme) · **INV-0003** Sent / awaiting payment (€18,000.00, Globex) · **INV-0002** Draft (Acme — the one you finalize in Scene 6) |

## The walkthrough

### Scene 0 — Sign in

Open `http://localhost:3000`. Logged out, you're redirected to the sign-in page. Sign in with the demo credentials.

**Point out:** authentication guards the whole app; every screen you'll see is scoped to this one organization (multi-tenant by construction).

### Scene 1 — The dashboard

You land on the dashboard.

- **Tracked this week / Tracked today** — today reads **3:00** across two entries. If a timer is running, these tiles tick live.
- **Open drafts (1)** and **Awaiting payment (1)** — the invoice pipeline at a glance.
- **Recent invoices** — all three lifecycle states (Draft / Sent / Paid) in one list.
- Every tile is a link to the screen it summarizes.

**Point out:** this is the demo's front door — glance, then dive in. The figures are derived live from the same read layers each feature uses; nothing here is a separate cache.

### Scene 2 — Track time

Click **Tracked today** (or **Time** in the sidebar) to open the day view.

1. **The day view** shows today's entries with their project, task, note, billing status, and hours. Note the running total.
2. **Log an entry** — click **Log time**, pick a project → task (say _Website Redesign → Development_), enter `1:30` (or `1.5` — both parse), add a note, save. It appears immediately with billability derived from the assignment.
3. **The live timer** — click **Start timer**, pick a task, start. The elapsed time ticks in the day view _and_ in the always-visible sidebar widget. Stop it; the time folds into a real entry. (Only one timer runs at a time — starting a second stops the first.)
4. **The weekly grid** — switch to the **Week** tab. One row per task, one editable cell per day, with row/day/week totals. Type into a cell to add time; days with several entries or a running timer link back to the day view.

**Point out:** durations are stored as integer seconds and only ever _formatted_ for display — the same discipline the money uses. Which brings us to Settings.

### Scene 3 — The work structure

Use the sidebar to tour how work is organized.

- **Clients** — Acme (USD) and Globex (EUR). Open one to see its detail, edit, and archive (archived clients keep their history but leave the pickers).
- **Projects** — the org-wide index lists every project with its client and billing summary. Open **Mobile App** to show **per-task hourly rates**, or **ERP Migration** to show a **fixed fee** in euros. Every billing shape the product supports is represented.
- **Tasks** — the shared task list (name + billable-by-default). Assignments connect tasks to projects, with a per-assignment billable override and, where the project prices per task, a per-task rate.

**Point out:** rates and billing shapes all flow through one read layer, so a "who can see rates" rule stays a one-line addition later, not a refactor.

### Scene 4 — Settings & the time-display preference

Open **Settings** (sidebar, admin-only).

- Business name, the invoice **"From"** block, and the defaults new clients/invoices inherit — currency, tax, payment terms, invoice-number prefix (with a live **next-number preview**), and footer.
- **Time display** — switch it from **Hours:minutes (2:30)** to **Decimal hours (2.5h)** and save, then pop back to **Time**: every duration now reads in decimal. Switch it back if you prefer.

**Point out:** editing a default never rewrites an existing invoice — finalized invoices are snapshots (see Scene 6). (Logo upload is stubbed as "coming soon" — the storage and the invoice's logo-by-reference already exist to receive it.)

### Scene 5 — Invoices

Open **Invoices**.

- The list shows all three states: **INV-0001 Paid**, **INV-0003 Sent**, **INV-0002 Draft**. The draft shows its **live running total**; finalized invoices show their frozen total.
- Open **INV-0003** (Sent) to show a finished, EUR, fixed-fee invoice — then **Download PDF** to show the paper-ready output.
- Open **INV-0002** (the **Draft**). This is the editor:
  - **Time lines** are derived live from unbilled billable hours — change the **grouping** (by task / by person / summary / detailed) and the detail toggles (date / person / task / note) and watch the lines re-derive.
  - A **manual line** ("Stock photography license", $150) sits alongside the derived ones.
  - **Settings** on the draft: issue/due dates, a discount, an **8.25% tax**, a PO number, subject, footer.
  - Click **Preview** to see the polished document, stamped **DRAFT**, exactly as it will print.

**Point out:** the draft _derives_ everything; nothing is frozen yet. Finalizing is what turns it into a record.

### Scene 6 — Finalize & PDF (the finale)

Still on the **INV-0002** draft:

1. Click **Finalize**. In one step it freezes the invoice number, every amount, the bill-to and company details, and **links the billed time and fees so they can never be invoiced twice**. The draft becomes a **Sent** invoice.
2. Click **Download PDF** — the same styled document, now a paper-ready A4 PDF.
3. (Optional) **Mark as paid** to complete the lifecycle, or demonstrate **Void** as the correction path (it releases the billed time back to the unbilled pool for a corrected invoice).

**Point out:** go back to **Time** — the entries that fed the invoice now show as **Billed** and can't be edited. The anti-double-bill link is doing its job. That's the full loop: track time → turn it into money → hand over a professional PDF.

## Under the hood (if asked)

- **One document, two outputs** — the on-screen invoice and the PDF render from the same component; the PDF is that page printed by headless Chromium.
- **Derive until finalize** — a draft computes its totals, bill-to, and branding live; finalize snapshots them, so later edits to org/client defaults never rewrite history.
- **Integer money and time** — amounts are integer minor units and durations integer seconds; formatting happens only at the edge, so rounding is defined and testable (the invoice lines always sum to the total).
- **Multi-tenant by construction** — every query is org-scoped through one seam, and capabilities (not role names) gate every action.

See `docs/architecture.md` for the guardrails and decision log, and `docs/requirements.md` for the full feature set.
