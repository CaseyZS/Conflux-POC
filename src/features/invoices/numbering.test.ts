import { describe, expect, it } from "vitest";
import {
  formatInvoiceNumber,
  invoiceNumberValue,
  nextInvoiceNumberValue,
  splitInvoiceNumber,
} from "./numbering";

describe("formatInvoiceNumber", () => {
  it("pads to four digits under the org prefix", () => {
    expect(formatInvoiceNumber("INV-", 1)).toBe("INV-0001");
    expect(formatInvoiceNumber("INV-", 42)).toBe("INV-0042");
    expect(formatInvoiceNumber("ACME/", 999)).toBe("ACME/0999");
  });

  it("never truncates past the pad width", () => {
    expect(formatInvoiceNumber("INV-", 12345)).toBe("INV-12345");
  });
});

describe("invoiceNumberValue", () => {
  it("reads the numeric tail regardless of prefix", () => {
    expect(invoiceNumberValue("INV-0007")).toBe(7);
    expect(invoiceNumberValue("2026-014")).toBe(14);
    expect(invoiceNumberValue("ACME/0999")).toBe(999);
  });

  it("is null for a number with no trailing digits", () => {
    expect(invoiceNumberValue("DRAFT")).toBeNull();
    expect(invoiceNumberValue("")).toBeNull();
  });
});

describe("nextInvoiceNumberValue", () => {
  it("is one past the highest tail among existing numbers", () => {
    expect(nextInvoiceNumberValue(["INV-0001", "INV-0002", "INV-0005"])).toBe(
      6,
    );
  });

  it("ignores nulls and non-numeric labels, and starts at 1 when empty", () => {
    expect(nextInvoiceNumberValue([])).toBe(1);
    expect(nextInvoiceNumberValue([null, "CUSTOM"])).toBe(1);
    expect(nextInvoiceNumberValue([null, "INV-0003", "CUSTOM"])).toBe(4);
  });
});

describe("splitInvoiceNumber", () => {
  it("separates the fixed prefix from the editable digits", () => {
    expect(splitInvoiceNumber("INV-0002")).toEqual({
      prefix: "INV-",
      seq: "0002",
    });
    expect(splitInvoiceNumber("ACME/0999")).toEqual({
      prefix: "ACME/",
      seq: "0999",
    });
  });

  it("yields an empty seq when there are no trailing digits", () => {
    expect(splitInvoiceNumber("DRAFT")).toEqual({ prefix: "DRAFT", seq: "" });
  });
});
