"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";
import { parseOrgSettings, type OrgSettingsFieldErrors } from "./validate";

export type SaveOrgSettingsResult =
  | { status: "success" }
  | { status: "error"; errors: OrgSettingsFieldErrors };

// Same guard chain as every other write: requireActor authenticates (G3),
// requireCapability authorizes (G2/G10), scopedDb pins the org (G1) — here the
// org IS the tenant row, so the update targets it by its own id. These defaults
// pre-fill new clients/invoices; they're snapshotted onto an invoice only at
// finalize, so changing them never rewrites an existing invoice (G5).
export async function updateOrgSettings(
  formData: FormData,
): Promise<SaveOrgSettingsResult> {
  const actor = requireCapability(await requireActor(), "company.settings");

  const parsed = parseOrgSettings({
    name: formData.get("name"),
    fromDetails: formData.get("fromDetails"),
    defaultCurrency: formData.get("defaultCurrency"),
    defaultTaxRate: formData.get("defaultTaxRate"),
    defaultPaymentTermsDays: formData.get("defaultPaymentTermsDays"),
    invoiceNumberPrefix: formData.get("invoiceNumberPrefix"),
    invoiceFooter: formData.get("invoiceFooter"),
  });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  await scopedDb(actor.organizationId).organization.update({
    where: { id: actor.organizationId },
    data: parsed.data,
  });

  revalidatePath("/settings");
  return { status: "success" };
}
