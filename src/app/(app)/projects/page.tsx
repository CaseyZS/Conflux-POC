import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { listOrgProjects } from "@/features/projects/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// A pure read: a project belongs to a client, so creation lives on the
// client's page and management on the project's own — this index just gets
// you to either without walking through /clients first.
export default async function ProjectsPage() {
  const actor = await requireActor();
  const projects = await listOrgProjects(actor);
  const active = projects.filter((project) => !project.archived);
  const archived = projects.filter((project) => project.archived);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>

      {active.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No active projects. Create one from its client&apos;s page.
          </p>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Billing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.map((project) => (
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
                  <Link
                    href={`/clients/${project.clientId}`}
                    className="hover:text-foreground hover:underline"
                  >
                    {project.clientName}
                  </Link>
                  {project.clientArchived && (
                    <span className="ml-2 text-xs">(archived client)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.billingSummary}
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
            {archived.map((project) => (
              <li key={project.id} className="text-sm text-muted-foreground">
                <Link
                  href={`/projects/${project.id}`}
                  className="hover:text-foreground hover:underline"
                >
                  {project.name}
                </Link>
                <span className="ml-2">
                  · {project.clientName} · {project.billingSummary}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
