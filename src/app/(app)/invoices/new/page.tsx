import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { listNewInvoiceCandidates } from "@/features/invoices/queries";
import { NewInvoiceForm } from "@/features/invoices/new-invoice-form";

export default async function NewInvoicePage() {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const candidates = await listNewInvoiceCandidates(actor);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-muted-foreground">
        <Link href="/invoices" className="hover:underline">
          Invoices
        </Link>{" "}
        / New
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        New invoice
      </h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        An invoice bills one client. Pick which projects feed it — unbilled
        hourly time and one-time fixed fees; manual lines can be added on the
        draft.
      </p>

      <div className="mt-6">
        {candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No active clients.{" "}
              <Link href="/clients" className="underline">
                Create one
              </Link>{" "}
              first.
            </p>
          </div>
        ) : (
          <NewInvoiceForm candidates={candidates} />
        )}
      </div>
    </div>
  );
}
