"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";
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
