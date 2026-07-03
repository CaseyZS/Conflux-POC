"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";
import { parseProjectInput, type ProjectFieldErrors } from "./validate";

export type SaveProjectResult =
  | { status: "success" }
  | { status: "error"; errors: ProjectFieldErrors };

function projectFields(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get("name"),
    billingType: formData.get("billingType"),
    billingMethod: formData.get("billingMethod"),
    hourlyRate: formData.get("hourlyRate"),
    fixedFee: formData.get("fixedFee"),
  };
}

// Guard chain as everywhere: requireActor (G3) → requireCapability (G2/G10)
// → scopedDb (G1). The client lookup does double duty: it proves the id
// belongs to this org (a foreign id finds nothing) and supplies the currency
// the money fields parse against (G5: projects derive currency, never store
// it). Archived clients don't take new projects — archive means retired.
export async function createProject(
  clientId: string,
  formData: FormData,
): Promise<SaveProjectResult> {
  const actor = requireCapability(await requireActor(), "project.manage");
  const db = scopedDb(actor.organizationId);

  const client = await db.client.findFirst({
    where: { id: clientId, archivedAt: null },
  });
  if (!client) throw new Error("Client not found or archived.");

  const parsed = parseProjectInput(projectFields(formData), client.currency);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  await db.project.create({
    data: {
      ...parsed.data,
      clientId,
      organizationId: actor.organizationId,
      createdById: actor.membershipId,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return { status: "success" };
}

export async function updateProject(
  projectId: string,
  formData: FormData,
): Promise<SaveProjectResult> {
  const actor = requireCapability(await requireActor(), "project.manage");
  const db = scopedDb(actor.organizationId);

  // Reads through the project to its client for the currency; a foreign or
  // deleted id stops here.
  const project = await db.project.findFirst({
    where: { id: projectId },
    include: { client: true },
  });
  if (!project) throw new Error("Project not found.");

  const parsed = parseProjectInput(
    projectFields(formData),
    project.client.currency,
  );
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  await db.project.update({ where: { id: projectId }, data: parsed.data });

  revalidatePath(`/clients/${project.clientId}`);
  return { status: "success" };
}

// Same G12 shape as clients: archive is a status flip, never a delete.
export async function setProjectArchived(
  projectId: string,
  archived: boolean,
): Promise<void> {
  const actor = requireCapability(await requireActor(), "project.manage");

  const project = await scopedDb(actor.organizationId).project.update({
    where: { id: projectId },
    data: { archivedAt: archived ? new Date() : null },
  });

  revalidatePath(`/clients/${project.clientId}`);
}
