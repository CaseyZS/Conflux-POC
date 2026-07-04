import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { setProjectArchived } from "@/features/projects/actions";
import { setAssignmentActive } from "@/features/projects/assignment-actions";
import { AssignmentDialog } from "@/features/projects/assignment-dialog";
import { ProjectDialog } from "@/features/projects/project-dialog";
import {
  getProject,
  listAssignableTasks,
  listAssignments,
} from "@/features/projects/queries";
import { SubmitButton } from "@/components/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Everything here reads through the projects read layer (G10) — the page
// never sees a raw Prisma row, so rate.view stripping stays in one place.
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const actor = await requireActor();
  const project = await getProject(actor, projectId);
  if (!project) notFound();

  const [assignments, assignableTasks] = await Promise.all([
    listAssignments(actor, project.id, project.currency),
    listAssignableTasks(actor, project.id),
  ]);
  const activeAssignments = assignments.filter((a) => a.active);
  const retiredAssignments = assignments.filter((a) => !a.active);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/clients/${project.clientId}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {project.clientName}
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            {project.archived && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.billingSummary}
          </p>
        </div>
        <div className="flex gap-2">
          <ProjectDialog
            clientId={project.clientId}
            currency={project.currency}
            project={project}
          />
          <form
            action={setProjectArchived.bind(null, project.id, !project.archived)}
          >
            {project.archived ? (
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

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Tasks</h2>
          {!project.archived && (
            <AssignmentDialog
              projectId={project.id}
              currency={project.currency}
              perTaskRates={project.perTaskRates}
              tasks={assignableTasks}
            />
          )}
        </div>
        {!project.archived && assignableTasks.length === 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Every org task is already assigned here — add more on the{" "}
            <Link href="/tasks" className="underline hover:text-foreground">
              Tasks
            </Link>{" "}
            page.
          </p>
        )}

        {activeAssignments.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No tasks assigned. Time is tracked against a project&apos;s
              assigned tasks.
            </p>
          </div>
        ) : (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Billing</TableHead>
                {project.perTaskRates && <TableHead>Rate</TableHead>}
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeAssignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">
                    {assignment.taskName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {assignment.billable ? "Billable" : "Non-billable"}
                  </TableCell>
                  {project.perTaskRates && (
                    <TableCell className="text-muted-foreground">
                      {assignment.rateSummary ?? "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <AssignmentDialog
                        projectId={project.id}
                        currency={project.currency}
                        perTaskRates={project.perTaskRates}
                        assignment={assignment}
                      />
                      <form
                        action={setAssignmentActive.bind(
                          null,
                          assignment.id,
                          false,
                        )}
                      >
                        <SubmitButton
                          variant="ghost"
                          size="sm"
                          pendingText="Retiring…"
                        >
                          Retire
                        </SubmitButton>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {retiredAssignments.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              Retired
            </h3>
            <ul className="mt-2 space-y-1">
              {retiredAssignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-muted-foreground">
                    {assignment.taskName}
                    <span className="ml-2">
                      · {assignment.billable ? "Billable" : "Non-billable"}
                      {project.perTaskRates && assignment.rateSummary
                        ? ` · ${assignment.rateSummary}`
                        : ""}
                    </span>
                  </span>
                  <form
                    action={setAssignmentActive.bind(null, assignment.id, true)}
                  >
                    <SubmitButton
                      variant="ghost"
                      size="sm"
                      pendingText="Reactivating…"
                    >
                      Reactivate
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
