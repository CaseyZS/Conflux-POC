"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";

export type InvoiceActionResult = { status: "error"; message: string };

// Create a draft: the client plus which of its projects feed the invoice
// (InvoiceProject rows). Nothing is computed or reserved here — a draft
// derives its time lines live until finalize — so this is a cheap, deletable
// row. Draft choices that have org defaults (terms, tax, footer) are copied
// in at creation and owned by the invoice from then on; the schema's
// snapshot columns stay NULL until finalize (G5).
export async function createInvoice(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const db = scopedDb(actor.organizationId);

  const clientIdRaw = formData.get("clientId");
  const clientId = typeof clientIdRaw === "string" ? clientIdRaw : "";
  const client = await db.client.findFirst({
    where: { id: clientId, archivedAt: null },
  });
  if (!client) {
    return { status: "error", message: "Choose an active client." };
  }

  const projectIds = [
    ...new Set(
      formData.getAll("projects").filter((v): v is string => typeof v === "string"),
    ),
  ];
  const projects = await db.project.findMany({
    where: { id: { in: projectIds }, clientId: client.id },
  });
  if (projects.length !== projectIds.length) {
    return {
      status: "error",
      message: "Every selected project must belong to the chosen client.",
    };
  }
  for (const project of projects) {
    if (project.billingType === "non_billable") {
      return {
        status: "error",
        message: `${project.name} is non-billable and can't feed an invoice.`,
      };
    }
    if (
      project.billingType === "fixed_fee" &&
      project.fixedFeeInvoiceId !== null
    ) {
      return {
        status: "error",
        message: `${project.name}'s fixed fee is already on an invoice.`,
      };
    }
  }

  const org = await db.organization.findFirst();
  if (!org) throw new Error("Organization not found.");

  const invoice = await db.invoice.create({
    data: {
      organizationId: actor.organizationId,
      clientId: client.id,
      paymentTermsDays: org.defaultPaymentTermsDays,
      taxRateBps: org.defaultTaxRateBps > 0 ? org.defaultTaxRateBps : null,
      footer: org.invoiceFooter,
    },
  });
  if (projects.length > 0) {
    // Which source a project feeds follows its billing type — hourly time or
    // the flat fee; both flags exist on the row so a both-kinds project stays
    // an additive change, not a schema one.
    await db.invoiceProject.createMany({
      data: projects.map((project) => ({
        invoiceId: invoice.id,
        projectId: project.id,
        organizationId: actor.organizationId,
        includeTime: project.billingType === "hourly",
        includeFixedFee: project.billingType === "fixed_fee",
      })),
    });
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}
