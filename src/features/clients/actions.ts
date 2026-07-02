"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";
import { parseClientInput, type ClientFieldErrors } from "./validate";

export type CreateClientResult =
  | { status: "success" }
  | { status: "error"; errors: ClientFieldErrors };

// Server actions are public HTTP endpoints regardless of which UI calls them,
// so the guard chain runs here, not in the component: requireActor()
// authenticates (G3), requireCapability authorizes (G2/G10), and scopedDb
// stamps + filters the org (G1). Currency arrives pre-filled from the org
// default by the form, but the client owns its value from creation on.
export async function createClient(
  formData: FormData,
): Promise<CreateClientResult> {
  const actor = requireCapability(await requireActor(), "client.manage");

  const parsed = parseClientInput({
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson"),
    email: formData.get("email"),
    billingAddress: formData.get("billingAddress"),
    currency: formData.get("currency"),
  });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  await scopedDb(actor.organizationId).client.create({
    // Prisma's create type requires organizationId (the extension can't relax
    // types); scopeArgs re-stamps it regardless, so a wrong value can't stick.
    data: {
      ...parsed.data,
      organizationId: actor.organizationId,
      createdById: actor.membershipId,
    },
  });

  revalidatePath("/clients");
  return { status: "success" };
}
