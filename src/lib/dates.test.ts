import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDayHeading,
  formatMonthDay,
  formatWeekday,
  formatWeekHeading,
  isIsoDate,
  localDayOf,
  todayLocal,
  weekOf,
} from "./dates";

describe("isIsoDate", () => {
  it("accepts a real YYYY-MM-DD day", () => {
    expect(isIsoDate("2026-07-02")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true); // leap day
  });

  it("rejects days that don't exist on the calendar", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2025-02-29")).toBe(false); // not a leap year
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
  });

  it("rejects anything that isn't strictly YYYY-MM-DD", () => {
    expect(isIsoDate("2026-7-2")).toBe(false);
    expect(isIsoDate("02-07-2026")).toBe(false);
    expect(isIsoDate("2026-07-02T10:00")).toBe(false);
    expect(isIsoDate("not-a-day")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("localDayOf", () => {
  // The D11 property the timer relies on: the day is read from the local
  // clock at one instant — an entry started at 23:59 belongs to that day,
  // however long it runs past midnight.
  it("keeps a near-midnight instant on its own local day", () => {
    expect(localDayOf(new Date(2026, 6, 2, 23, 59))).toBe("2026-07-02");
    expect(localDayOf(new Date(2026, 6, 3, 0, 1))).toBe("2026-07-03");
  });

  it("pads single-digit months and days", () => {
    expect(localDayOf(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
  });

  it("todayLocal returns a valid day string", () => {
    expect(isIsoDate(todayLocal())).toBe(true);
  });
});

describe("addDays", () => {
  it("steps forward and back", () => {
    expect(addDays("2026-07-02", 1)).toBe("2026-07-03");
    expect(addDays("2026-07-02", -1)).toBe("2026-07-01");
    expect(addDays("2026-07-02", 0)).toBe("2026-07-02");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // leap year
  });

  it("is immune to DST transitions (pure calendar math)", () => {
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09"); // US spring-forward
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02"); // US fall-back
  });

  it("throws on a malformed day", () => {
    expect(() => addDays("garbage", 1)).toThrow();
  });
});

describe("weekOf", () => {
  it("returns the Monday-start week containing the day", () => {
    expect(weekOf("2026-07-02")).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);
  });

  it("a Monday starts its own week; a Sunday ends the previous Monday's", () => {
    expect(weekOf("2026-06-29")[0]).toBe("2026-06-29");
    expect(weekOf("2026-07-05")[0]).toBe("2026-06-29");
  });

  it("spans a year boundary", () => {
    expect(weekOf("2026-01-01")).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ]);
  });
});

describe("formatDayHeading", () => {
  it("formats the en-US long heading", () => {
    expect(formatDayHeading("2026-07-02")).toBe("Thursday, July 2, 2026");
    expect(formatDayHeading("2026-01-01")).toBe("Thursday, January 1, 2026");
  });
});

describe("weekly grid labels", () => {
  it("formats the column labels", () => {
    expect(formatWeekday("2026-06-29")).toBe("Mon");
    expect(formatWeekday("2026-07-05")).toBe("Sun");
    expect(formatMonthDay("2026-06-29")).toBe("Jun 29");
    expect(formatMonthDay("2026-07-05")).toBe("Jul 5");
  });

  // ICU range separators vary between plain and thin spaces across versions,
  // so assertions normalize all whitespace before comparing.
  const normalized = (first: string, last: string) =>
    formatWeekHeading(first, last).replace(/\s/g, " ");

  it("collapses the shared parts of a week heading", () => {
    expect(normalized("2026-06-29", "2026-07-05")).toBe(
      "June 29 – July 5, 2026",
    );
    expect(normalized("2026-07-06", "2026-07-12")).toBe("July 6 – 12, 2026");
  });

  it("spells out a year-spanning week", () => {
    expect(normalized("2025-12-29", "2026-01-04")).toBe(
      "December 29, 2025 – January 4, 2026",
    );
  });
});
