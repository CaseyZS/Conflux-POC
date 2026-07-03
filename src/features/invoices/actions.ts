"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { lineAmountMinor } from "@/lib/money";
import { scopedDb, type ScopedDb } from "@/lib/scope";
import {
  parseDraftSettings,
  parseManualLine,
  type DraftSettingsFieldErrors,
  type ManualLineFieldErrors,
} from "./validate";

export type InvoiceActionResult = { status: "error"; message: string };

// Every mutation below touches drafts only: finalized invoices are immutable
// (no void/credit path in the POC), so "is it still a draft" is re-checked
// server-side on each call — a stale editor tab must not edit a sent invoice.
async function findDraft(db: ScopedDb, invoiceId: string) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId },
    include: { client: true },
  });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== "draft") {
    throw new Error("This invoice is finalized and can't be changed.");
  }
  return invoice;
}

function revalidateInvoice(invoiceId: string) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
}

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

// --- Draft settings (grouping, toggles, dates, discount, tax, PO, footer) ---

export type SaveDraftSettingsResult =
  | { status: "success" }
  | { status: "error"; errors: DraftSettingsFieldErrors };

export async function updateDraftSettings(
  invoiceId: string,
  formData: FormData,
): Promise<SaveDraftSettingsResult> {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const db = scopedDb(actor.organizationId);
  const invoice = await findDraft(db, invoiceId);

  const parsed = parseDraftSettings(
    {
      grouping: formData.get("grouping"),
      showDate: formData.get("showDate"),
      showPerson: formData.get("showPerson"),
      showTask: formData.get("showTask"),
      showNote: formData.get("showNote"),
      issueDate: formData.get("issueDate"),
      dueDate: formData.get("dueDate"),
      paymentTermsDays: formData.get("paymentTermsDays"),
      poNumber: formData.get("poNumber"),
      discountKind: formData.get("discountKind"),
      discountValue: formData.get("discountValue"),
      taxRate: formData.get("taxRate"),
      footer: formData.get("footer"),
    },
    invoice.client.currency,
  );
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  await db.invoice.update({ where: { id: invoiceId }, data: parsed.data });

  revalidateInvoice(invoiceId);
  return { status: "success" };
}

// --- Project selections (which projects feed the draft) ---

export async function updateProjectSelections(
  invoiceId: string,
  formData: FormData,
): Promise<InvoiceActionResult | { status: "success" }> {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const db = scopedDb(actor.organizationId);
  const invoice = await findDraft(db, invoiceId);

  const projectIds = [
    ...new Set(
      formData.getAll("projects").filter((v): v is string => typeof v === "string"),
    ),
  ];
  const projects = await db.project.findMany({
    where: { id: { in: projectIds }, clientId: invoice.clientId },
  });
  if (projects.length !== projectIds.length) {
    return {
      status: "error",
      message: "Every selected project must belong to this invoice's client.",
    };
  }
  if (projects.some((p) => p.billingType === "non_billable")) {
    return {
      status: "error",
      message: "Non-billable projects can't feed an invoice.",
    };
  }

  // Replace the selection set wholesale — it's what the checkboxes said, and
  // selections carry no other state worth preserving.
  await db.invoiceProject.deleteMany({ where: { invoiceId } });
  if (projects.length > 0) {
    await db.invoiceProject.createMany({
      data: projects.map((project) => ({
        invoiceId,
        projectId: project.id,
        organizationId: actor.organizationId,
        includeTime: project.billingType === "hourly",
        includeFixedFee: project.billingType === "fixed_fee",
      })),
    });
  }

  revalidateInvoice(invoiceId);
  return { status: "success" };
}

// --- Manual lines (exist as rows from the draft on; source = "manual") ---

export type SaveManualLineResult =
  | { status: "success" }
  | { status: "error"; errors: ManualLineFieldErrors };

async function validateAttribution(
  db: ScopedDb,
  clientId: string,
  projectId: string | null,
): Promise<boolean> {
  if (projectId === null) return true;
  const project = await db.project.findFirst({
    where: { id: projectId, clientId },
  });
  return project !== null;
}

export async function addManualLine(
  invoiceId: string,
  formData: FormData,
): Promise<SaveManualLineResult> {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const db = scopedDb(actor.organizationId);
  const invoice = await findDraft(db, invoiceId);

  const parsed = parseManualLine(
    {
      description: formData.get("description"),
      quantity: formData.get("quantity"),
      unitRate: formData.get("unitRate"),
      projectId: formData.get("projectId"),
    },
    invoice.client.currency,
  );
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  if (!(await validateAttribution(db, invoice.clientId, parsed.data.projectId))) {
    return {
      status: "error",
      errors: { description: "That project doesn't belong to this client." },
    };
  }

  const last = await db.invoiceLine.findFirst({
    where: { invoiceId },
    orderBy: { position: "desc" },
  });
  await db.invoiceLine.create({
    data: {
      organizationId: actor.organizationId,
      invoiceId,
      source: "manual",
      description: parsed.data.description,
      quantityMilli: parsed.data.quantityMilli,
      unitRateMinor: parsed.data.unitRateMinor,
      amountMinor: lineAmountMinor(
        parsed.data.quantityMilli,
        parsed.data.unitRateMinor,
      ),
      projectId: parsed.data.projectId,
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidateInvoice(invoiceId);
  return { status: "success" };
}

export async function updateManualLine(
  lineId: string,
  formData: FormData,
): Promise<SaveManualLineResult> {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const db = scopedDb(actor.organizationId);

  const line = await db.invoiceLine.findFirst({
    where: { id: lineId, source: "manual" },
  });
  if (!line) throw new Error("Line not found.");
  const invoice = await findDraft(db, line.invoiceId);

  const parsed = parseManualLine(
    {
      description: formData.get("description"),
      quantity: formData.get("quantity"),
      unitRate: formData.get("unitRate"),
      projectId: formData.get("projectId"),
    },
    invoice.client.currency,
  );
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  if (!(await validateAttribution(db, invoice.clientId, parsed.data.projectId))) {
    return {
      status: "error",
      errors: { description: "That project doesn't belong to this client." },
    };
  }

  await db.invoiceLine.update({
    where: { id: lineId },
    data: {
      description: parsed.data.description,
      quantityMilli: parsed.data.quantityMilli,
      unitRateMinor: parsed.data.unitRateMinor,
      amountMinor: lineAmountMinor(
        parsed.data.quantityMilli,
        parsed.data.unitRateMinor,
      ),
      projectId: parsed.data.projectId,
    },
  });

  revalidateInvoice(line.invoiceId);
  return { status: "success" };
}

export async function deleteManualLine(lineId: string): Promise<void> {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const db = scopedDb(actor.organizationId);

  const line = await db.invoiceLine.findFirst({
    where: { id: lineId, source: "manual" },
  });
  if (!line) throw new Error("Line not found.");
  await findDraft(db, line.invoiceId); // drafts only

  await db.invoiceLine.delete({ where: { id: lineId } });

  revalidateInvoice(line.invoiceId);
}

// Deleting a draft removes just the draft and its manual lines + selections
// (cascade) — no time entries were ever linked, so none need releasing.
// Finalized invoices are financial records: findDraft refuses them (G12).
export async function deleteDraft(invoiceId: string): Promise<void> {
  const actor = requireCapability(await requireActor(), "invoice.manage");
  const db = scopedDb(actor.organizationId);
  await findDraft(db, invoiceId);

  await db.invoice.delete({ where: { id: invoiceId } });

  revalidatePath("/invoices");
  redirect("/invoices");
}
