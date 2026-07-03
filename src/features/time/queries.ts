// The time read layer: timesheet views read these view models, never raw
// rows — same one-place discipline as the projects read layer (G10).
// Billability is derived from the assignment here (no per-entry flag), and
// durations leave as display strings.
//
// Views are owner-scoped (the actor's own entries); widening by
// `time.view.all` is a documented later concern (requirements/access-control)
// and would land here, in one place.

import type { Actor } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";
import { formatHours } from "./duration";

export type TimeEntryRow = {
  id: string;
  date: string;
  clientName: string;
  projectName: string;
  taskName: string;
  note: string | null;
  billable: boolean; // the assignment's override over the task default
  durationSeconds: number;
  hoursLabel: string;
  running: boolean;
  startedAtMs: number | null; // epoch ms for the live elapsed tick (timer, seg 3)
};

export async function listDayEntries(
  actor: Actor,
  date: string,
): Promise<TimeEntryRow[]> {
  const entries = await scopedDb(actor.organizationId).timeEntry.findMany({
    where: { membershipId: actor.membershipId, date },
    include: {
      projectTask: {
        include: { task: true, project: { include: { client: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return entries.map((entry) => ({
    id: entry.id,
    date: entry.date,
    clientName: entry.projectTask.project.client.name,
    projectName: entry.projectTask.project.name,
    taskName: entry.projectTask.task.name,
    note: entry.note,
    billable: entry.projectTask.billable,
    durationSeconds: entry.durationSeconds,
    hoursLabel: formatHours(entry.durationSeconds),
    running: entry.startedAt !== null,
    startedAtMs: entry.startedAt?.getTime() ?? null,
  }));
}
