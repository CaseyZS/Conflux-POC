import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { listInvoices } from "@/features/invoices/queries";
import { InvoiceStatusBadge } from "@/features/invoices/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Unlike clients/projects (readable by every role), everything under
// /invoices is money, so the capability gate sits on the page reads too —
// the POC has no invoice.view, so invoice.manage is the whole invoicing door.
export default async function InvoicesPage() {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const invoices = await listInvoices(actor);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <Button render={<Link href="/invoices/new" />}>New invoice</Button>
      </div>

      {invoices.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No invoices yet. Draft one from unbilled time, a fixed fee, or
            manual lines.
          </p>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="hover:underline"
                  >
                    {invoice.number ?? "Draft"}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {invoice.clientName}
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={invoice.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {invoice.issueDate ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {invoice.totalLabel ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
