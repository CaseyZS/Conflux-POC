import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatMoneyInput,
  minorUnitExponent,
  parseMoneyToMinor,
} from "./money";

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

describe("parseMoneyToMinor", () => {
  it("parses plain and decimal amounts into minor units", () => {
    expect(parseMoneyToMinor("150", "USD")).toBe(15000);
    expect(parseMoneyToMinor("150.5", "USD")).toBe(15050);
    expect(parseMoneyToMinor("150.50", "USD")).toBe(15050);
    expect(parseMoneyToMinor("0", "USD")).toBe(0);
  });

  it("tolerates whitespace and thousands commas", () => {
    expect(parseMoneyToMinor(" 1,800.00 ", "USD")).toBe(180000);
  });

  it("round-trips with formatMoney on an awkward float", () => {
    // 19.99 is inexact in binary floating point; digit-string math avoids it
    expect(parseMoneyToMinor("19.99", "USD")).toBe(1999);
    expect(formatMoney(parseMoneyToMinor("19.99", "USD")!, "USD")).toBe(
      "$19.99",
    );
  });

  it("respects the currency exponent", () => {
    expect(parseMoneyToMinor("1234", "JPY")).toBe(1234);
    expect(parseMoneyToMinor("1.234", "BHD")).toBe(1234);
    expect(parseMoneyToMinor("1.2", "JPY")).toBeNull(); // yen has no decimals
    expect(parseMoneyToMinor("1.999", "USD")).toBeNull(); // too precise: error, not silent rounding
  });

  it("rejects anything that is not a clean non-negative amount", () => {
    for (const input of ["", "  ", "-5", "$5", "1.2.3", "abc", "1e3", "."]) {
      expect(parseMoneyToMinor(input, "USD")).toBeNull();
    }
  });
});

describe("formatMoneyInput", () => {
  it("renders a plain decimal string per the currency exponent", () => {
    expect(formatMoneyInput(15050, "USD")).toBe("150.50");
    expect(formatMoneyInput(15000, "USD")).toBe("150.00");
    expect(formatMoneyInput(5000, "JPY")).toBe("5000");
    expect(formatMoneyInput(1234, "BHD")).toBe("1.234");
  });

  it("round-trips with parseMoneyToMinor", () => {
    for (const minor of [0, 1, 99, 15050, 1200000]) {
      expect(parseMoneyToMinor(formatMoneyInput(minor, "USD"), "USD")).toBe(
        minor,
      );
    }
  });
});
