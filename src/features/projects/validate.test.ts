import { describe, expect, it } from "vitest";
import { parseProjectInput } from "./validate";

describe("parseProjectInput", () => {
  it("accepts hourly + per-project with a rate", () => {
    const result = parseProjectInput(
      {
        name: "  Website redesign  ",
        billingType: "hourly",
        billingMethod: "per_project",
        hourlyRate: "150.50",
      },
      "USD",
    );
    expect(result).toEqual({
      ok: true,
      data: {
        name: "Website redesign",
        billingType: "hourly",
        billingMethod: "per_project",
        hourlyRateMinor: 15050,
        fixedFeeMinor: null,
      },
    });
  });

  it("hourly + per-task carries no project rate, even if one is sent", () => {
    const result = parseProjectInput(
      {
        name: "Support retainer",
        billingType: "hourly",
        billingMethod: "per_task",
        hourlyRate: "150.00", // stale field from a type switch — ignored
      },
      "USD",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hourlyRateMinor).toBeNull();
    expect(result.data.billingMethod).toBe("per_task");
  });

  it("fixed fee parses the fee and drops hourly-only fields", () => {
    const result = parseProjectInput(
      {
        name: "Brand package",
        billingType: "fixed_fee",
        billingMethod: "per_project", // stale — fixed fee has no method
        fixedFee: "12,000",
      },
      "USD",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.fixedFeeMinor).toBe(1200000);
    expect(result.data.billingMethod).toBeNull();
    expect(result.data.hourlyRateMinor).toBeNull();
  });

  it("non-billable needs nothing beyond a name", () => {
    const result = parseProjectInput(
      { name: "Internal tooling", billingType: "non_billable" },
      "USD",
    );
    expect(result).toEqual({
      ok: true,
      data: {
        name: "Internal tooling",
        billingType: "non_billable",
        billingMethod: null,
        hourlyRateMinor: null,
        fixedFeeMinor: null,
      },
    });
  });

  it("requires a name", () => {
    const result = parseProjectInput(
      { name: "   ", billingType: "non_billable" },
      "USD",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeDefined();
  });

  it("rejects an unknown billing type (D13: the app validates the string enum)", () => {
    const result = parseProjectInput(
      { name: "X", billingType: "retainer" },
      "USD",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.billingType).toBeDefined();
  });

  it("hourly requires a billing method", () => {
    const result = parseProjectInput({ name: "X", billingType: "hourly" }, "USD");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.billingMethod).toBeDefined();
  });

  it("rejects modeled-but-unwired methods (D6: visible, disabled, refused)", () => {
    for (const billingMethod of ["per_person", "flat"]) {
      const result = parseProjectInput(
        { name: "X", billingType: "hourly", billingMethod },
        "USD",
      );
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.errors.billingMethod).toBe(
        "This rate source isn't available yet.",
      );
    }
  });

  it("per-project requires a positive, parseable rate", () => {
    for (const hourlyRate of [undefined, "", "0", "0.00", "-5", "abc"]) {
      const result = parseProjectInput(
        {
          name: "X",
          billingType: "hourly",
          billingMethod: "per_project",
          hourlyRate,
        },
        "USD",
      );
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.errors.hourlyRate).toBeDefined();
    }
  });

  it("fixed fee requires a positive, parseable amount", () => {
    const result = parseProjectInput(
      { name: "X", billingType: "fixed_fee", fixedFee: "0" },
      "USD",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.fixedFee).toBeDefined();
  });

  it("parses money against the client currency's exponent", () => {
    const yen = parseProjectInput(
      {
        name: "X",
        billingType: "hourly",
        billingMethod: "per_project",
        hourlyRate: "5000",
      },
      "JPY",
    );
    expect(yen.ok).toBe(true);
    if (yen.ok) expect(yen.data.hourlyRateMinor).toBe(5000);

    const tooPrecise = parseProjectInput(
      {
        name: "X",
        billingType: "hourly",
        billingMethod: "per_project",
        hourlyRate: "5000.50",
      },
      "JPY",
    );
    expect(tooPrecise.ok).toBe(false);
  });

  it("collects errors across fields in one pass", () => {
    const result = parseProjectInput(
      {
        name: "",
        billingType: "hourly",
        billingMethod: "per_project",
        hourlyRate: "nope",
      },
      "USD",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["hourlyRate", "name"]);
  });
});
