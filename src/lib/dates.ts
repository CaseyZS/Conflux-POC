// Dates seam (D11): a calendar day is a plain "YYYY-MM-DD" string from the
// user's local calendar — no time, no UTC conversion, so an evening entry
// never rolls into "tomorrow". All day arithmetic happens here, internally on
// UTC-constructed Dates so DST transitions can never shift a day. ISO day
// strings sort lexicographically in chronological order, so string comparison
// is date comparison.
//
// POC simplification: "user-local" is the server's local clock — self-hosted,
// the server is the user's machine. A per-user timezone preference is a
// deferred, hosted concern (docs/requirements/time-tracking.md).

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Strict "YYYY-MM-DD" check, including that the day actually exists on the
// calendar ("2026-02-30" fails the round-trip). The validation gate for any
// day string arriving from a URL or form.
export function isIsoDate(value: string): boolean {
  const match = ISO_DAY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  return (
    date.getUTCFullYear() === +y &&
    date.getUTCMonth() === +m - 1 &&
    date.getUTCDate() === +d
  );
}

function toUtcDate(day: string): Date {
  if (!isIsoDate(day)) throw new Error(`Not a calendar day: "${day}"`);
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The local calendar day an instant falls on. This is where a time entry's
// date comes from — computed once when a timer starts, so a timer spanning
// midnight keeps its start day (D11).
export function localDayOf(instant: Date): string {
  const y = String(instant.getFullYear()).padStart(4, "0");
  const m = String(instant.getMonth() + 1).padStart(2, "0");
  const d = String(instant.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayLocal(): string {
  return localDayOf(new Date());
}

export function addDays(day: string, delta: number): string {
  const date = toUtcDate(day);
  date.setUTCDate(date.getUTCDate() + delta);
  return fromUtcDate(date);
}

// The Monday-start week containing `day`, as 7 day strings (ISO 8601 weeks;
// a week-start preference can thread through later).
export function weekOf(day: string): string[] {
  const mondayOffset = (toUtcDate(day).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = addDays(day, -mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// "Thursday, July 2, 2026" — locale fixed to en-US like money.ts, formatted
// in UTC to match the UTC-constructed date so the day can't shift.
export function formatDayHeading(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUtcDate(day));
}

// "Mon" / "Jun 29" — the weekly grid's column labels, split so the grid can
// stack them. Same en-US + UTC conventions as formatDayHeading.
export function formatWeekday(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(toUtcDate(day));
}

export function formatMonthDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(toUtcDate(day));
}

// "2026/06/03" — the invoice line-item date format: ISO order, slashes. The
// stored day is already "YYYY-MM-DD", so this is a pure separator swap.
export function formatDaySlashes(day: string): string {
  return day.replace(/-/g, "/");
}

// "June 29 – July 5, 2026" — the weekly view's heading. formatRange collapses
// the shared parts, so month- and year-spanning weeks come out right
// ("December 29, 2025 – January 4, 2026") without any casework here.
export function formatWeekHeading(first: string, last: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).formatRange(toUtcDate(first), toUtcDate(last));
}
