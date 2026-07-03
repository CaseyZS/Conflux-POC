// Pure input validation for the org settings feature (no framework imports),
// so it unit-tests without a server or DB — updateOrgSettings is a thin shell
// around this plus the guarded write. Mirrors the clients/invoices validators:
// trim, empty→null for optional text, and integer conversions (tax percent →
// basis points) done here so the action never touches raw strings.

import { parsePercentToBps } from "@/features/invoices/validate";
import type { DurationFormat } from "@/features/time/duration";

export type OrgSettingsInput = {
  name: string;
  fromDetails: string | null;
  defaultCurrency: string; // ISO-4217, uppercase
  defaultTaxRateBps: number; // 0 = no default tax
  defaultPaymentTermsDays: number;
  invoiceNumberPrefix: string; // may be empty; must not end in a digit (D15)
  invoiceFooter: string | null;
  timeDisplayFormat: DurationFormat; // how durations show in the timesheet views
};

// Error keys are the form field names (not the parsed shape), so the client
// can map each message straight to its input.
export type OrgSettingsErrorKey =
  | "name"
  | "defaultCurrency"
  | "defaultTaxRate"
  | "defaultPaymentTermsDays"
  | "invoiceNumberPrefix";

export type OrgSettingsFieldErrors = Partial<
  Record<OrgSettingsErrorKey, string>
>;

export type OrgSettingsResult =
  | { ok: true; data: OrgSettingsInput }
  | { ok: false; errors: OrgSettingsFieldErrors };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

export function parseOrgSettings(
  raw: Record<string, unknown>,
): OrgSettingsResult {
  const errors: OrgSettingsFieldErrors = {};

  const name = asTrimmedString(raw.name);
  if (name === "") errors.name = "Business name is required.";

  const defaultCurrency = asTrimmedString(raw.defaultCurrency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(defaultCurrency)) {
    errors.defaultCurrency = "Currency must be a 3-letter code (e.g. USD).";
  }

  // Empty tax = no default (0 bps); otherwise the same percent parse as the
  // invoice discount/tax fields.
  let defaultTaxRateBps = 0;
  const taxRaw = asTrimmedString(raw.defaultTaxRate);
  if (taxRaw !== "") {
    const bps = parsePercentToBps(taxRaw);
    if (bps === null) {
      errors.defaultTaxRate = "Enter a percentage up to 100 (like 8.25).";
    } else {
      defaultTaxRateBps = bps;
    }
  }

  const termsRaw = asTrimmedString(raw.defaultPaymentTermsDays);
  const defaultPaymentTermsDays = /^\d{1,3}$/.test(termsRaw)
    ? Number(termsRaw)
    : NaN;
  if (Number.isNaN(defaultPaymentTermsDays)) {
    errors.defaultPaymentTermsDays = "Terms are whole days (0–999).";
  }

  // The prefix precedes the numeric part, so it must not itself end in a digit
  // — otherwise splitInvoiceNumber/nextInvoiceNumberValue can't tell where the
  // sequence begins (D15). Empty is allowed (numbers become bare "0001").
  const invoiceNumberPrefix = asTrimmedString(raw.invoiceNumberPrefix);
  if (invoiceNumberPrefix.length > 12) {
    errors.invoiceNumberPrefix = "Keep the prefix to 12 characters or fewer.";
  } else if (/\d$/.test(invoiceNumberPrefix)) {
    errors.invoiceNumberPrefix =
      "The prefix can't end in a digit — the number goes there.";
  }

  // A closed choice from a Select, so it can't be "wrong" — anything that
  // isn't the decimal option falls back to the H:MM default rather than erroring.
  const timeDisplayFormat: DurationFormat =
    asTrimmedString(raw.timeDisplayFormat) === "decimal" ? "decimal" : "hms";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      fromDetails: emptyToNull(asTrimmedString(raw.fromDetails)),
      defaultCurrency,
      defaultTaxRateBps,
      defaultPaymentTermsDays: defaultPaymentTermsDays as number,
      invoiceNumberPrefix,
      invoiceFooter: emptyToNull(asTrimmedString(raw.invoiceFooter)),
      timeDisplayFormat,
    },
  };
}
