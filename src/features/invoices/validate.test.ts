import { describe, expect, it } from "vitest";
import { parseDraftSettings } from "./validate";

// A minimal valid settings payload; individual tests override `number`.
const base = { grouping: "task", paymentTermsDays: "30", number: "5" };
const parse = (raw: Record<string, unknown>) =>
  parseDraftSettings({ ...base, ...raw }, "USD", "INV-");

describe("parseDraftSettings — invoice number (numeric tail only)", () => {
  it("reconstructs the full number from the editable digits + org prefix", () => {
    const result = parse({ number: "5" });
    expect(result.ok && result.data.number).toBe("INV-0005");
  });

  it("pads and preserves the value the user typed", () => {
    expect(parse({ number: "12" }).ok && parse({ number: "12" }).data.number).toBe(
      "INV-0012",
    );
    // A padded input is read by value, then re-padded.
    const r = parse({ number: "0012" });
    expect(r.ok && r.data.number).toBe("INV-0012");
    // Beyond four digits, no truncation.
    const big = parse({ number: "12345" });
    expect(big.ok && big.data.number).toBe("INV-12345");
  });

  it("rejects non-digits, empties, and zero", () => {
    for (const number of ["", "abc", "12a", "INV-5", "-3", "0"]) {
      const result = parse({ number });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.number).toBeDefined();
    }
  });
});
