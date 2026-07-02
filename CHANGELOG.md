# Changelog

All notable user-facing changes to Conflux. Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added

- Sign in / sign out with the seeded demo account (`admin@conflux.test`); logged-out visitors are redirected to the sign-in page.
- App shell: sidebar navigation (Dashboard, Clients) showing the organization and signed-in user, with sign-out.
- Clients: list of active clients and a "New client" dialog (name, contact person, email, billing address, currency pre-filled from the organization default).
- Clients: detail page (linked from the list) with an Edit dialog and Archive/Unarchive; archived clients leave the active list but stay reachable under an "Archived" section, keeping their history.
- Projects: a client's page lists its projects with create/edit dialogs — billing type (hourly, fixed fee, or non-billable), the hourly rate source (one project rate or per-task rates; per-person and flat shown as coming soon), and the rate or fee in the client's currency — plus per-project Archive/Unarchive.
- Demo data: two sample clients (Acme Corporation in USD, Globex GmbH in EUR) seeded for the walkthrough.
