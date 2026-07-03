// Invoice numbering helpers — pure, with no feature-internal imports, so both
// the validation layer and finalize can share them without an import cycle.
// The stored number is always the full "INV-0002"; only the numeric tail is
// user-editable (the prefix is the org's, applied here).

// "INV-" + 1 → "INV-0001": four digits keeps numbers sortable-looking without
// pretending to be a spec. Values past four digits aren't truncated.
export function formatInvoiceNumber(prefix: string, value: number): string {
  return `${prefix}${String(value).padStart(4, "0")}`;
}

// The numeric tail of an invoice number, for sequencing: "INV-0007" → 7,
// "2026-014" → 14. A number with no trailing digits (a fully custom label)
// contributes nothing to the sequence.
export function invoiceNumberValue(number: string): number | null {
  const match = /(\d+)\s*$/.exec(number);
  return match ? Number(match[1]) : null;
}

// The next number to propose on a new draft: one past the highest numeric tail
// among all existing invoice numbers (drafts and finalized alike), or 1 for the
// first. This is a default the user can override on the draft — deliberately
// NOT a strictly gapless counter, so editing or deleting drafts can leave gaps.
// Duplicates are still prevented by the @@unique([organizationId, number]) index.
export function nextInvoiceNumberValue(
  existingNumbers: readonly (string | null)[],
): number {
  let max = 0;
  for (const number of existingNumbers) {
    if (!number) continue;
    const value = invoiceNumberValue(number);
    if (value !== null && value > max) max = value;
  }
  return max + 1;
}

// Split a stored number into its fixed prefix and its editable numeric tail:
// "INV-0002" → { prefix: "INV-", seq: "0002" }. Used by the draft form to show
// the prefix as static text with only the digits editable.
export function splitInvoiceNumber(number: string): {
  prefix: string;
  seq: string;
} {
  const match = /^(.*?)(\d+)\s*$/.exec(number);
  return match
    ? { prefix: match[1], seq: match[2] }
    : { prefix: number, seq: "" };
}
