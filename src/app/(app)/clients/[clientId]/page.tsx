import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { scopedDb } from "@/lib/scope";
import { setClientArchived } from "@/features/clients/actions";
import { EditClientDialog } from "@/features/clients/edit-client-dialog";
import { setProjectArchived } from "@/features/projects/actions";
import { listClientProjects } from "@/features/projects/queries";
import { ProjectDialog } from "@/features/projects/project-dialog";
import { SubmitButton } from "@/components/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const projects = await listClientProjects(actor, client.id, client.currency);
  const activeProjects = projects.filter((project) => !project.archived);
  const archivedProjects = projects.filter((project) => project.archived);

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

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
          {/* An archived client takes no new projects; the create action
              enforces the same rule server-side. */}
          {!archived && (
            <ProjectDialog clientId={client.id} currency={client.currency} />
          )}
        </div>

        {activeProjects.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No active projects.
            </p>
          </div>
        ) : (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/projects/${project.id}`}
                      className="hover:underline"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.billingSummary}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <ProjectDialog
                        clientId={client.id}
                        currency={client.currency}
                        project={project}
                      />
                      <form
                        action={setProjectArchived.bind(null, project.id, true)}
                      >
                        <SubmitButton
                          variant="ghost"
                          size="sm"
                          pendingText="Archiving…"
                        >
                          Archive
                        </SubmitButton>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {archivedProjects.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Archived
            </h3>
            <ul className="mt-2 space-y-1">
              {archivedProjects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-muted-foreground">
                    <Link
                      href={`/projects/${project.id}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {project.name}
                    </Link>
                    <span className="ml-2">· {project.billingSummary}</span>
                  </span>
                  <form
                    action={setProjectArchived.bind(null, project.id, false)}
                  >
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      pendingText="Unarchiving…"
                    >
                      Unarchive
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
