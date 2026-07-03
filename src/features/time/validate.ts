// Pure input validation for manual time entry (no framework imports).
// The assignment itself (projectTaskId) is validated in the action against
// the database — whether it exists, is active, and is on a live project is a
// data question, not a parsing one.
//
// A future date is deliberately NOT an error: the requirement is
// warn-and-acknowledge (docs/requirements/time-tracking.md), and the
// acknowledgment is a form affordance in the entry dialog, not a server rule.

import { isIsoDate } from "@/lib/dates";
import { parseHoursToSeconds } from "./duration";

// One manual entry tops out at a day: entries are per-calendar-day (D11), so
// more than 24h on one row is a typo, not a long day.
const MAX_ENTRY_SECONDS = 24 * 3600;

export type TimeEntryInput = {
  date: string;
  durationSeconds: number;
  note: string | null;
};

export type TimeEntryFieldErrors = Partial<
  Record<"projectTask" | "date" | "hours", string>
>;

export type TimeEntryInputResult =
  | { ok: true; data: TimeEntryInput }
  | { ok: false; errors: TimeEntryFieldErrors };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseTimeEntryInput(
  raw: Record<string, unknown>,
): TimeEntryInputResult {
  const errors: TimeEntryFieldErrors = {};

  const date = asTrimmedString(raw.date);
  if (!isIsoDate(date)) errors.date = "Enter a valid date.";

  let durationSeconds = 0;
  const parsed = parseHoursToSeconds(asTrimmedString(raw.hours));
  if (parsed === null) {
    errors.hours = "Enter hours as a decimal, like 1.5.";
  } else if (parsed === 0) {
    errors.hours = "Enter more than zero hours.";
  } else if (parsed > MAX_ENTRY_SECONDS) {
    errors.hours = "One entry can't be more than 24 hours.";
  } else {
    durationSeconds = parsed;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const note = asTrimmedString(raw.note);
  return {
    ok: true,
    data: { date, durationSeconds, note: note === "" ? null : note },
  };
}
