"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";
import { parseTaskInput, type TaskFieldErrors } from "./validate";

export type SaveTaskResult =
  | { status: "success" }
  | { status: "error"; errors: TaskFieldErrors };

// Tasks are managed under project.manage: the capability list has no
// task-specific entry, and access-control.md groups tasks with the work that
// Managers run (clients/projects/tasks).

// Task names are unique per org (@@unique([organizationId, name])) — the
// shared list is a vocabulary, and two entries spelled the same would be
// indistinguishable when assigning. The DB constraint is the arbiter; we
// translate its violation into a field error instead of pre-checking (a
// pre-check would race with concurrent creates anyway).
function duplicateNameError(error: unknown): SaveTaskResult | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return {
      status: "error",
      errors: { name: "A task with this name already exists." },
    };
  }
  return null;
}

export async function createTask(formData: FormData): Promise<SaveTaskResult> {
  const actor = requireCapability(await requireActor(), "project.manage");

  const parsed = parseTaskInput({
    name: formData.get("name"),
    defaultBillable: formData.get("defaultBillable"),
  });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  try {
    await scopedDb(actor.organizationId).task.create({
      data: {
        ...parsed.data,
        organizationId: actor.organizationId,
        createdById: actor.membershipId,
      },
    });
  } catch (error) {
    const duplicate = duplicateNameError(error);
    if (duplicate) return duplicate;
    throw error;
  }

  revalidatePath("/tasks");
  return { status: "success" };
}

export async function updateTask(
  taskId: string,
  formData: FormData,
): Promise<SaveTaskResult> {
  const actor = requireCapability(await requireActor(), "project.manage");

  const parsed = parseTaskInput({
    name: formData.get("name"),
    defaultBillable: formData.get("defaultBillable"),
  });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  try {
    await scopedDb(actor.organizationId).task.update({
      where: { id: taskId },
      data: parsed.data,
    });
  } catch (error) {
    // Renaming onto an existing task hits the same unique constraint.
    const duplicate = duplicateNameError(error);
    if (duplicate) return duplicate;
    throw error;
  }

  revalidatePath("/tasks");
  return { status: "success" };
}

// Archive is a status flip, never a delete (G12): existing project
// assignments and time entries keep working; the task just stops appearing
// in active lists and pickers.
export async function setTaskArchived(
  taskId: string,
  archived: boolean,
): Promise<void> {
  const actor = requireCapability(await requireActor(), "project.manage");

  await scopedDb(actor.organizationId).task.update({
    where: { id: taskId },
    data: { archivedAt: archived ? new Date() : null },
  });

  revalidatePath("/tasks");
}
