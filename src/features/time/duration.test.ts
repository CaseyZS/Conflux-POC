import { describe, expect, it } from "vitest";
import {
  formatHours,
  formatHoursInput,
  parseHoursToSeconds,
} from "./duration";

describe("formatHours", () => {
  it("formats whole and fractional hours as decimal hours", () => {
    expect(formatHours(0)).toBe("0h");
    expect(formatHours(3600)).toBe("1h");
    expect(formatHours(5400)).toBe("1.5h");
    expect(formatHours(4500)).toBe("1.25h");
    expect(formatHours(27000)).toBe("7.5h");
    expect(formatHours(28800)).toBe("8h");
  });

  it("rounds to two decimals", () => {
    expect(formatHours(60)).toBe("0.02h"); // 1 min = 0.0167h
    expect(formatHours(30)).toBe("0.01h");
    expect(formatHours(17)).toBe("0h"); // below half a hundredth
    expect(formatHours(3599)).toBe("1h");
  });

  it("handles long durations", () => {
    expect(formatHours(360000)).toBe("100h");
    expect(formatHours(362700)).toBe("100.75h");
  });
});

describe("parseHoursToSeconds", () => {
  it("parses decimal hours to integer seconds", () => {
    expect(parseHoursToSeconds("1.5")).toBe(5400);
    expect(parseHoursToSeconds("1.25")).toBe(4500);
    expect(parseHoursToSeconds("8")).toBe(28800);
    expect(parseHoursToSeconds("0.75")).toBe(2700);
    expect(parseHoursToSeconds("0")).toBe(0);
  });

  it("accepts input-boundary variants", () => {
    expect(parseHoursToSeconds(" 2 ")).toBe(7200); // whitespace
    expect(parseHoursToSeconds(".5")).toBe(1800); // no leading zero
    expect(parseHoursToSeconds("1.5h")).toBe(5400); // display suffix
    expect(parseHoursToSeconds("0.1")).toBe(360); // one decimal = tenths
  });

  it("rejects what it can't represent exactly", () => {
    expect(parseHoursToSeconds("")).toBeNull();
    expect(parseHoursToSeconds("h")).toBeNull();
    expect(parseHoursToSeconds("abc")).toBeNull();
    expect(parseHoursToSeconds("-1")).toBeNull();
    expect(parseHoursToSeconds("1:30")).toBeNull(); // h:mm isn't decimal hours
    expect(parseHoursToSeconds("1.555")).toBeNull(); // finer than hundredths
    expect(parseHoursToSeconds("1.")).toBeNull();
    expect(parseHoursToSeconds("1000")).toBeNull(); // beyond three whole digits
  });

  it("round-trips formatHoursInput", () => {
    for (const seconds of [0, 36, 3600, 4500, 5400, 27000, 86400]) {
      expect(parseHoursToSeconds(formatHoursInput(seconds))).toBe(seconds);
    }
  });
});
