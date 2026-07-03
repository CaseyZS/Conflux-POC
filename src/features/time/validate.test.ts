import { describe, expect, it } from "vitest";
import { parseTimeEntryInput } from "./validate";

describe("parseTimeEntryInput", () => {
  it("accepts a complete manual entry", () => {
    const result = parseTimeEntryInput({
      date: "2026-07-02",
      hours: "1.5",
      note: "  Sprint planning  ",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        date: "2026-07-02",
        durationSeconds: 5400,
        note: "Sprint planning",
      },
    });
  });

  it("normalizes an empty note to null", () => {
    const result = parseTimeEntryInput({
      date: "2026-07-02",
      hours: "8",
      note: "   ",
    });
    expect(result).toEqual({
      ok: true,
      data: { date: "2026-07-02", durationSeconds: 28800, note: null },
    });
  });

  it("accepts a future date — the warn-and-acknowledge lives in the form", () => {
    const result = parseTimeEntryInput({
      date: "2099-01-01",
      hours: "1",
      note: null,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects malformed or missing dates", () => {
    for (const date of ["not-a-day", "2026-02-30", "", undefined]) {
      const result = parseTimeEntryInput({ date, hours: "1", note: null });
      expect(result).toEqual({
        ok: false,
        errors: { date: "Enter a valid date." },
      });
    }
  });

  it("rejects unparseable, zero, and over-a-day hours", () => {
    const cases: [string, string][] = [
      ["nope", "Enter time like 1:30 or 1.5."],
      ["", "Enter time like 1:30 or 1.5."],
      ["0", "Enter more than zero hours."],
      ["0:00", "Enter more than zero hours."],
      ["24:15", "One entry can't be more than 24 hours."],
      ["24.25", "One entry can't be more than 24 hours."],
    ];
    for (const [hours, message] of cases) {
      const result = parseTimeEntryInput({
        date: "2026-07-02",
        hours,
        note: null,
      });
      expect(result).toEqual({ ok: false, errors: { hours: message } });
    }
  });

  it("allows exactly 24 hours", () => {
    const result = parseTimeEntryInput({
      date: "2026-07-02",
      hours: "24",
      note: null,
    });
    expect(result).toEqual({
      ok: true,
      data: { date: "2026-07-02", durationSeconds: 86400, note: null },
    });
  });

  it("collects errors across fields", () => {
    const result = parseTimeEntryInput({ date: "bad", hours: "bad" });
    expect(result).toEqual({
      ok: false,
      errors: {
        date: "Enter a valid date.",
        hours: "Enter time like 1:30 or 1.5.",
      },
    });
  });
});
