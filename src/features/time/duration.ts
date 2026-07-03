// Durations mirror the money discipline (G4): integer seconds in the data,
// decimal hours only at the display/input boundary — and the boundary math is
// integer math (hundredths of an hour), so no float ever touches a duration.

// The shared core: seconds → decimal-hours digits ("1.5", "1.25", "8"),
// rounded to two decimals, trailing zeros trimmed. This is also the string a
// form input expects when editing, so parseHoursToSeconds(formatHoursInput(x))
// round-trips to within rounding.
export function formatHoursInput(durationSeconds: number): string {
  const hundredths = Math.round(durationSeconds / 36); // 1h = 100 hundredths
  const whole = Math.trunc(hundredths / 100);
  const fraction = String(hundredths % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

// 5400 → "1.5h", 4500 → "1.25h", 3600 → "1h" — decimal hours per
// docs/requirements/time-tracking.md.
export function formatHours(durationSeconds: number): string {
  return `${formatHoursInput(durationSeconds)}h`;
}

// The inverse for form input: a decimal-hours string ("1.5", ".25", "8",
// optionally with an "h" suffix) → integer seconds, or null if it isn't a
// clean non-negative duration. Digit-string math like parseMoneyToMinor — no
// parseFloat. Two decimals max: that's the display granularity (hundredths of
// an hour = 36-second steps), so finer input is a typo, not something to
// round away silently. Range rules (zero, day caps) belong to validation.
export function parseHoursToSeconds(input: string): number | null {
  const match = /^(\d{1,3})?(?:\.(\d{1,2}))?h?$/.exec(input.trim());
  if (!match) return null;

  const [, whole, fraction] = match;
  if (whole === undefined && fraction === undefined) return null;

  const hundredths = Number((fraction ?? "").padEnd(2, "0") || 0);
  return Number(whole ?? 0) * 3600 + hundredths * 36;
}
