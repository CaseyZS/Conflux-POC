// Pure input validation for the invoices feature (no framework imports).
// The status and grouping unions are D13's SQLite trade realized: the columns
// are Strings, so these unions + the parsers here are the only thing standing
// between a form post and a nonsense lifecycle state.

import { isIsoDate } from "@/lib/dates";
import { parseMoneyToMinor } from "@/lib/money";

export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// Finalize is the draft→sent transition (freezes the number, snapshots);
// sent→paid is the mark-as-paid click. A finalized invoice (sent or paid) can
// be voided when it's wrong — a cancellation that keeps the record but releases
// the billed work. No credit-note document in the POC (deferred to the full
// version); void is the correction path.
export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

export const INVOICE_GROUPINGS = [
  "task",
  "person",
  "summary",
  "detailed",
] as const;
export type InvoiceGrouping = (typeof INVOICE_GROUPINGS)[number];

export function isInvoiceGrouping(value: string): value is InvoiceGrouping {
  return (INVOICE_GROUPINGS as readonly string[]).includes(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

// "8.25" → 825 basis points; two decimals max (finer is a typo, same rule as
// money input), capped at 100%. Digit-string math — no parseFloat near a
// percentage that prices an invoice (G4 discipline).
export function parsePercentToBps(input: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || 0);
  return bps > 10_000 ? null : bps;
}

// The reverse, for form prefills: 825 → "8.25", 1000 → "10".
export function formatBpsPercent(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const fraction = String(bps % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

// Payment terms as standard net-terms language: 30 → "NET30", 0 (or less) →
// "Due on receipt". This is the label the invoice shows instead of "30 days".
export function formatPaymentTerms(days: number): string {
  return days <= 0 ? "Due on receipt" : `NET${days}`;
}

// --- Draft settings (everything editable on a draft besides lines) ---

export type DraftSettingsInput = {
  number: string; // pre-filled (highest + 1) but user-editable; required
  grouping: InvoiceGrouping;
  showDate: boolean;
  showPerson: boolean;
  showTask: boolean;
  showNote: boolean;
  issueDate: string | null; // null = "today" derived at display/finalize
  dueDate: string | null; // null = derive issueDate + terms
  paymentTermsDays: number;
  subject: string | null;
  poNumber: string | null;
  discountPercentBps: number | null; // XOR discountFlatMinor
  discountFlatMinor: number | null;
  taxRateBps: number | null;
  footer: string | null;
};

export type DraftSettingsFieldErrors = Partial<
  Record<
    | "number"
    | "grouping"
    | "issueDate"
    | "dueDate"
    | "paymentTermsDays"
    | "discount"
    | "taxRate",
    string
  >
>;

export type DraftSettingsResult =
  | { ok: true; data: DraftSettingsInput }
  | { ok: false; errors: DraftSettingsFieldErrors };

// The discount arrives as a kind selector + one value field, and lands as
// the schema's two mutually exclusive columns — each column has exactly one
// unit, so a percent can never be misread as minor units (G4).
export function parseDraftSettings(
  raw: Record<string, unknown>,
  currency: string,
): DraftSettingsResult {
  const errors: DraftSettingsFieldErrors = {};

  const groupingRaw = asTrimmedString(raw.grouping);
  if (!isInvoiceGrouping(groupingRaw)) {
    errors.grouping = "Choose how to group the time lines.";
    return { ok: false, errors };
  }

  const number = asTrimmedString(raw.number);
  if (number === "") errors.number = "Invoice number is required.";

  const issueDate = emptyToNull(asTrimmedString(raw.issueDate));
  if (issueDate !== null && !isIsoDate(issueDate)) {
    errors.issueDate = "Not a valid date.";
  }
  const dueDate = emptyToNull(asTrimmedString(raw.dueDate));
  if (dueDate !== null && !isIsoDate(dueDate)) {
    errors.dueDate = "Not a valid date.";
  }

  const termsRaw = asTrimmedString(raw.paymentTermsDays);
  const paymentTermsDays = /^\d{1,3}$/.test(termsRaw) ? Number(termsRaw) : NaN;
  if (Number.isNaN(paymentTermsDays)) {
    errors.paymentTermsDays = "Terms are whole days (0–999).";
  }

  let discountPercentBps: number | null = null;
  let discountFlatMinor: number | null = null;
  const discountKind = asTrimmedString(raw.discountKind);
  const discountValue = asTrimmedString(raw.discountValue);
  if (discountKind === "percent") {
    discountPercentBps = parsePercentToBps(discountValue);
    if (discountPercentBps === null) {
      errors.discount = "Enter a percentage up to 100 (like 10 or 8.25).";
    }
  } else if (discountKind === "flat") {
    discountFlatMinor = parseMoneyToMinor(discountValue, currency);
    if (discountFlatMinor === null) {
      errors.discount = "Enter a plain amount (like 250 or 99.50).";
    }
  }

  let taxRateBps: number | null = null;
  const taxRaw = asTrimmedString(raw.taxRate);
  if (taxRaw !== "") {
    taxRateBps = parsePercentToBps(taxRaw);
    if (taxRateBps === null) {
      errors.taxRate = "Enter a percentage up to 100 (like 8.25).";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      number,
      grouping: groupingRaw,
      showDate: raw.showDate != null,
      showPerson: raw.showPerson != null,
      showTask: raw.showTask != null,
      showNote: raw.showNote != null,
      issueDate,
      dueDate,
      paymentTermsDays,
      subject: emptyToNull(asTrimmedString(raw.subject)),
      poNumber: emptyToNull(asTrimmedString(raw.poNumber)),
      discountPercentBps,
      discountFlatMinor,
      taxRateBps,
      footer: emptyToNull(asTrimmedString(raw.footer)),
    },
  };
}

// --- Manual lines ---

export type ManualLineInput = {
  description: string;
  quantityMilli: number;
  unitRateMinor: number;
  projectId: string | null; // optional attribution, validated by the action
};

export type ManualLineFieldErrors = Partial<
  Record<"description" | "quantity" | "unitRate", string>
>;

export type ManualLineResult =
  | { ok: true; data: ManualLineInput }
  | { ok: false; errors: ManualLineFieldErrors };

// Quantity in thousandths, like time lines: "2" → 2000, "1.5" → 1500, up to
// three decimals. Zero quantity or a zero rate is allowed (a free line reads
// fine on an invoice); negative isn't — credits are a post-POC concern.
export function parseManualLine(
  raw: Record<string, unknown>,
  currency: string,
): ManualLineResult {
  const errors: ManualLineFieldErrors = {};

  const description = asTrimmedString(raw.description);
  if (description === "") errors.description = "Description is required.";

  const quantityRaw = asTrimmedString(raw.quantity);
  const quantityMatch = /^(\d{1,6})(?:\.(\d{1,3}))?$/.exec(quantityRaw);
  let quantityMilli = 0;
  if (!quantityMatch) {
    errors.quantity = "Quantity is a plain number (like 1 or 2.5).";
  } else {
    const [, whole, fraction = ""] = quantityMatch;
    quantityMilli = Number(whole) * 1000 + Number(fraction.padEnd(3, "0") || 0);
  }

  const unitRateMinor = parseMoneyToMinor(
    asTrimmedString(raw.unitRate),
    currency,
  );
  if (unitRateMinor === null) {
    errors.unitRate = "Enter a plain amount (like 150 or 99.50).";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      description,
      quantityMilli,
      unitRateMinor: unitRateMinor ?? 0,
      projectId: emptyToNull(asTrimmedString(raw.projectId)),
    },
  };
}
