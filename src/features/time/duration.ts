// Durations mirror the money discipline (G4): integer seconds in the data,
// display strings only at the boundary — and the boundary math is integer
// math, so no float ever touches a duration.

// The default duration display: "H:MM" (2026-07-02 request), floored to whole
// minutes completed, hours uncapped (a forgotten timer can pass 24h), negatives
// clamped. One format for committed rows, totals, AND the live clock — floor
// (not round) so the total showing when a timer stops is exactly what gets
// frozen. The M5 settings page makes the format a preference; formatHours
// below is the decimal alternative it re-exposes.
export function formatDuration(durationSeconds: number): string {
  const minutes = Math.max(0, Math.floor(durationSeconds / 60));
  const h = Math.trunc(minutes / 60);
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// The decimal-hours form: seconds → digits ("1.5", "1.25", "8"), rounded to
// two decimals (hundredths of an hour), trailing zeros trimmed. Also a valid
// input form: parseDurationToSeconds(formatHoursInput(x)) round-trips to
// within rounding.
export function formatHoursInput(durationSeconds: number): string {
  const hundredths = Math.round(durationSeconds / 36); // 1h = 100 hundredths
  const whole = Math.trunc(hundredths / 100);
  const fraction = String(hundredths % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

// 5400 → "1.5h", 4500 → "1.25h", 3600 → "1h" — the decimal display, kept as
// the alternative for the M5 time-format setting.
export function formatHours(durationSeconds: number): string {
  return `${formatHoursInput(durationSeconds)}h`;
}

// The org's time-display preference (Settings, M5 seg 4): "hms" = "1:30",
// "decimal" = "1.5h". A bare string union so lib/authz can carry it on the
// Actor without importing this feature — the two literals must stay in step.
export type DurationFormat = "hms" | "decimal";

// The one dispatcher the timesheet views call so the H:MM-vs-decimal choice
// lives in a single branch: display a duration in the org's chosen format.
export function formatDurationAs(
  durationSeconds: number,
  format: DurationFormat,
): string {
  return format === "decimal"
    ? formatHours(durationSeconds)
    : formatDuration(durationSeconds);
}

// The input/prefill form of the same preference — no unit suffix, since
// parseDurationToSeconds round-trips either shape ("1:30" or "1.5"). Edit
// forms and the week grid's cells prefill with this so what you see is what
// you'd re-type.
export function formatDurationInputAs(
  durationSeconds: number,
  format: DurationFormat,
): string {
  return format === "decimal"
    ? formatHoursInput(durationSeconds)
    : formatDuration(durationSeconds);
}

// Whole seconds between two instants, floored and never negative. A running
// timer's live portion — the action collapses this into durationSeconds on
// stop, and the client tick adds it for display, so both use the same integer
// math (a clock skew that puts "now" before the start reads as 0, not
// negative). Epoch-ms in, so it works the same on the server (Date.getTime())
// and in the browser (Date.now()).
export function elapsedSeconds(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

// The inverse for form input, accepting both display forms: "H:MM" ("1:30",
// two-digit minutes 00–59) or decimal hours ("1.5", ".25", "8", optional "h"
// suffix) → integer seconds, or null if it's neither. Digit-string math like
// parseMoneyToMinor — no parseFloat. Decimal input tops out at two decimals:
// that's the display granularity (hundredths of an hour = 36-second steps),
// so finer input is a typo, not something to round away silently. Range rules
// (zero, day caps) belong to validation.
export function parseDurationToSeconds(input: string): number | null {
  const trimmed = input.trim();

  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(trimmed);
  if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60;

  const decimal = /^(\d{1,3})?(?:\.(\d{1,2}))?h?$/.exec(trimmed);
  if (!decimal) return null;

  const [, whole, fraction] = decimal;
  if (whole === undefined && fraction === undefined) return null;

  const hundredths = Number((fraction ?? "").padEnd(2, "0") || 0);
  return Number(whole ?? 0) * 3600 + hundredths * 36;
}
