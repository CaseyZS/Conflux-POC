// Money seam (G4, D9): integer minor units everywhere; formatting happens here
// and only here — no hardcoded ÷100 anywhere else. M0 shipped the formatter;
// M4 adds the invoice pipeline (line amounts, subtotal → discount → tax →
// total), all integer math with one rounding rule: per line, half-up.

// Minor-unit exponents per ISO 4217; anything not listed uses the common 2.
const CURRENCY_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

export function minorUnitExponent(currency: string): number {
  return CURRENCY_EXPONENT[currency] ?? 2;
}

// The inverse of formatMoney for form input: a human decimal string in major
// units → integer minor units, or null if it isn't a clean non-negative
// amount for this currency. Digit-string math, not parseFloat, so no float
// drift can round a price (G4). Thousands commas are tolerated; more decimal
// places than the currency has is a user error, not something to round away.
export function parseMoneyToMinor(
  input: string,
  currency: string,
): number | null {
  const exponent = minorUnitExponent(currency);
  const cleaned = input.trim().replace(/,/g, "");
  const match = /^(\d{1,12})(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;

  const [, whole, fraction = ""] = match;
  if (fraction.length > exponent) return null;

  return (
    Number(whole) * 10 ** exponent + Number(fraction.padEnd(exponent, "0") || 0)
  );
}

// Minor units → the plain decimal string a form input expects ("150.50",
// no symbol, no grouping). parseMoneyToMinor(formatMoneyInput(x)) === x.
export function formatMoneyInput(
  amountMinor: number,
  currency: string,
): string {
  const exponent = minorUnitExponent(currency);
  return (amountMinor / 10 ** exponent).toFixed(exponent); // display boundary (G4)
}

// Locale fixed to en-US for the POC so output is deterministic across
// machines (and tests); a user-locale setting can thread through later.
export function formatMoney(amountMinor: number, currency: string): string {
  const exponent = minorUnitExponent(currency);
  const major = amountMinor / 10 ** exponent; // floats allowed at display only (G4)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(major);
}

// --- The invoice pipeline (D9): integer math, per-line half-up rounding ---

// Integer division rounded half-up, away from zero ("half-up" in D9's sense:
// 0.5 minor units becomes 1, −0.5 becomes −1). Everything the pipeline rounds
// goes through this one function, so the rule can't drift between steps.
// Inputs stay well inside Number.MAX_SAFE_INTEGER for any plausible invoice
// (hours-in-millis × rate-in-minor tops out around 10^13).
export function divRoundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new Error("divRoundHalfUp is integer math only (G4)");
  }
  const quotient = Math.trunc(numerator / denominator) + 0; // + 0 folds Math.trunc's −0 into 0
  const remainder = numerator % denominator;
  if (Math.abs(remainder) * 2 >= Math.abs(denominator)) {
    return quotient + (numerator < 0 !== denominator < 0 ? -1 : 1);
  }
  return quotient;
}

// One line item's amount: quantity in thousandths of a unit (12.5 h → 12500,
// a manual line's "1" → 1000) × unit rate in minor units, rounded half-up to
// the minor unit. This is D9's "round each line" step.
export function lineAmountMinor(
  quantityMilli: number,
  unitRateMinor: number,
): number {
  return divRoundHalfUp(quantityMilli * unitRateMinor, 1000);
}

// A basis-point percentage of an amount (8.25% = 825 bps), rounded half-up.
// Used for both the percent discount and the tax.
export function percentOfBps(amountMinor: number, rateBps: number): number {
  return divRoundHalfUp(amountMinor * rateBps, 10_000);
}

export type InvoiceTotals = {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
};

// Subtotal → discount → tax → total, per the invoicing requirements: the
// subtotal is the exact sum of the already-rounded line amounts (never a
// re-computation from raw quantities), the discount is percent XOR flat, and
// the single tax applies to the discounted subtotal. Each derived step rounds
// half-up, so the printed figures always add up: total = subtotal − discount
// + tax holds exactly, in integers.
export function invoiceTotals(
  lineAmountsMinor: readonly number[],
  options: {
    discountPercentBps?: number | null;
    discountFlatMinor?: number | null;
    taxRateBps?: number | null;
  },
): InvoiceTotals {
  const { discountPercentBps, discountFlatMinor, taxRateBps } = options;
  if (discountPercentBps != null && discountFlatMinor != null) {
    // Validation enforces the XOR at input; the pipeline refuses too because
    // a double discount is a financial error, not a display quirk.
    throw new Error("Discount is percent or flat, never both");
  }

  const subtotalMinor = lineAmountsMinor.reduce((sum, line) => sum + line, 0);
  // A draft's flat discount can outgrow a shrinking live pool (entries billed
  // elsewhere), so clamp: an invoice never discounts below zero.
  const discountMinor =
    discountPercentBps != null
      ? percentOfBps(subtotalMinor, discountPercentBps)
      : Math.min(discountFlatMinor ?? 0, Math.max(subtotalMinor, 0));
  const taxableMinor = subtotalMinor - discountMinor;
  const taxMinor = percentOfBps(taxableMinor, taxRateBps ?? 0);
  return {
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor: taxableMinor + taxMinor,
  };
}
