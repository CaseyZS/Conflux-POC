"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";
import { localDayOf } from "@/lib/dates";
import { elapsedSeconds } from "./duration";
import { parseTimeEntryInput, type TimeEntryFieldErrors } from "./validate";

export type SaveTimeEntryResult =
  | { status: "success" }
  | { status: "error"; errors: TimeEntryFieldErrors };

// Time entries are personal rows: every action is owner-checked against the
// actor's membership on top of the org scope — `time.track` lets you log
// *your* time, not touch anyone else's.

// The same liveness rules as the picker (listAssignmentOptions), re-checked
// here because the form is never trusted: logging against a retired
// assignment, archived project/client, or archived task is only valid for
// history that already points there, never for new bookings.
function findLiveAssignment(
  db: ReturnType<typeof scopedDb>,
  projectTaskId: string,
) {
  return db.projectTask.findFirst({
    where: {
      id: projectTaskId,
      active: true,
      project: { archivedAt: null, client: { archivedAt: null } },
      task: { archivedAt: null },
    },
  });
}

// G6 — at most one timer runs at a time, enforced in the app layer (no DB
// constraint, per D5). Before any start/resume, close the actor's open
// entries: collapse each one's live elapsed into durationSeconds and clear
// startedAt. There should be one at most; closing all is cheap insurance if
// the invariant ever slipped. `exceptId` skips the entry being resumed.
async function stopRunningEntries(
  db: ReturnType<typeof scopedDb>,
  membershipId: string,
  exceptId?: string,
) {
  const running = await db.timeEntry.findMany({
    where: {
      membershipId,
      startedAt: { not: null },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
  const now = Date.now();
  for (const entry of running) {
    if (entry.startedAt === null) continue; // narrowing; the filter guarantees it
    await db.timeEntry.update({
      where: { id: entry.id },
      data: {
        durationSeconds:
          entry.durationSeconds + elapsedSeconds(entry.startedAt.getTime(), now),
        startedAt: null,
      },
    });
  }
}

export async function createTimeEntry(
  formData: FormData,
): Promise<SaveTimeEntryResult> {
  const actor = requireCapability(await requireActor(), "time.track");
  const db = scopedDb(actor.organizationId);

  const parsed = parseTimeEntryInput({
    date: formData.get("date"),
    hours: formData.get("hours"),
    note: formData.get("note"),
  });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const projectTaskIdRaw = formData.get("projectTaskId");
  const projectTaskId =
    typeof projectTaskIdRaw === "string" ? projectTaskIdRaw : "";
  const assignment = await findLiveAssignment(db, projectTaskId);
  if (!assignment) {
    return {
      status: "error",
      errors: { projectTask: "Choose a project and task." },
    };
  }

  await db.timeEntry.create({
    data: {
      ...parsed.data,
      projectTaskId: assignment.id,
      membershipId: actor.membershipId,
      organizationId: actor.organizationId,
    },
  });

  revalidatePath("/time");
  return { status: "success" };
}

export async function updateTimeEntry(
  entryId: string,
  formData: FormData,
): Promise<SaveTimeEntryResult> {
  const actor = requireCapability(await requireActor(), "time.track");
  const db = scopedDb(actor.organizationId);

  const entry = await db.timeEntry.findFirst({
    where: { id: entryId, membershipId: actor.membershipId },
  });
  if (!entry) throw new Error("Time entry not found.");
  // Billed = immutable (anti-double-bill): once an invoice snapshot includes
  // this row, editing it would silently falsify the invoice.
  if (entry.invoiceId !== null) {
    throw new Error("This entry is on an invoice and can't be changed.");
  }
  // A running entry's duration is live (base + elapsed); writing a manual hours
  // value while startedAt is set would double-count on the next tick. Stop it
  // first. The UI never opens the edit dialog on a running row; this guards the
  // action directly.
  if (entry.startedAt !== null) {
    throw new Error("Stop the timer before editing this entry.");
  }

  const parsed = parseTimeEntryInput({
    date: formData.get("date"),
    hours: formData.get("hours"),
    note: formData.get("note"),
  });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const projectTaskIdRaw = formData.get("projectTaskId");
  const projectTaskId =
    typeof projectTaskIdRaw === "string" ? projectTaskIdRaw : "";
  // Keeping the entry where it is stays legal even if that assignment has
  // since been retired (G12 — history keeps working); only a *move* must
  // land on a live assignment.
  if (projectTaskId !== entry.projectTaskId) {
    const assignment = await findLiveAssignment(db, projectTaskId);
    if (!assignment) {
      return {
        status: "error",
        errors: { projectTask: "Choose a project and task." },
      };
    }
  }

  await db.timeEntry.update({
    where: { id: entryId },
    data: { ...parsed.data, projectTaskId },
  });

  revalidatePath("/time");
  return { status: "success" };
}

// A real delete, not an archive: a time entry is the user's own unbilled work
// log, not shared history other records hang off (G12 applies to the shared
// structure — clients/projects/tasks — not here).
export async function deleteTimeEntry(entryId: string): Promise<void> {
  const actor = requireCapability(await requireActor(), "time.track");
  const db = scopedDb(actor.organizationId);

  const entry = await db.timeEntry.findFirst({
    where: { id: entryId, membershipId: actor.membershipId },
  });
  if (!entry) throw new Error("Time entry not found.");
  if (entry.invoiceId !== null) {
    throw new Error("This entry is on an invoice and can't be deleted.");
  }

  await db.timeEntry.delete({ where: { id: entryId } });

  revalidatePath("/time");
}

// --- The live timer (D5 / G6) ---

// Start a fresh timer: a new open entry (startedAt set, durationSeconds 0)
// dated *today*, because a live timer measures now — even if the day view was
// on a past date (D11, keep-its-start-day via localDayOf). Validates the
// assignment before touching the current timer, so a bad pick doesn't stop
// what's running.
export async function startTimer(
  formData: FormData,
): Promise<SaveTimeEntryResult> {
  const actor = requireCapability(await requireActor(), "time.track");
  const db = scopedDb(actor.organizationId);

  const projectTaskIdRaw = formData.get("projectTaskId");
  const projectTaskId =
    typeof projectTaskIdRaw === "string" ? projectTaskIdRaw : "";
  const assignment = await findLiveAssignment(db, projectTaskId);
  if (!assignment) {
    return {
      status: "error",
      errors: { projectTask: "Choose a project and task." },
    };
  }

  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.trim() !== "" ? noteRaw.trim() : null;

  const now = new Date();
  await stopRunningEntries(db, actor.membershipId); // G6
  await db.timeEntry.create({
    data: {
      date: localDayOf(now),
      durationSeconds: 0,
      note,
      startedAt: now,
      projectTaskId: assignment.id,
      membershipId: actor.membershipId,
      organizationId: actor.organizationId,
    },
  });

  revalidatePath("/time");
  return { status: "success" };
}

// Resume "continue this entry": re-open the same row so more time accumulates
// onto its existing durationSeconds, keeping its original day (D12). The
// encouraged path is "start fresh" (a new entry today, above); this exists for
// genuinely continuing an earlier session. Liveness is deliberately not
// re-checked — continuing an entry that already points at a since-retired
// assignment stays legal (G12: history keeps working; only new bookings must
// land live), and this is the escape hatch for a retired task that can no
// longer be started fresh.
export async function resumeEntry(entryId: string): Promise<void> {
  const actor = requireCapability(await requireActor(), "time.track");
  const db = scopedDb(actor.organizationId);

  const entry = await db.timeEntry.findFirst({
    where: { id: entryId, membershipId: actor.membershipId },
  });
  if (!entry) throw new Error("Time entry not found.");
  if (entry.invoiceId !== null) {
    throw new Error("This entry is on an invoice and can't be resumed.");
  }
  if (entry.startedAt !== null) return; // already the running one

  await stopRunningEntries(db, actor.membershipId, entryId); // G6
  await db.timeEntry.update({
    where: { id: entryId },
    data: { startedAt: new Date() },
  });

  revalidatePath("/time");
}

// Stop the running timer: collapse its live elapsed into durationSeconds and
// clear startedAt, freezing the total. Idempotent — stopping an
// already-stopped entry is a no-op (a double click, or a button gone stale
// after another tab stopped it).
export async function stopTimer(entryId: string): Promise<void> {
  const actor = requireCapability(await requireActor(), "time.track");
  const db = scopedDb(actor.organizationId);

  const entry = await db.timeEntry.findFirst({
    where: { id: entryId, membershipId: actor.membershipId },
  });
  if (!entry) throw new Error("Time entry not found.");
  if (entry.startedAt === null) return; // already stopped

  await db.timeEntry.update({
    where: { id: entryId },
    data: {
      durationSeconds:
        entry.durationSeconds +
        elapsedSeconds(entry.startedAt.getTime(), Date.now()),
      startedAt: null,
    },
  });

  revalidatePath("/time");
}
