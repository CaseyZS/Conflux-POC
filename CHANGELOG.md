# Changelog

All notable user-facing changes to Conflux. Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-07-03

### Added

- Sign in / sign out with the seeded demo account (`admin@conflux.test`); logged-out visitors are redirected to the sign-in page.
- App shell: sidebar navigation (Dashboard, Clients) showing the organization and signed-in user, with sign-out.
- Clients: list of active clients and a "New client" dialog (name, contact person, email, billing address, currency pre-filled from the organization default).
- Clients: detail page (linked from the list) with an Edit dialog and Archive/Unarchive; archived clients leave the active list but stay reachable under an "Archived" section, keeping their history.
- Projects: a client's page lists its projects with create/edit dialogs — billing type (hourly, fixed fee, or non-billable), the hourly rate source (one project rate or per-task rates; per-person and flat shown as coming soon), and the rate or fee in the client's currency — plus per-project Archive/Unarchive.
- Tasks: an org-wide task list page (in the sidebar) with create/edit dialogs — name and a billable-by-default flag — plus Archive/Unarchive; duplicate names are rejected with a clear message.
- Projects: a detail page (linked from the client) with the project's billing summary, edit and Archive/Unarchive, and its assigned tasks: assign from the org task list (billability pre-filled from the task's default, overridable per assignment; an hourly rate per task when the project prices per task), edit assignments, and Retire/Reactivate without losing history.
- Demo data: two sample clients (Acme Corporation in USD, Globex GmbH in EUR), four projects covering every billing shape (hourly with a project rate, hourly with per-task rates, fixed fee, non-billable), a starter task list, and task assignments with mixed billability and rates — including one retired assignment.
- Time: a day-view timesheet (Time in the sidebar) — browse any day (prev/next/Today), log time against an assigned task via a project → task picker with a duration and note, edit or delete entries, and see the day's total; logging on a future date asks to be acknowledged first. Whether time is billable is shown as it comes from the assignment.
- Time: a live timer — start one fresh or resume an earlier entry; starting a timer stops the one already running (only one runs at a time), the elapsed time ticks live in the day view and in an always-visible sidebar widget, and stopping folds the time into the entry. Resuming an entry from an earlier day offers a fresh entry for today (encouraged) or continuing the original; resuming one from today just continues it.
- Time: a weekly grid (Day | Week tabs on both views) — one row per assigned task with an editable cell per day (type to add time, edit to change it, clear to remove it), row/day/week totals, and an "Add row" picker for bulk entry. Days that need more care — several entries, a running timer, or invoiced time — show a read-only total that links to the day view; entering time on a future day asks for a confirming second Enter.
- Durations display as hours:minutes (2:30) everywhere; duration inputs accept both 1:30 and decimal 1.5.
- Demo data: a working week of time entries across the sample projects — re-seeding slides it onto the current week, so today always has entries.
- Projects: an org-wide index (Projects in the sidebar) listing every project across clients with its client and billing summary, linking to the project and client pages; archived projects stay reachable under an "Archived" section.
- Invoices: an Invoices section (in the sidebar) listing every invoice with its number, client, status (Draft / Sent / Paid), issue date, and total — drafts show their live running total.
- Invoices: create a draft by picking a client and which of its projects feed it — unbilled hourly time (each project shows its unbilled hours) and one-time fixed fees; the selection stays editable on the draft.
- Invoices: a draft editor whose time lines are derived live from unbilled billable hours — grouped by task, by person (split by rate), as a single summary line, or one line per entry — with optional date / person / task / note detail on the lines, and manual lines (description, quantity, unit price, optional project) alongside.
- Invoices: draft settings — issue date (empty = day of finalizing), payment terms with a derived-but-overridable due date, client PO number, a percent or flat discount, a single tax applied after the discount, and a footer. Every amount rounds per line, half-up, so the printed lines always sum to the total.
- Invoices: Finalize turns the draft into the invoice in one step — it freezes the invoice number, amounts, bill-to, and company details as they are, and links the billed time entries and fixed fees so they can never be invoiced twice. A sent invoice can be marked Paid. Drafts can be deleted; finalized invoices can't be changed.
- Time: entries that are on an invoice show as Billed and can no longer be edited, deleted, or resumed (the weekly grid already showed them locked).
- Demo data: a paid invoice INV-0001 over a finished "Brand Refresh" project, and an open draft over the demo week's unbilled time with a manual line, tax, and PO number.
- Invoices: a finalized invoice now renders as a polished, print-ready document — company header, bill-to, an itemized table, totals, and a Paid/Sent stamp — instead of the working editor's layout (drafts keep the editor).
- Invoices: a "Download PDF" button on finalized invoices produces a paper-ready A4 PDF of that same document.
- Invoices: an optional subject line, shown just above the line-items table (set in the draft's settings).
- Invoices: payment terms display in standard net-terms language ("NET30", or "Due on receipt" for zero-day terms) instead of "30 days".
- Invoices: when a line item shows its date, the date now leads the line in YYYY/MM/DD format.
- Invoices: a "Preview" button on drafts opens the polished invoice document exactly as it will look — stamped DRAFT — so you can review it before finalizing.
- Invoices: the invoice number is now pre-filled on a new draft (one past the highest number on any existing invoice) and editable in the draft's settings — only the numeric part, with the prefix fixed — then frozen at finalize; numbers stay unique per organization.
- Invoices: a finalized invoice (sent or paid) that's wrong can be **Voided** — it stays on record marked Void with its number intact, and the time entries and fixed fees it billed are released back to the unbilled pool so you can issue a corrected invoice.
- Settings: an org Settings page (in the sidebar, for admins) to edit your business name, the invoice "from" block, and the defaults new clients and invoices start from — currency, tax, payment terms, invoice number prefix, and footer. The prefix field previews the next invoice number, which auto-increments from the highest used. Editing a default never changes an already-finalized invoice. (Logo upload is coming in a later update.)
- Settings: choose how time durations display across the timesheet — hours:minutes (2:30) or decimal hours (2.5h). The choice applies to the day view, the weekly grid, the running timer, and the unbilled-time hints when starting an invoice.
- Dashboard: the home screen is now a real dashboard — time tracked this week and today (ticking live while a timer runs), a running-timer indicator, open invoice drafts and invoices awaiting payment, quick links to common actions, and your most recent invoices. Every tile links straight to the screen it summarizes.
- Friendlier loading, error, and "not found" screens across the app, so a slow page shows a skeleton and an unexpected error offers a way back instead of a raw stack trace.
- Demo data: a finalized-but-unpaid invoice (Globex, ERP Migration fixed fee, €18,000.00) so the invoices list and the dashboard show all three lifecycle states — Draft, Sent, and Paid — in one sitting.
