import { describe, expect, it } from "vitest";
import {
  elapsedSeconds,
  formatDuration,
  formatHours,
  formatHoursInput,
  parseDurationToSeconds,
} from "./duration";

describe("formatDuration", () => {
  it("formats seconds as H:MM", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(60)).toBe("0:01");
    expect(formatDuration(3600)).toBe("1:00");
    expect(formatDuration(5400)).toBe("1:30");
    expect(formatDuration(27000)).toBe("7:30");
  });

  it("floors to whole minutes completed (the live clock relies on it)", () => {
    expect(formatDuration(59)).toBe("0:00");
    expect(formatDuration(119)).toBe("0:01");
    expect(formatDuration(3659)).toBe("1:00");
  });

  it("does not cap the hours (a forgotten timer keeps counting)", () => {
    expect(formatDuration(90_000)).toBe("25:00");
    expect(formatDuration(360_000)).toBe("100:00");
  });

  it("floors a fractional second and clamps negatives", () => {
    expect(formatDuration(65.9)).toBe("0:01");
    expect(formatDuration(-1)).toBe("0:00");
  });
});

describe("formatHours (the decimal alternative)", () => {
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

describe("parseDurationToSeconds", () => {
  it("parses H:MM to integer seconds", () => {
    expect(parseDurationToSeconds("1:30")).toBe(5400);
    expect(parseDurationToSeconds("0:45")).toBe(2700);
    expect(parseDurationToSeconds("0:00")).toBe(0);
    expect(parseDurationToSeconds("10:05")).toBe(36300);
    expect(parseDurationToSeconds(" 2:00 ")).toBe(7200); // whitespace
  });

  it("parses decimal hours to integer seconds", () => {
    expect(parseDurationToSeconds("1.5")).toBe(5400);
    expect(parseDurationToSeconds("1.25")).toBe(4500);
    expect(parseDurationToSeconds("8")).toBe(28800);
    expect(parseDurationToSeconds("0.75")).toBe(2700);
    expect(parseDurationToSeconds("0")).toBe(0);
    expect(parseDurationToSeconds(".5")).toBe(1800); // no leading zero
    expect(parseDurationToSeconds("1.5h")).toBe(5400); // display suffix
    expect(parseDurationToSeconds("0.1")).toBe(360); // one decimal = tenths
  });

  it("rejects what it can't represent exactly", () => {
    expect(parseDurationToSeconds("")).toBeNull();
    expect(parseDurationToSeconds("h")).toBeNull();
    expect(parseDurationToSeconds("abc")).toBeNull();
    expect(parseDurationToSeconds("-1")).toBeNull();
    expect(parseDurationToSeconds("1:5")).toBeNull(); // minutes are two digits
    expect(parseDurationToSeconds("1:60")).toBeNull(); // not a minute count
    expect(parseDurationToSeconds(":30")).toBeNull();
    expect(parseDurationToSeconds("1:30h")).toBeNull(); // suffix is decimal-only
    expect(parseDurationToSeconds("1.555")).toBeNull(); // finer than hundredths
    expect(parseDurationToSeconds("1.")).toBeNull();
    expect(parseDurationToSeconds("1000")).toBeNull(); // beyond three whole digits
  });

  it("round-trips both display forms", () => {
    for (const seconds of [0, 60, 3600, 5400, 27000, 86400, 90000]) {
      expect(parseDurationToSeconds(formatDuration(seconds))).toBe(seconds);
    }
    for (const seconds of [0, 36, 3600, 4500, 5400, 27000, 86400]) {
      expect(parseDurationToSeconds(formatHoursInput(seconds))).toBe(seconds);
    }
  });
});

describe("elapsedSeconds", () => {
  it("floors the whole seconds between two instants", () => {
    expect(elapsedSeconds(1000, 1000)).toBe(0);
    expect(elapsedSeconds(0, 5000)).toBe(5); // 5s
    expect(elapsedSeconds(0, 5999)).toBe(5); // partial second dropped
    expect(elapsedSeconds(0, 3_600_000)).toBe(3600); // 1h
  });

  it("never returns negative on clock skew", () => {
    expect(elapsedSeconds(5000, 0)).toBe(0);
  });
});
