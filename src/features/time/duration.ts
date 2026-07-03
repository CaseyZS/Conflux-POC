// Durations mirror the money discipline (G4): integer seconds in the data,
// decimal hours only at the display/input boundary — and the boundary math is
// integer math (hundredths of an hour), so no float ever touches a duration.

// 5400 → "1.5h", 4500 → "1.25h", 3600 → "1h" — decimal hours per
// docs/requirements/time-tracking.md, rounded to two decimals, trailing
// zeros trimmed.
export function formatHours(durationSeconds: number): string {
  const hundredths = Math.round(durationSeconds / 36); // 1h = 100 hundredths
  const whole = Math.trunc(hundredths / 100);
  const fraction = String(hundredths % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}h` : `${whole}h`;
}
