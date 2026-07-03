import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";
import { InvoiceStatusBadge } from "@/features/invoices/status-badge";
import type { InvoiceStatus } from "@/features/invoices/validate";

// Seg 2 placeholder: proves the create flow lands somewhere real. The draft
// editor (derived lines, manual lines, totals) replaces this in seg 3.
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const { invoiceId } = await params;

  const invoice = await scopedDb(actor.organizationId).invoice.findFirst({
    where: { id: invoiceId },
    include: {
      client: true,
      projectSelections: { include: { project: true } },
    },
  });
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-muted-foreground">
        <Link href="/invoices" className="hover:underline">
          Invoices
        </Link>{" "}
        / {invoice.number ?? "Draft"}
      </p>
      <div className="mt-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {invoice.number ?? `Draft — ${invoice.client.name}`}
        </h1>
        <InvoiceStatusBadge status={invoice.status as InvoiceStatus} />
      </div>

      <div className="mt-6 rounded-lg border p-4">
        <h2 className="text-sm font-medium">What feeds this invoice</h2>
        {invoice.projectSelections.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No projects selected — manual lines only.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {invoice.projectSelections.map((selection) => (
              <li key={selection.projectId}>
                {selection.project.name}
                {" — "}
                {selection.includeTime ? "unbilled time" : "fixed fee"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
