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
import { formatDuration } from "./duration";

export type TimeEntryRow = {
  id: string;
  date: string;
  projectId: string;
  projectTaskId: string;
  clientName: string;
  projectName: string;
  taskName: string;
  note: string | null;
  billable: boolean; // the assignment's override over the task default
  durationSeconds: number;
  hoursLabel: string;
  hoursInput: string; // what the edit form prefills ("1:30" — parse accepts it back)
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
    projectId: entry.projectTask.projectId,
    projectTaskId: entry.projectTaskId,
    clientName: entry.projectTask.project.client.name,
    projectName: entry.projectTask.project.name,
    taskName: entry.projectTask.task.name,
    note: entry.note,
    billable: entry.projectTask.billable,
    durationSeconds: entry.durationSeconds,
    hoursLabel: formatDuration(entry.durationSeconds),
    hoursInput: formatDuration(entry.durationSeconds),
    running: entry.startedAt !== null,
    startedAtMs: entry.startedAt?.getTime() ?? null,
  }));
}

// --- The running timer (G6: at most one per actor) ---

export type RunningEntryView = {
  id: string;
  date: string; // the day it counts against (its start day — D11/D12)
  clientName: string;
  projectName: string;
  taskName: string;
  note: string | null;
  baseSeconds: number; // accumulated before this run; live elapsed adds on top
  startedAtMs: number; // non-null because it's running
};

// The actor's one open entry (startedAt set), or null. Read once by the shell
// so the running timer is visible on every page, not just the day view — which
// is the whole point of a live timer (start it, go work elsewhere).
export async function findRunningEntry(
  actor: Actor,
): Promise<RunningEntryView | null> {
  const entry = await scopedDb(actor.organizationId).timeEntry.findFirst({
    where: { membershipId: actor.membershipId, startedAt: { not: null } },
    include: {
      projectTask: {
        include: { task: true, project: { include: { client: true } } },
      },
    },
    orderBy: { startedAt: "desc" }, // defensive: newest if the invariant ever slips
  });
  if (!entry || entry.startedAt === null) return null;

  return {
    id: entry.id,
    date: entry.date,
    clientName: entry.projectTask.project.client.name,
    projectName: entry.projectTask.project.name,
    taskName: entry.projectTask.task.name,
    note: entry.note,
    baseSeconds: entry.durationSeconds,
    startedAtMs: entry.startedAt.getTime(),
  };
}

// --- The weekly grid (one row per assignment, one cell per day) ---

// A cell aggregates the day's entries for one assignment. The grid edits a
// cell only when that's unambiguous: exactly one entry that is neither
// running nor billed — or no entry yet (a create). Anything else renders
// read-only and defers to the day view, where entries are individual rows.
export type WeekCell = {
  date: string;
  totalSeconds: number;
  entryCount: number;
  running: boolean;
  startedAtMs: number | null; // the running entry's start, for the live tick
  billed: boolean; // some entry is on an invoice — locked (anti-double-bill)
};

export type WeekRow = {
  projectTaskId: string;
  clientName: string;
  projectName: string;
  taskName: string;
  // Same liveness rule as the picker: false means the assignment (or its
  // project/client/task) has been retired — existing cells stay editable
  // (history, G12), but empty cells can't take new time.
  assignmentLive: boolean;
  cells: WeekCell[]; // aligned index-for-index with the week's days
};

const emptyCell = (date: string): WeekCell => ({
  date,
  totalSeconds: 0,
  entryCount: 0,
  running: false,
  startedAtMs: null,
  billed: false,
});

export async function getWeekRows(
  actor: Actor,
  days: string[],
): Promise<WeekRow[]> {
  const entries = await scopedDb(actor.organizationId).timeEntry.findMany({
    where: { membershipId: actor.membershipId, date: { in: days } },
    include: {
      projectTask: {
        include: { task: true, project: { include: { client: true } } },
      },
    },
  });

  const rows = new Map<string, WeekRow>();
  for (const entry of entries) {
    let row = rows.get(entry.projectTaskId);
    if (!row) {
      const assignment = entry.projectTask;
      row = {
        projectTaskId: entry.projectTaskId,
        clientName: assignment.project.client.name,
        projectName: assignment.project.name,
        taskName: assignment.task.name,
        assignmentLive:
          assignment.active &&
          assignment.project.archivedAt === null &&
          assignment.project.client.archivedAt === null &&
          assignment.task.archivedAt === null,
        cells: days.map(emptyCell),
      };
      rows.set(entry.projectTaskId, row);
    }
    const cell = row.cells[days.indexOf(entry.date)];
    cell.totalSeconds += entry.durationSeconds;
    cell.entryCount += 1;
    if (entry.startedAt !== null) {
      cell.running = true;
      cell.startedAtMs = entry.startedAt.getTime();
    }
    if (entry.invoiceId !== null) cell.billed = true;
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.clientName.localeCompare(b.clientName) ||
      a.projectName.localeCompare(b.projectName) ||
      a.taskName.localeCompare(b.taskName),
  );
}

// --- The project → task picker ---

export type AssignmentOption = {
  projectTaskId: string;
  taskName: string;
};

export type ProjectOptions = {
  projectId: string;
  projectName: string;
  clientName: string;
  tasks: AssignmentOption[];
};

// What time can be logged against: active assignments (G12 — `active` is the
// drop-from-the-picker flag) on live projects, live clients, and unarchived
// tasks. The same liveness rules are re-checked server-side in the actions;
// this list only shapes the form.
export async function listAssignmentOptions(
  actor: Actor,
): Promise<ProjectOptions[]> {
  const assignments = await scopedDb(actor.organizationId).projectTask.findMany(
    {
      where: {
        active: true,
        project: { archivedAt: null, client: { archivedAt: null } },
        task: { archivedAt: null },
      },
      include: { task: true, project: { include: { client: true } } },
      orderBy: [
        { project: { client: { name: "asc" } } },
        { project: { name: "asc" } },
        { task: { name: "asc" } },
      ],
    },
  );

  const byProject = new Map<string, ProjectOptions>();
  for (const assignment of assignments) {
    let project = byProject.get(assignment.projectId);
    if (!project) {
      project = {
        projectId: assignment.projectId,
        projectName: assignment.project.name,
        clientName: assignment.project.client.name,
        tasks: [],
      };
      byProject.set(assignment.projectId, project);
    }
    project.tasks.push({
      projectTaskId: assignment.id,
      taskName: assignment.task.name,
    });
  }
  return [...byProject.values()];
}
