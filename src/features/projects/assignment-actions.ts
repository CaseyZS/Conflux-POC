"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";
import { parseAssignmentInput, type AssignmentFieldErrors } from "./validate";

export type SaveAssignmentResult =
  | { status: "success" }
  | { status: "error"; errors: AssignmentFieldErrors };

// Whether an assignment carries a rate is the *project's* decision (hourly +
// per_task), so every action re-derives it from the project row it just
// fetched — the client is never trusted to say which fields apply.
function perTaskRates(project: {
  billingType: string;
  billingMethod: string | null;
}): boolean {
  return (
    project.billingType === "hourly" && project.billingMethod === "per_task"
  );
}

export async function assignTask(
  projectId: string,
  formData: FormData,
): Promise<SaveAssignmentResult> {
  const actor = requireCapability(await requireActor(), "project.manage");
  const db = scopedDb(actor.organizationId);

  // The project anchors everything: org check, archived check, currency
  // source, and the per-task-rates decision.
  const project = await db.project.findFirst({
    where: { id: projectId, archivedAt: null },
    include: { client: true },
  });
  if (!project) throw new Error("Project not found or archived.");

  const taskIdRaw = formData.get("taskId");
  const taskId = typeof taskIdRaw === "string" ? taskIdRaw : "";
  const task = await db.task.findFirst({
    where: { id: taskId, archivedAt: null },
  });
  if (!task) {
    return { status: "error", errors: { taskId: "Choose a task." } };
  }

  const parsed = parseAssignmentInput(
    {
      billable: formData.get("billable"),
      hourlyRate: formData.get("hourlyRate"),
    },
    project.client.currency,
    perTaskRates(project),
  );
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  try {
    await db.projectTask.create({
      data: {
        ...parsed.data,
        projectId: project.id,
        taskId: task.id,
        organizationId: actor.organizationId,
      },
    });
  } catch (error) {
    // @@unique([projectId, taskId]): the picker excludes assigned tasks, so
    // this is a race or a stale form — point at the existing row instead.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        errors: {
          taskId: "This task is already assigned (check the retired list).",
        },
      };
    }
    throw error;
  }

  revalidatePath(`/projects/${project.id}`);
  return { status: "success" };
}

export async function updateAssignment(
  assignmentId: string,
  formData: FormData,
): Promise<SaveAssignmentResult> {
  const actor = requireCapability(await requireActor(), "project.manage");
  const db = scopedDb(actor.organizationId);

  const assignment = await db.projectTask.findFirst({
    where: { id: assignmentId },
    include: { project: { include: { client: true } } },
  });
  if (!assignment) throw new Error("Assignment not found.");

  const parsed = parseAssignmentInput(
    {
      billable: formData.get("billable"),
      hourlyRate: formData.get("hourlyRate"),
    },
    assignment.project.client.currency,
    perTaskRates(assignment.project),
  );
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  await db.projectTask.update({
    where: { id: assignmentId },
    data: parsed.data,
  });

  revalidatePath(`/projects/${assignment.projectId}`);
  return { status: "success" };
}

// Retire/reactivate flips `active` (G12): a retired assignment leaves the
// time-entry picker but keeps its row — logged hours still point at it, and
// its (project, task) slot is reclaimed by reactivating, not re-assigning.
export async function setAssignmentActive(
  assignmentId: string,
  active: boolean,
): Promise<void> {
  const actor = requireCapability(await requireActor(), "project.manage");

  const assignment = await scopedDb(
    actor.organizationId,
  ).projectTask.update({
    where: { id: assignmentId },
    data: { active },
  });

  revalidatePath(`/projects/${assignment.projectId}`);
}
