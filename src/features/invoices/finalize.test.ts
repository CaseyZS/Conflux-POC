import { describe, expect, it } from "vitest";
import { formatInvoiceNumber } from "./finalize";

// The transaction itself is exercised live (the seed finalizes through it,
// and the smoke asserts the links); what's unit-testable is the number
// format the gapless counter feeds.
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
