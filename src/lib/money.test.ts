import { describe, expect, it } from "vitest";
import { formatMoney, minorUnitExponent } from "./money";

describe("minorUnitExponent", () => {
  it("defaults to 2 for common currencies", () => {
    expect(minorUnitExponent("USD")).toBe(2);
    expect(minorUnitExponent("EUR")).toBe(2);
  });

  it("knows zero- and three-decimal currencies", () => {
    expect(minorUnitExponent("JPY")).toBe(0);
    expect(minorUnitExponent("BHD")).toBe(3);
  });
});

describe("formatMoney", () => {
  it("formats USD minor units", () => {
    expect(formatMoney(180000, "USD")).toBe("$1,800.00");
    expect(formatMoney(5, "USD")).toBe("$0.05");
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("handles negative amounts", () => {
    expect(formatMoney(-12550, "USD")).toBe("-$125.50");
  });

  it("respects non-2 exponents (no hardcoded ÷100)", () => {
    expect(formatMoney(1234, "JPY")).toBe("¥1,234");
    // Intl puts a non-breaking space (U+00A0) between code and number
    expect(formatMoney(1234, "BHD")).toBe("BHD" + String.fromCharCode(0xa0) + "1.234");
  });
});
