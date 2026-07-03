// The invoices read layer (G10): invoice pages read these view models, never
// raw rows — the same one-place discipline as the projects read layer, and
// the place a `rate.view` field-strip lands if a role ever holds
// `invoice.manage` without it (same deliberate deferral as projects/queries).
// All money leaves here already formatted (G4).

import type { Actor } from "@/lib/authz";
import { addDays, todayLocal } from "@/lib/dates";
import { formatMoney, formatMoneyInput } from "@/lib/money";
import { scopedDb } from "@/lib/scope";
import { formatDuration } from "@/features/time/duration";
import { computeDraft } from "./draft";
import { formatQuantityMilli } from "./derive";
import {
  formatBpsPercent,
  type InvoiceGrouping,
  type InvoiceStatus,
} from "./validate";

export type InvoiceListRow = {
  id: string;
  number: string | null; // null = draft; assigned only at finalize
  status: InvoiceStatus;
  clientName: string;
  issueDate: string | null;
  totalLabel: string;
};

export async function listInvoices(actor: Actor): Promise<InvoiceListRow[]> {
  const db = scopedDb(actor.organizationId);
  const invoices = await db.invoice.findMany({
    include: {
      client: true,
      projectSelections: { include: { project: true } },
      lines: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    invoices.map(async (invoice) => {
      // Finalized totals come from the snapshot; a draft's derive live —
      // the list total is the same number its editor shows (G5).
      let totalMinor: number;
      let currency: string;
      if (invoice.totalMinor !== null && invoice.currency !== null) {
        totalMinor = invoice.totalMinor;
        currency = invoice.currency;
      } else {
        totalMinor = (await computeDraft(db, invoice)).totals.totalMinor;
        currency = invoice.client.currency;
      }
      return {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status as InvoiceStatus,
        clientName: invoice.client.name,
        issueDate: invoice.issueDate,
        totalLabel: formatMoney(totalMinor, currency),
      };
    }),
  );
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

// --- The invoice detail view (draft editor + finalized document) ---

export type InvoiceLineView = {
  key: string; // stable render key; derived lines have no row id
  id: string | null; // a stored row's id — manual lines are editable via it
  source: "time" | "fixed_fee" | "manual";
  description: string;
  quantityLabel: string;
  rateLabel: string;
  amountLabel: string;
  // Manual-line edit prefills (null on derived/finalized lines).
  quantityInput: string | null;
  rateInput: string | null;
  projectId: string | null;
};

// A project row in the draft's "what feeds this invoice" editor.
export type SelectionChoice = CandidateProject & { selected: boolean };

export type InvoiceView = {
  id: string;
  status: InvoiceStatus;
  number: string | null;
  clientId: string;
  clientName: string;
  currency: string;
  grouping: InvoiceGrouping;
  showDate: boolean;
  showPerson: boolean;
  showTask: boolean;
  showNote: boolean;
  issueDate: string | null; // as stored; null = "today" until finalize
  dueDate: string | null; // as stored; null = derived from terms
  effectiveIssueDate: string;
  effectiveDueDate: string;
  paymentTermsDays: number;
  poNumber: string | null;
  discountKind: "none" | "percent" | "flat";
  discountValueInput: string;
  taxRateInput: string; // "" = no tax
  footer: string | null;
  billTo: { name: string; contact: string | null; address: string | null };
  from: { name: string; details: string | null };
  lines: InvoiceLineView[];
  subtotalLabel: string;
  discountSummary: string | null; // "Discount (10%)" / "Discount" — null when none
  discountLabel: string | null;
  taxSummary: string | null; // "Tax (8.25%)" — null when no tax applies
  taxLabel: string | null;
  totalLabel: string;
  // Draft-editor data (empty on finalized invoices).
  selectionChoices: SelectionChoice[];
  attributableProjects: { id: string; name: string }[];
};

// One view for both lifecycle halves, branching on G5's rule: a draft
// derives currency/lines/totals/bill-to/from live, a finalized invoice reads
// only its snapshot — so a client renamed after finalize shows its old name
// on the sent invoice and its new one on drafts, which is the whole point.
export async function getInvoiceView(
  actor: Actor,
  invoiceId: string,
): Promise<InvoiceView | null> {
  const db = scopedDb(actor.organizationId);
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId },
    include: {
      client: true,
      projectSelections: { include: { project: true } },
      lines: true,
    },
  });
  if (!invoice) return null;

  const status = invoice.status as InvoiceStatus;
  const draft = status === "draft";
  const currency = draft
    ? invoice.client.currency
    : (invoice.currency ?? invoice.client.currency);

  const money = (minor: number) => formatMoney(minor, currency);

  let lines: InvoiceLineView[];
  let subtotalMinor: number;
  let discountMinor: number;
  let taxMinor: number;
  let totalMinor: number;

  if (draft) {
    const computed = await computeDraft(db, invoice);
    const derived = [...computed.timeLines, ...computed.feeLines].map(
      (line, index) => ({
        key: `derived-${index}`,
        id: null,
        source: ("projectId" in line ? "fixed_fee" : "time") as
          | "time"
          | "fixed_fee",
        description: line.description,
        quantityLabel: formatQuantityMilli(line.quantityMilli),
        rateLabel: money(line.unitRateMinor),
        amountLabel: money(line.amountMinor),
        quantityInput: null,
        rateInput: null,
        projectId: null,
      }),
    );
    const manual = computed.manualLines.map((line) => ({
      key: line.id,
      id: line.id,
      source: "manual" as const,
      description: line.description,
      quantityLabel: formatQuantityMilli(line.quantityMilli),
      rateLabel: money(line.unitRateMinor),
      amountLabel: money(line.amountMinor),
      quantityInput: formatQuantityMilli(line.quantityMilli),
      rateInput: formatMoneyInput(line.unitRateMinor, currency),
      projectId: line.projectId,
    }));
    lines = [...derived, ...manual];
    ({
      subtotalMinor,
      discountMinor,
      taxMinor,
      totalMinor,
    } = computed.totals);
  } else {
    lines = [...invoice.lines]
      .sort((a, b) => a.position - b.position)
      .map((line) => ({
        key: line.id,
        id: line.id,
        source: line.source as InvoiceLineView["source"],
        description: line.description,
        quantityLabel: formatQuantityMilli(line.quantityMilli),
        rateLabel: money(line.unitRateMinor),
        amountLabel: money(line.amountMinor),
        quantityInput: null,
        rateInput: null,
        projectId: line.projectId,
      }));
    subtotalMinor = invoice.subtotalMinor ?? 0;
    discountMinor = invoice.discountMinor ?? 0;
    taxMinor = invoice.taxMinor ?? 0;
    totalMinor = invoice.totalMinor ?? 0;
  }

  const effectiveIssueDate = invoice.issueDate ?? todayLocal();
  const effectiveDueDate =
    invoice.dueDate ?? addDays(effectiveIssueDate, invoice.paymentTermsDays);

  const discountKind =
    invoice.discountPercentBps !== null
      ? "percent"
      : invoice.discountFlatMinor !== null
        ? "flat"
        : "none";
  const hasDiscount = discountKind !== "none";
  const hasTax = invoice.taxRateBps !== null;

  // The draft editor's selection choices: this client's candidates (the
  // new-invoice list) merged with what's currently selected, so a selected
  // project that stopped being a candidate can still be seen and unchecked.
  let selectionChoices: SelectionChoice[] = [];
  let attributableProjects: { id: string; name: string }[] = [];
  if (draft) {
    const selectedIds = new Set(
      invoice.projectSelections.map((s) => s.projectId),
    );
    const candidates =
      (await listNewInvoiceCandidates(actor)).find(
        (c) => c.clientId === invoice.clientId,
      )?.projects ?? [];
    selectionChoices = candidates.map((candidate) => ({
      ...candidate,
      selected: selectedIds.has(candidate.projectId),
    }));
    for (const selection of invoice.projectSelections) {
      if (!selectionChoices.some((c) => c.projectId === selection.projectId)) {
        selectionChoices.push({
          projectId: selection.projectId,
          projectName: selection.project.name,
          archived: selection.project.archivedAt !== null,
          detail: "nothing billable right now",
          selected: true,
        });
      }
    }

    attributableProjects = (
      await db.project.findMany({
        where: { clientId: invoice.clientId, archivedAt: null },
        orderBy: { name: "asc" },
      })
    ).map((project) => ({ id: project.id, name: project.name }));
  }

  return {
    id: invoice.id,
    status,
    number: invoice.number,
    clientId: invoice.clientId,
    clientName: draft
      ? invoice.client.name
      : (invoice.billToName ?? invoice.client.name),
    currency,
    grouping: invoice.grouping as InvoiceGrouping,
    showDate: invoice.showDate,
    showPerson: invoice.showPerson,
    showTask: invoice.showTask,
    showNote: invoice.showNote,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    effectiveIssueDate,
    effectiveDueDate,
    paymentTermsDays: invoice.paymentTermsDays,
    poNumber: invoice.poNumber,
    discountKind,
    discountValueInput:
      discountKind === "percent"
        ? formatBpsPercent(invoice.discountPercentBps ?? 0)
        : discountKind === "flat"
          ? formatMoneyInput(invoice.discountFlatMinor ?? 0, currency)
          : "",
    taxRateInput: hasTax ? formatBpsPercent(invoice.taxRateBps ?? 0) : "",
    footer: invoice.footer,
    billTo: draft
      ? {
          name: invoice.client.name,
          contact: invoice.client.contactPerson,
          address: invoice.client.billingAddress,
        }
      : {
          name: invoice.billToName ?? "",
          contact: invoice.billToContact,
          address: invoice.billToAddress,
        },
    from: draft
      ? await liveFrom(db)
      : { name: invoice.fromName ?? "", details: invoice.fromDetails },
    lines,
    subtotalLabel: money(subtotalMinor),
    discountSummary: hasDiscount
      ? discountKind === "percent"
        ? `Discount (${formatBpsPercent(invoice.discountPercentBps ?? 0)}%)`
        : "Discount"
      : null,
    discountLabel: hasDiscount ? `−${money(discountMinor)}` : null,
    taxSummary: hasTax
      ? `Tax (${formatBpsPercent(invoice.taxRateBps ?? 0)}%)`
      : null,
    taxLabel: hasTax ? money(taxMinor) : null,
    totalLabel: money(totalMinor),
    selectionChoices,
    attributableProjects,
  };
}

async function liveFrom(db: ReturnType<typeof scopedDb>) {
  const org = await db.organization.findFirst();
  return { name: org?.name ?? "", details: org?.fromDetails ?? null };
}
