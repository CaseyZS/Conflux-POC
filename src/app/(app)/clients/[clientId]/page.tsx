import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { scopedDb } from "@/lib/scope";
import { setClientArchived } from "@/features/clients/actions";
import { EditClientDialog } from "@/features/clients/edit-client-dialog";
import { SubmitButton } from "@/components/submit-button";

// scopedDb injects the org filter, so a foreign or bogus id simply finds
// nothing and 404s — the tenant check and the existence check are one query.
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const actor = await requireActor();
  const db = scopedDb(actor.organizationId);
  const client = await db.client.findFirst({ where: { id: clientId } });
  if (!client) notFound();

  const archived = client.archivedAt !== null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/clients"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All clients
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.name}
          </h1>
          {archived && (
            <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Archived
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <EditClientDialog client={client} />
          <form action={setClientArchived.bind(null, client.id, !archived)}>
            {archived ? (
              <SubmitButton variant="outline" pendingText="Unarchiving…">
                Unarchive
              </SubmitButton>
            ) : (
              <SubmitButton variant="destructive" pendingText="Archiving…">
                Archive
              </SubmitButton>
            )}
          </form>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">
            Contact person
          </dt>
          <dd className="mt-1 text-sm">{client.contactPerson ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Email</dt>
          <dd className="mt-1 text-sm">{client.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">
            Currency
          </dt>
          <dd className="mt-1 text-sm">{client.currency}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">
            Billing address
          </dt>
          <dd className="mt-1 text-sm whitespace-pre-line">
            {client.billingAddress ?? "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
