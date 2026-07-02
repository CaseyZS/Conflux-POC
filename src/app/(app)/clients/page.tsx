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
    db.client.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <NewClientDialog defaultCurrency={org?.defaultCurrency ?? "USD"} />
      </div>

      {clients.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No clients yet.</p>
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
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
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
    </div>
  );
}
