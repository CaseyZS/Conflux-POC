// Pure input validation for the projects feature (no framework imports).
// This is where D6's two independent selectors become rules: billing *type*
// decides which other fields exist at all, billing *method* (hourly only)
// decides where the rate lives. Fields irrelevant to the chosen type are
// normalized to null, never errored — the form hides them, but a stale
// submission must not smuggle, say, a fixed fee onto an hourly project.

import { parseMoneyToMinor } from "@/lib/money";

export const BILLING_TYPES = ["hourly", "fixed_fee", "non_billable"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const BILLING_METHODS = [
  "per_project",
  "per_task",
  "per_person",
  "flat",
] as const;
export type BillingMethod = (typeof BILLING_METHODS)[number];

// D6: all four methods are modeled in the schema; the POC wires these two.
// The others render disabled in the selector and are rejected server-side.
export const WIRED_BILLING_METHODS: readonly BillingMethod[] = [
  "per_project",
  "per_task",
];

export type ProjectInput = {
  name: string;
  billingType: BillingType;
  billingMethod: BillingMethod | null; // hourly only
  hourlyRateMinor: number | null; // hourly + per_project only
  fixedFeeMinor: number | null; // fixed_fee only
};

export type ProjectFieldErrors = Partial<
  Record<
    "name" | "billingType" | "billingMethod" | "hourlyRate" | "fixedFee",
    string
  >
>;

export type ProjectInputResult =
  | { ok: true; data: ProjectInput }
  | { ok: false; errors: ProjectFieldErrors };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isBillingType(value: string): value is BillingType {
  return (BILLING_TYPES as readonly string[]).includes(value);
}

function isBillingMethod(value: string): value is BillingMethod {
  return (BILLING_METHODS as readonly string[]).includes(value);
}

// Money fields parse against the client's currency (G5: a project derives its
// currency, so the client's exponent decides what "150.50" means here).
export function parseProjectInput(
  raw: Record<string, unknown>,
  currency: string,
): ProjectInputResult {
  const errors: ProjectFieldErrors = {};

  const name = asTrimmedString(raw.name);
  if (name === "") errors.name = "Name is required.";

  const billingTypeRaw = asTrimmedString(raw.billingType);
  if (!isBillingType(billingTypeRaw)) {
    errors.billingType = "Choose how this project is billed.";
    return { ok: false, errors };
  }
  const billingType = billingTypeRaw;

  let billingMethod: BillingMethod | null = null;
  let hourlyRateMinor: number | null = null;
  let fixedFeeMinor: number | null = null;

  if (billingType === "hourly") {
    const methodRaw = asTrimmedString(raw.billingMethod);
    if (!isBillingMethod(methodRaw)) {
      errors.billingMethod = "Choose where the hourly rate comes from.";
    } else if (!WIRED_BILLING_METHODS.includes(methodRaw)) {
      errors.billingMethod = "This rate source isn't available yet.";
    } else {
      billingMethod = methodRaw;
    }

    if (billingMethod === "per_project") {
      // A zero rate would mean "hourly but free" — that's the non-billable
      // billing type, so require a positive amount here.
      hourlyRateMinor = parseMoneyToMinor(asTrimmedString(raw.hourlyRate), currency);
      if (hourlyRateMinor === null || hourlyRateMinor === 0) {
        hourlyRateMinor = null;
        errors.hourlyRate = "Enter an hourly rate greater than zero.";
      }
    }
  }

  if (billingType === "fixed_fee") {
    fixedFeeMinor = parseMoneyToMinor(asTrimmedString(raw.fixedFee), currency);
    if (fixedFeeMinor === null || fixedFeeMinor === 0) {
      fixedFeeMinor = null;
      errors.fixedFee = "Enter a fee greater than zero.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: { name, billingType, billingMethod, hourlyRateMinor, fixedFeeMinor },
  };
}

// --- Project↔task assignments ---

export type AssignmentInput = {
  billable: boolean;
  hourlyRateMinor: number | null; // only when the project prices per task
};

export type AssignmentFieldErrors = Partial<
  Record<"taskId" | "hourlyRate", string>
>;

export type AssignmentInputResult =
  | { ok: true; data: AssignmentInput }
  | { ok: false; errors: AssignmentFieldErrors };

// `perTaskRates` is derived from the owning project (hourly + per_task): only
// then does an assignment carry money, and only a billable one needs it —
// invoicing would otherwise find billable hours with no price. On any other
// project the rate field doesn't exist, so a stale value normalizes to null.
export function parseAssignmentInput(
  raw: Record<string, unknown>,
  currency: string,
  perTaskRates: boolean,
): AssignmentInputResult {
  const billable = raw.billable != null;

  let hourlyRateMinor: number | null = null;
  if (perTaskRates && billable) {
    hourlyRateMinor = parseMoneyToMinor(asTrimmedString(raw.hourlyRate), currency);
    if (hourlyRateMinor === null || hourlyRateMinor === 0) {
      return {
        ok: false,
        errors: { hourlyRate: "Enter an hourly rate greater than zero." },
      };
    }
  }

  return { ok: true, data: { billable, hourlyRateMinor } };
}
