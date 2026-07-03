import { describe, expect, it } from "vitest";
import { parseAssignmentInput, parseProjectInput } from "./validate";

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

describe("parseAssignmentInput", () => {
  it("billable assignment on a per-task project requires a rate", () => {
    const result = parseAssignmentInput(
      { billable: "on", hourlyRate: "95.00" },
      "USD",
      true,
    );
    expect(result).toEqual({
      ok: true,
      data: { billable: true, hourlyRateMinor: 9500 },
    });
  });

  it("rejects a missing rate when the project prices per task", () => {
    const result = parseAssignmentInput(
      { billable: "on", hourlyRate: "" },
      "USD",
      true,
    );
    expect(result).toEqual({
      ok: false,
      errors: { hourlyRate: "Enter an hourly rate greater than zero." },
    });
  });

  it("rejects a zero rate (that's what non-billable is for)", () => {
    const result = parseAssignmentInput(
      { billable: "on", hourlyRate: "0.00" },
      "USD",
      true,
    );
    expect(result.ok).toBe(false);
  });

  it("non-billable assignment needs no rate and normalizes one away", () => {
    const result = parseAssignmentInput(
      { billable: null, hourlyRate: "95.00" },
      "USD",
      true,
    );
    expect(result).toEqual({
      ok: true,
      data: { billable: false, hourlyRateMinor: null },
    });
  });

  it("on a non-per-task project a stale rate normalizes to null", () => {
    const result = parseAssignmentInput(
      { billable: "on", hourlyRate: "95.00" },
      "USD",
      false,
    );
    expect(result).toEqual({
      ok: true,
      data: { billable: true, hourlyRateMinor: null },
    });
  });

  it("parses the rate with the client currency's exponent", () => {
    const result = parseAssignmentInput(
      { billable: "on", hourlyRate: "5000" },
      "JPY",
      true,
    );
    expect(result.ok && result.data.hourlyRateMinor).toBe(5000);
  });
});
