// Pure input validation for the invoices feature (no framework imports).
// The status and grouping unions are D13's SQLite trade realized: the columns
// are Strings, so these unions + the parsers here are the only thing standing
// between a form post and a nonsense lifecycle state.

export const INVOICE_STATUSES = ["draft", "sent", "paid"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// Finalize is the draft→sent transition (assigns the number, snapshots);
// sent→paid is the mark-as-paid click. No other movement exists — finalized
// invoices are immutable and there's no void/credit path in the POC.
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
