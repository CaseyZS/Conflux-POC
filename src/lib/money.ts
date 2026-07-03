// Money seam (G4, D9): integer minor units everywhere; formatting happens here
// and only here — no hardcoded ÷100 anywhere else. M0 ships just the formatter
// (enough to prove the test harness); the invoice pipeline (lineAmount,
// subtotal/discount/tax with per-line half-up rounding) lands with M4.

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
