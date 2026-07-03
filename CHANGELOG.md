# Changelog

All notable user-facing changes to Conflux. Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

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
