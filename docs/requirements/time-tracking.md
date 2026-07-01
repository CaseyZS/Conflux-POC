# Time tracking

_Part of the [Conflux requirements](../requirements.md). Builds on the [data model](./data-model.md)._

The daily-use feature. Design goal: minimal friction to log an hour, because that is what makes or breaks adoption.

## The time entry, and what a "running timer" really is

A **time entry** captures: date, the project↔task assignment it belongs to, a duration, a free-text note, and the **member** (user-in-org) who logged it. A running timer is not a separate concept — it is a time entry in an **open** state:

- **Running (open):** the entry keeps a start timestamp so the UI can show elapsed time counting up live. This timestamp is timer plumbing, not a user-facing audit record.
- **Stopped (closed):** on stop, elapsed time collapses into a plain stored **duration**; the start timestamp is no longer needed. Manual entries are created closed, with the duration typed directly.

This means "live tracking" and "manual entry" are the same entity in two states, not two systems.

## Ways to log time (both supported)

- **Live timer** — start/stop for real-time work; the headline demo feature.
- **Manual entry** — type project, task, hours, and a note after the fact, for forgotten or estimated time.

## Timesheet views (both supported)

- **Day view** — one day's entries as an editable list, navigate day to day. The default, fast to read.
- **Weekly grid** — a projects×days grid for the week, good for reviewing and bulk entry.

## Single running timer — a policy, not a schema constraint

The POC enforces **at most one running timer** per user (starting a new one stops the current one), matching Harvest and preventing accidental double-billing. This rule is enforced in the **application/business layer**, deliberately **not** as a database uniqueness constraint — so switching to multiple concurrent timers later is a policy change, not a data migration. ("Design for multi-user, build for one" applied to timer concurrency.)

## Assumptions (sensible defaults, revisit if wrong)

- Time entries are **editable and deletable** after creation.
- Duration is stored as **integer seconds** (fine precision, mirroring the money-as-integer discipline) and **displayed as decimal hours** (e.g. `1.5h`); `h:mm` display can be added later.
- **No automatic rounding rules** in the POC (Harvest has configurable rounding; deferred).
- **Single timezone.** The POC assumes one timezone (the organization's, effectively the server's); an entry's **date** is the calendar date in that zone, and a timer running past midnight is recorded against its **start** date. Per-user timezones are a hosted-multi-user concern, deferred.
- **Billability is derived, not per-entry.** Whether an entry is billable comes from its project↔task assignment (which overrides the task default), not a flag typed on each entry. A per-entry override (as Harvest allows) is an additive change later.
