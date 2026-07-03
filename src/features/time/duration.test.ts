import { describe, expect, it } from "vitest";
import { formatHours } from "./duration";

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
