import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { scopedDb } from "@/lib/scope";
import { NewClientDialog } from "@/features/clients/new-client-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ClientsPage() {
  const actor = await requireActor();
  const db = scopedDb(actor.organizationId);
  const [org, clients] = await Promise.all([
    db.organization.findFirst(),
    db.client.findMany({ orderBy: { name: "asc" } }),
  ]);
  // Archived clients leave the working list but stay reachable (G12): they
  // keep their history and can be unarchived from their detail page.
  const active = clients.filter((client) => client.archivedAt === null);
  const archived = clients.filter((client) => client.archivedAt !== null);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <NewClientDialog defaultCurrency={org?.defaultCurrency ?? "USD"} />
      </div>

      {active.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No active clients.</p>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Currency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/clients/${client.id}`}
                    className="hover:underline"
                  >
                    {client.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.contactPerson ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.email ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.currency}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {archived.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium text-muted-foreground">
            Archived
          </h2>
          <ul className="mt-2 space-y-1">
            {archived.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/clients/${client.id}`}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  {client.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
