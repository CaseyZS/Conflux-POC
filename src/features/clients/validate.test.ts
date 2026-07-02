import { describe, expect, it } from "vitest";
import { parseClientInput } from "./validate";

describe("parseClientInput", () => {
  it("accepts a full valid input and trims every field", () => {
    const result = parseClientInput({
      name: "  Acme Corporation  ",
      contactPerson: " Jane Porter ",
      email: " ap@acme.test ",
      billingAddress: " 42 Industrial Way\nSpringfield, IL ",
      currency: " usd ",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        name: "Acme Corporation",
        contactPerson: "Jane Porter",
        email: "ap@acme.test",
        billingAddress: "42 Industrial Way\nSpringfield, IL",
        currency: "USD",
      },
    });
  });

  it("turns empty optional fields into null", () => {
    const result = parseClientInput({
      name: "Acme",
      contactPerson: "",
      email: "",
      billingAddress: "   ",
      currency: "USD",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.contactPerson).toBeNull();
    expect(result.data.email).toBeNull();
    expect(result.data.billingAddress).toBeNull();
  });

  it("requires a non-blank name", () => {
    for (const name of ["", "   ", undefined, null]) {
      const result = parseClientInput({ name, currency: "USD" });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.errors.name).toBeDefined();
    }
  });

  it("rejects a malformed email but allows a missing one", () => {
    const bad = parseClientInput({
      name: "Acme",
      email: "not-an-email",
      currency: "USD",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.email).toBeDefined();

    const absent = parseClientInput({ name: "Acme", currency: "USD" });
    expect(absent.ok).toBe(true);
  });

  it("normalizes currency to uppercase and rejects non-ISO shapes", () => {
    const ok = parseClientInput({ name: "Acme", currency: "eur" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data.currency).toBe("EUR");

    for (const currency of ["US", "DOLLARS", "U$D", "", undefined]) {
      const result = parseClientInput({ name: "Acme", currency });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.errors.currency).toBeDefined();
    }
  });

  it("treats non-string values (e.g. an uploaded File) as absent", () => {
    const result = parseClientInput({
      name: new Blob(["x"]),
      email: 42,
      currency: { toString: () => "USD" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeDefined();
    expect(result.errors.currency).toBeDefined();
  });

  it("collects errors across fields in one pass", () => {
    const result = parseClientInput({
      name: "",
      email: "nope",
      currency: "x",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "currency",
      "email",
      "name",
    ]);
  });
});
