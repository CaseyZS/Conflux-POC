import type { InvoiceView } from "./queries";

// The polished invoice — one styled component that renders BOTH the on-screen
// finalized view and the PDF (G9): seg 2 points Playwright at a route that
// renders exactly this. So it is deliberately self-contained and theme-blind:
// explicit "paper" colors (white ground, zinc ink) rather than the app's
// theme tokens, because an invoice is a paper document and must print light
// even when the app is in dark mode, and it must stand alone when Chromium
// renders it outside the app shell. All money/quantity/date strings arrive
// pre-formatted from getInvoiceView (G4/G10) — this file only lays them out.

// A "PAID" / "SENT" wordmark by the number — useful on a printed copy, and it
// costs nothing to carry into the PDF.
const STATUS_STAMP: Record<
  InvoiceView["status"],
  { label: string; className: string } | null
> = {
  draft: null, // the document view is never shown for a draft
  sent: { label: "SENT", className: "text-sky-600 ring-sky-600/30" },
  paid: { label: "PAID", className: "text-emerald-600 ring-emerald-600/30" },
};

export function InvoiceDocument({ invoice }: { invoice: InvoiceView }) {
  const stamp = STATUS_STAMP[invoice.status];

  return (
    <article className="invoice-document mx-auto w-full max-w-3xl bg-white p-10 text-zinc-900 shadow-sm ring-1 ring-zinc-200 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      {/* Masthead: who's billing (left) vs. the INVOICE wordmark (right). */}
      <header className="flex items-start justify-between gap-8 border-b border-zinc-200 pb-8">
        <div>
          <p className="text-xl font-semibold tracking-tight">
            {invoice.from.name}
          </p>
          {invoice.from.details && (
            <p className="mt-1 whitespace-pre-line text-sm text-zinc-500">
              {invoice.from.details}
            </p>
          )}
        </div>
        <div className="text-right">
          <h1 className="text-3xl font-bold uppercase tracking-[0.2em] text-zinc-400">
            Invoice
          </h1>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {invoice.number}
          </p>
          {stamp && (
            <span
              className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ${stamp.className}`}
            >
              {stamp.label}
            </span>
          )}
        </div>
      </header>

      {/* Bill-to (left) and the invoice metadata (right). */}
      <section className="mt-8 flex items-start justify-between gap-8">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Bill to
          </h2>
          <p className="mt-1 font-medium">{invoice.billTo.name}</p>
          {invoice.billTo.contact && (
            <p className="text-sm text-zinc-500">{invoice.billTo.contact}</p>
          )}
          {invoice.billTo.address && (
            <p className="mt-1 whitespace-pre-line text-sm text-zinc-500">
              {invoice.billTo.address}
            </p>
          )}
        </div>
        <dl className="min-w-52 space-y-1 text-sm">
          <div className="flex justify-between gap-6">
            <dt className="text-zinc-500">Issued</dt>
            <dd className="tabular-nums">{invoice.effectiveIssueDate}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-zinc-500">Due</dt>
            <dd className="tabular-nums">{invoice.effectiveDueDate}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-zinc-500">Terms</dt>
            <dd>{invoice.paymentTermsLabel}</dd>
          </div>
          {invoice.poNumber && (
            <div className="flex justify-between gap-6">
              <dt className="text-zinc-500">PO</dt>
              <dd>{invoice.poNumber}</dd>
            </div>
          )}
          <div className="flex justify-between gap-6">
            <dt className="text-zinc-500">Currency</dt>
            <dd>{invoice.currency}</dd>
          </div>
        </dl>
      </section>

      {/* Subject line (optional) sits directly above the line items. */}
      <div className="mt-8">
        {invoice.subject && (
          <p className="mb-3 text-sm">
            <span className="font-semibold">Subject:</span> {invoice.subject}
          </p>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 font-medium">Description</th>
              <th className="w-20 py-2 text-right font-medium">Qty</th>
              <th className="w-28 py-2 text-right font-medium">Rate</th>
              <th className="w-28 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.key} className="border-b border-zinc-100">
                <td className="py-2 pr-4">{line.description}</td>
                <td className="py-2 text-right tabular-nums">
                  {line.quantityLabel}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {line.rateLabel}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {line.amountLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals, aligned under the Amount column. */}
      <div className="mt-4 flex justify-end">
        <dl className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Subtotal</dt>
            <dd className="tabular-nums">{invoice.subtotalLabel}</dd>
          </div>
          {invoice.discountSummary && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">{invoice.discountSummary}</dt>
              <dd className="tabular-nums">{invoice.discountLabel}</dd>
            </div>
          )}
          {invoice.taxSummary && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">{invoice.taxSummary}</dt>
              <dd className="tabular-nums">{invoice.taxLabel}</dd>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-zinc-300 pt-2 text-base font-semibold">
            <dt>Total due</dt>
            <dd className="tabular-nums">{invoice.totalLabel}</dd>
          </div>
        </dl>
      </div>

      {invoice.footer && (
        <footer className="mt-10 whitespace-pre-line border-t border-zinc-200 pt-4 text-sm text-zinc-500">
          {invoice.footer}
        </footer>
      )}
    </article>
  );
}
