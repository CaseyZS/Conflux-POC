import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { getInvoiceView } from "@/features/invoices/queries";
import { InvoiceDocument } from "@/features/invoices/invoice-document";

// The bare, shell-free surface Playwright prints to PDF (G9). It lives OUTSIDE
// the (app) route group, so it inherits only the root layout (html/body +
// Tailwind) with no sidebar. Same auth guard and the same InvoiceDocument as
// the on-screen view, so screen and PDF can never drift. Drafts render too —
// this is the "Preview" surface — and the document stamps them DRAFT so a
// preview is never mistaken for a finalized invoice.
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const { invoiceId } = await params;
  const invoice = await getInvoiceView(actor, invoiceId);
  if (!invoice) notFound();

  return <InvoiceDocument invoice={invoice} />;
}
