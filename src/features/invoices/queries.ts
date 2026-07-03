// The invoices read layer (G10): invoice pages read these view models, never
// raw rows — the same one-place discipline as the projects read layer, and
// the place a `rate.view` field-strip lands if a role ever holds
// `invoice.manage` without it (same deliberate deferral as projects/queries).
// All money leaves here already formatted (G4).

import type { Actor } from "@/lib/authz";
import { formatMoney } from "@/lib/money";
import { scopedDb } from "@/lib/scope";
import { formatDuration } from "@/features/time/duration";
import type { InvoiceStatus } from "./validate";

export type InvoiceListRow = {
  id: string;
  number: string | null; // null = draft; assigned only at finalize
  status: InvoiceStatus;
  clientName: string;
  issueDate: string | null;
  // Snapshot total for finalized invoices; drafts derive live (seg 3) and
  // show null until then.
  totalLabel: string | null;
};

export async function listInvoices(actor: Actor): Promise<InvoiceListRow[]> {
  const invoices = await scopedDb(actor.organizationId).invoice.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  return invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    status: invoice.status as InvoiceStatus,
    clientName: invoice.client.name,
    issueDate: invoice.issueDate,
    totalLabel:
      invoice.totalMinor !== null && invoice.currency !== null
        ? formatMoney(invoice.totalMinor, invoice.currency)
        : null,
  }));
}

// --- The new-invoice picker ---

// One candidate row per billable thing a project can feed an invoice: an
// hourly project offers its unbilled pool, a fixed-fee project offers its fee
// (once — a billed fee drops out here and is re-checked at finalize).
// Non-billable projects never appear.
export type CandidateProject = {
  projectId: string;
  projectName: string;
  archived: boolean;
  // "3:30 unbilled" for hourly, "€18,000.00 fixed fee" for fee projects —
  // the line that lets the user judge whether selecting it is worth it.
  detail: string;
};

export type InvoiceClientCandidate = {
  clientId: string;
  clientName: string;
  currency: string;
  projects: CandidateProject[];
};

// Active clients with what each project could feed an invoice right now.
// The unbilled pool predicate here (invoiceId null, not running, billable
// assignment, hourly project) is the same one the draft derives from and
// finalize re-runs inside its transaction — the read layer keeps them in step.
export async function listNewInvoiceCandidates(
  actor: Actor,
): Promise<InvoiceClientCandidate[]> {
  const db = scopedDb(actor.organizationId);
  const [clients, projects, poolEntries] = await Promise.all([
    db.client.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: { billingType: { in: ["hourly", "fixed_fee"] } },
      orderBy: { name: "asc" },
    }),
    db.timeEntry.findMany({
      where: {
        invoiceId: null,
        startedAt: null,
        durationSeconds: { gt: 0 },
        projectTask: { billable: true, project: { billingType: "hourly" } },
      },
      select: {
        durationSeconds: true,
        projectTask: { select: { projectId: true } },
      },
    }),
  ]);

  const unbilledSeconds = new Map<string, number>();
  for (const entry of poolEntries) {
    const projectId = entry.projectTask.projectId;
    unbilledSeconds.set(
      projectId,
      (unbilledSeconds.get(projectId) ?? 0) + entry.durationSeconds,
    );
  }

  return clients.map((client) => ({
    clientId: client.id,
    clientName: client.name,
    currency: client.currency,
    projects: projects
      .filter((project) => project.clientId === client.id)
      .flatMap((project) => {
        const archived = project.archivedAt !== null;
        if (project.billingType === "hourly") {
          const seconds = unbilledSeconds.get(project.id) ?? 0;
          // An archived hourly project only matters while unbilled work
          // remains on it; an active one is offered even when empty (the
          // draft derives live, so time logged later still flows in).
          if (archived && seconds === 0) return [];
          return [
            {
              projectId: project.id,
              projectName: project.name,
              archived,
              detail:
                seconds > 0
                  ? `${formatDuration(seconds)} unbilled`
                  : "no unbilled time yet",
            },
          ];
        }
        // Fixed fee: offered until some invoice bills it (anti-double-bill).
        if (project.fixedFeeInvoiceId !== null || project.fixedFeeMinor === null)
          return [];
        return [
          {
            projectId: project.id,
            projectName: project.name,
            archived,
            detail: `${formatMoney(project.fixedFeeMinor, client.currency)} fixed fee`,
          },
        ];
      }),
  }));
}
