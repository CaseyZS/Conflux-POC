import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { getInvoiceView } from "@/features/invoices/queries";
import { InvoiceStatusBadge } from "@/features/invoices/status-badge";
import { InvoiceDocument } from "@/features/invoices/invoice-document";
import { DraftSettingsForm } from "@/features/invoices/draft-settings-form";
import { SelectionEditor } from "@/features/invoices/selection-editor";
import { ManualLineDialog } from "@/features/invoices/manual-line-dialog";
import { DeleteDraftButton } from "@/features/invoices/delete-draft-button";
import { DownloadPdfButton } from "@/features/invoices/download-pdf-button";
import { PreviewButton } from "@/features/invoices/preview-button";
import {
  FinalizeButton,
  MarkPaidButton,
} from "@/features/invoices/lifecycle-buttons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// One page for both lifecycle halves: a draft renders as an editor over
// live-derived lines (G5 — nothing is stored until finalize); a finalized
// invoice renders through the polished InvoiceDocument (the same component the
// PDF prints, G9).
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const { invoiceId } = await params;
  const invoice = await getInvoiceView(actor, invoiceId);
  if (!invoice) notFound();

  const draft = invoice.status === "draft";

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-muted-foreground">
        <Link href="/invoices" className="hover:underline">
          Invoices
        </Link>{" "}
        / {invoice.number ?? "Draft"}
      </p>
      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {invoice.number ?? `Draft — ${invoice.clientName}`}
          </h1>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="flex items-center gap-2">
          {draft ? (
            <>
              <PreviewButton invoiceId={invoice.id} />
              <DeleteDraftButton invoiceId={invoice.id} />
              <FinalizeButton invoiceId={invoice.id} />
            </>
          ) : (
            <DownloadPdfButton invoiceId={invoice.id} />
          )}
          {invoice.status === "sent" && (
            <MarkPaidButton invoiceId={invoice.id} />
          )}
        </div>
      </div>

      {draft ? (
        <DraftWorkspace invoice={invoice} />
      ) : (
        <div className="mt-6">
          <InvoiceDocument invoice={invoice} />
        </div>
      )}
    </div>
  );
}

// The draft editing surface: the live-derived bill-to/from card, the line
// table with manual-line editing, the running totals, and the two editors
// (settings + which projects feed the invoice). All of it disappears at
// finalize, replaced by the read-only document above.
function DraftWorkspace({
  invoice,
}: {
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoiceView>>>;
}) {
  return (
    <>
      <div className="mt-6 grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <div>
          <h2 className="text-xs font-medium uppercase text-muted-foreground">
            Bill to
          </h2>
          <p className="mt-1 text-sm font-medium">{invoice.billTo.name}</p>
          {invoice.billTo.contact && (
            <p className="text-sm text-muted-foreground">
              {invoice.billTo.contact}
            </p>
          )}
          {invoice.billTo.address && (
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
              {invoice.billTo.address}
            </p>
          )}
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase text-muted-foreground">
            From
          </h2>
          <p className="mt-1 text-sm font-medium">{invoice.from.name}</p>
          {invoice.from.details && (
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
              {invoice.from.details}
            </p>
          )}
        </div>
        <div className="text-sm">
          <h2 className="text-xs font-medium uppercase text-muted-foreground">
            Details
          </h2>
          <dl className="mt-1 space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{invoice.effectiveIssueDate}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Due</dt>
              <dd>{invoice.effectiveDueDate}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Terms</dt>
              <dd>{invoice.paymentTermsLabel}</dd>
            </div>
            {invoice.poNumber && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">PO</dt>
                <dd>{invoice.poNumber}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Currency</dt>
              <dd>{invoice.currency}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            Pulled live until finalized.
          </p>
        </div>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Lines</h2>
          <ManualLineDialog
            invoiceId={invoice.id}
            currency={invoice.currency}
            projects={invoice.attributableProjects}
          />
        </div>

        {invoice.subject && (
          <p className="mt-2 text-sm">
            <span className="font-medium">Subject:</span>{" "}
            <span className="text-muted-foreground">{invoice.subject}</span>
          </p>
        )}

        {invoice.lines.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing to bill yet — select projects with unbilled time below, or
              add a manual line.
            </p>
          </div>
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="w-20 text-right">Qty</TableHead>
                <TableHead className="w-28 text-right">Rate</TableHead>
                <TableHead className="w-28 text-right">Amount</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((line) => (
                <TableRow key={line.key}>
                  <TableCell>
                    {line.description}
                    {line.source === "manual" && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        manual
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.quantityLabel}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.rateLabel}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.amountLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.source === "manual" && (
                      <ManualLineDialog
                        invoiceId={invoice.id}
                        currency={invoice.currency}
                        projects={invoice.attributableProjects}
                        line={line}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{invoice.subtotalLabel}</span>
          </div>
          {invoice.discountSummary && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {invoice.discountSummary}
              </span>
              <span className="tabular-nums">{invoice.discountLabel}</span>
            </div>
          )}
          {invoice.taxSummary && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {invoice.taxSummary}
              </span>
              <span className="tabular-nums">{invoice.taxLabel}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{invoice.totalLabel}</span>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-lg border p-4">
        <h2 className="text-lg font-medium">Invoice settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Grouping and detail change how the time lines above present — the same
          entries, itemized differently.
        </p>
        <div className="mt-4">
          <DraftSettingsForm invoice={invoice} />
        </div>
      </section>

      <section className="mt-8 rounded-lg border p-4">
        <h2 className="text-lg font-medium">What feeds this invoice</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Unbilled billable time from checked hourly projects and once-only
          fixed fees. Time logged later flows in until finalize.
        </p>
        <div className="mt-4">
          <SelectionEditor
            invoiceId={invoice.id}
            choices={invoice.selectionChoices}
          />
        </div>
      </section>
    </>
  );
}
