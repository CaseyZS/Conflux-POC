import { describe, expect, it } from "vitest";
import { parseOrgSettings } from "./validate";

// A minimal valid payload; individual tests override single fields.
const base = {
  name: "Conflux Demo Co.",
  fromDetails: "100 Demo Street",
  defaultCurrency: "usd",
  defaultTaxRate: "8.25",
  defaultPaymentTermsDays: "30",
  invoiceNumberPrefix: "INV-",
  invoiceFooter: "Thanks!",
};
const parse = (raw: Record<string, unknown>) =>
  parseOrgSettings({ ...base, ...raw });

describe("parseOrgSettings", () => {
  it("normalizes a valid payload (currency upper, tax → bps, empties → null)", () => {
    const result = parse({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        name: "Conflux Demo Co.",
        fromDetails: "100 Demo Street",
        defaultCurrency: "USD",
        defaultTaxRateBps: 825,
        defaultPaymentTermsDays: 30,
        invoiceNumberPrefix: "INV-",
        invoiceFooter: "Thanks!",
        timeDisplayFormat: "hms", // absent in the payload ⇒ the default
      });
    }
  });

  it("treats blank optional text as null and blank tax as no default", () => {
    const result = parse({
      fromDetails: "  ",
      invoiceFooter: "",
      defaultTaxRate: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fromDetails).toBeNull();
      expect(result.data.invoiceFooter).toBeNull();
      expect(result.data.defaultTaxRateBps).toBe(0);
    }
  });

  it("requires a business name", () => {
    const result = parse({ name: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBeDefined();
  });

  it("rejects a non-3-letter currency", () => {
    for (const defaultCurrency of ["US", "DOLLAR", "12A", ""]) {
      const result = parse({ defaultCurrency });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.defaultCurrency).toBeDefined();
    }
  });

  it("rejects an out-of-range tax percentage", () => {
    for (const defaultTaxRate of ["101", "8.255", "abc"]) {
      const result = parse({ defaultTaxRate });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.defaultTaxRate).toBeDefined();
    }
  });

  it("rejects non-numeric or oversized payment terms", () => {
    for (const defaultPaymentTermsDays of ["", "abc", "1000", "-5"]) {
      const result = parse({ defaultPaymentTermsDays });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.errors.defaultPaymentTermsDays).toBeDefined();
    }
  });

  it("takes the decimal time format and falls back to hms for anything else", () => {
    const decimal = parse({ timeDisplayFormat: "decimal" });
    expect(decimal.ok).toBe(true);
    if (decimal.ok) expect(decimal.data.timeDisplayFormat).toBe("decimal");

    for (const timeDisplayFormat of ["hms", "", "bogus", undefined]) {
      const result = parse({ timeDisplayFormat });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.timeDisplayFormat).toBe("hms");
    }
  });

  it("allows an empty prefix but rejects one ending in a digit or too long", () => {
    expect(parse({ invoiceNumberPrefix: "" }).ok).toBe(true);
    expect(parse({ invoiceNumberPrefix: "2026-" }).ok).toBe(true);
    for (const invoiceNumberPrefix of ["INV2", "0123456789012"]) {
      const result = parse({ invoiceNumberPrefix });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.invoiceNumberPrefix).toBeDefined();
    }
  });
});
