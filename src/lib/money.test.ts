import { describe, expect, it } from "vitest";
import {
  divRoundHalfUp,
  formatMoney,
  formatMoneyInput,
  invoiceTotals,
  lineAmountMinor,
  minorUnitExponent,
  parseMoneyToMinor,
  percentOfBps,
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

describe("divRoundHalfUp", () => {
  it("rounds exact halves up, below-half down", () => {
    expect(divRoundHalfUp(5, 10)).toBe(1); // 0.5 → 1
    expect(divRoundHalfUp(4, 10)).toBe(0); // 0.4 → 0
    expect(divRoundHalfUp(15, 10)).toBe(2); // 1.5 → 2
    expect(divRoundHalfUp(14, 10)).toBe(1);
  });

  it("rounds half away from zero for negatives", () => {
    expect(divRoundHalfUp(-5, 10)).toBe(-1);
    expect(divRoundHalfUp(-4, 10)).toBe(0);
    expect(divRoundHalfUp(-15, 10)).toBe(-2);
  });

  it("handles odd denominators (no float shortcuts)", () => {
    expect(divRoundHalfUp(10, 3)).toBe(3); // 3.33…
    expect(divRoundHalfUp(11, 3)).toBe(4); // 3.66…
    expect(divRoundHalfUp(3, 2)).toBe(2); // 1.5
  });

  it("refuses non-integer input", () => {
    expect(() => divRoundHalfUp(1.5, 1)).toThrow();
    expect(() => divRoundHalfUp(1, 0.5)).toThrow();
  });
});

describe("lineAmountMinor", () => {
  it("multiplies milli-quantity by minor rate (12.5h × $150 = $1,875)", () => {
    expect(lineAmountMinor(12500, 15000)).toBe(187500);
  });

  it("rounds an odd rate half-up per line", () => {
    // 1.5h × $33.33 = $49.995 → $50.00
    expect(lineAmountMinor(1500, 3333)).toBe(5000);
    // 0.333h (20 min) × $99.99 = $33.2967 → $33.30
    expect(lineAmountMinor(333, 9999)).toBe(3330);
  });

  it("treats a manual line's count of 1 as quantity 1000", () => {
    expect(lineAmountMinor(1000, 4200)).toBe(4200);
  });
});

describe("percentOfBps", () => {
  it("computes the 8.25% tax case half-up", () => {
    // $123.45 × 8.25% = $10.184625 → $10.18
    expect(percentOfBps(12345, 825)).toBe(1018);
    // $90.00 × 8.25% = $7.425 → exact half rounds up to $7.43
    expect(percentOfBps(9000, 825)).toBe(743);
  });

  it("is exact for round percentages", () => {
    expect(percentOfBps(10000, 1000)).toBe(1000); // 10%
    expect(percentOfBps(10000, 10000)).toBe(10000); // 100%
    expect(percentOfBps(10000, 0)).toBe(0);
  });
});

describe("invoiceTotals", () => {
  it("sums rounded lines into the subtotal (never re-derives)", () => {
    const totals = invoiceTotals([5000, 3330, 187500], {});
    expect(totals.subtotalMinor).toBe(195830);
    expect(totals.discountMinor).toBe(0);
    expect(totals.taxMinor).toBe(0);
    expect(totals.totalMinor).toBe(195830);
  });

  it("applies discount before tax (the ordering case)", () => {
    // $100.00 − 10% = $90.00; 8.25% of $90.00 = $7.425 → $7.43
    const totals = invoiceTotals([10000], {
      discountPercentBps: 1000,
      taxRateBps: 825,
    });
    expect(totals.discountMinor).toBe(1000);
    expect(totals.taxMinor).toBe(743);
    expect(totals.totalMinor).toBe(9743);
  });

  it("takes a flat discount and clamps it to the subtotal", () => {
    const flat = invoiceTotals([10000], { discountFlatMinor: 2500 });
    expect(flat.discountMinor).toBe(2500);
    expect(flat.totalMinor).toBe(7500);

    // The live pool shrank below the stored flat discount: never negative.
    const clamped = invoiceTotals([500], {
      discountFlatMinor: 800,
      taxRateBps: 825,
    });
    expect(clamped.discountMinor).toBe(500);
    expect(clamped.totalMinor).toBe(0);
  });

  it("refuses percent and flat together (financial XOR)", () => {
    expect(() =>
      invoiceTotals([10000], { discountPercentBps: 500, discountFlatMinor: 1 }),
    ).toThrow();
  });

  it("keeps the lines-sum-to-total invariant in integers", () => {
    // Awkward lines from odd rates; the invariant is exact integer identity:
    // total = sum(lines) − discount + tax, no float ever involved.
    const lines = [3333, 6667, 1018, 743, 99999];
    const totals = invoiceTotals(lines, {
      discountPercentBps: 825,
      taxRateBps: 825,
    });
    const sum = lines.reduce((a, b) => a + b, 0);
    expect(totals.subtotalMinor).toBe(sum);
    expect(totals.totalMinor).toBe(
      totals.subtotalMinor - totals.discountMinor + totals.taxMinor,
    );
  });

  it("handles the empty draft (no lines yet)", () => {
    const totals = invoiceTotals([], { taxRateBps: 825 });
    expect(totals).toEqual({
      subtotalMinor: 0,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
    });
  });
});
