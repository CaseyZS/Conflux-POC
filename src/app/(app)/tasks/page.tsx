import { requireActor } from "@/lib/auth";
import { scopedDb } from "@/lib/scope";
import { setTaskArchived } from "@/features/tasks/actions";
import { TaskDialog } from "@/features/tasks/task-dialog";
import { SubmitButton } from "@/components/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Tasks are one org-wide list — a shared vocabulary of work kinds — not
// per-project rows. Projects assign from this list (Seg 4), so the same
// "Development" means the same thing on every project.
export default async function TasksPage() {
  const actor = await requireActor();
  const db = scopedDb(actor.organizationId);
  const tasks = await db.task.findMany({ orderBy: { name: "asc" } });
  const active = tasks.filter((task) => task.archivedAt === null);
  const archived = tasks.filter((task) => task.archivedAt !== null);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <TaskDialog />
      </div>

      {active.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No active tasks.</p>
        </div>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Default billing</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium">{task.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {task.defaultBillable ? "Billable" : "Non-billable"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <TaskDialog task={task} />
                    <form action={setTaskArchived.bind(null, task.id, true)}>
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

      {archived.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium text-muted-foreground">
            Archived
          </h2>
          <ul className="mt-2 space-y-1">
            {archived.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-sm text-muted-foreground">
                  {task.name}
                  <span className="ml-2">
                    · {task.defaultBillable ? "Billable" : "Non-billable"}
                  </span>
                </span>
                <form action={setTaskArchived.bind(null, task.id, false)}>
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
    </div>
  );
}
