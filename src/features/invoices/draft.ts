// The one draft computation: selections + live unbilled pool → lines and
// totals. Both the read layer (what the editor shows) and finalize (what the
// snapshot writes, re-run inside its transaction) call this, so what you saw
// is what gets snapshotted — the G5 "derive until finalize" rule has exactly
// one implementation.

import { invoiceTotals, type InvoiceTotals } from "@/lib/money";
import type { ScopedDb } from "@/lib/scope";
import {
  deriveFeeLine,
  deriveTimeLines,
  type DerivedLine,
  type PoolEntryFact,
} from "./derive";
import type { InvoiceGrouping } from "./validate";

// The invoice fields the computation reads — structurally satisfied by a
// Prisma row loaded with projectSelections { include: { project } } and lines.
export type DraftSource = {
  id: string;
  grouping: string;
  showDate: boolean;
  showPerson: boolean;
  showTask: boolean;
  showNote: boolean;
  discountPercentBps: number | null;
  discountFlatMinor: number | null;
  taxRateBps: number | null;
  projectSelections: {
    includeTime: boolean;
    includeFixedFee: boolean;
    project: {
      id: string;
      name: string;
      billingType: string;
      billingMethod: string | null;
      hourlyRateMinor: number | null;
      fixedFeeMinor: number | null;
      fixedFeeInvoiceId: string | null;
    };
  }[];
  lines: {
    id: string;
    source: string;
    description: string;
    quantityMilli: number;
    unitRateMinor: number;
    amountMinor: number;
    projectId: string | null;
    position: number;
  }[];
};

// The slice of the scoped client the computation needs — satisfied by the
// client itself and by the transaction client finalize hands in.
export type DraftDb = Pick<ScopedDb, "timeEntry">;

export type ComputedDraft = {
  timeLines: DerivedLine[];
  // Fee lines keep their project id — finalize stamps it onto the line row
  // and sets the project's anti-double-bill link.
  feeLines: (DerivedLine & { projectId: string })[];
  // Manual lines pass through from the stored rows, in draft print order.
  manualLines: DraftSource["lines"];
  // Every entry the time lines were derived from — what finalize links.
  poolEntryIds: string[];
  totals: InvoiceTotals;
};

export async function computeDraft(
  db: DraftDb,
  invoice: DraftSource,
): Promise<ComputedDraft> {
  // Selections are re-checked against *current* project state: a selection
  // whose project changed billing type derives nothing, and a fee already
  // billed elsewhere drops out (the anti-double-bill re-check that makes
  // finalize-inside-a-transaction safe).
  const timeProjects = invoice.projectSelections
    .filter((s) => s.includeTime && s.project.billingType === "hourly")
    .map((s) => s.project);
  const feeProjects = invoice.projectSelections
    .filter(
      (s) =>
        s.includeFixedFee &&
        s.project.billingType === "fixed_fee" &&
        s.project.fixedFeeInvoiceId === null &&
        s.project.fixedFeeMinor !== null,
    )
    .map((s) => s.project);

  let timeLines: DerivedLine[] = [];
  let poolEntryIds: string[] = [];
  if (timeProjects.length > 0) {
    const rateByProject = new Map(
      timeProjects.map((p) => [
        p.id,
        { method: p.billingMethod, projectRateMinor: p.hourlyRateMinor },
      ]),
    );
    // The unbilled pool (requirements/invoicing.md): never billed, billable
    // per the assignment, not running (a live timer's total is still moving),
    // and non-empty. Same predicate as the new-invoice candidate counts.
    const entries = await db.timeEntry.findMany({
      where: {
        invoiceId: null,
        startedAt: null,
        durationSeconds: { gt: 0 },
        projectTask: {
          billable: true,
          projectId: { in: timeProjects.map((p) => p.id) },
        },
      },
      include: {
        projectTask: { include: { task: true } },
        membership: { include: { user: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    const facts: PoolEntryFact[] = entries.map((entry) => {
      const rate = rateByProject.get(entry.projectTask.projectId);
      return {
        date: entry.date,
        personName: entry.membership.user.displayName,
        taskName: entry.projectTask.task.name,
        note: entry.note,
        durationSeconds: entry.durationSeconds,
        // D6: the rate lives on the project (per_project) or the assignment
        // (per_task). A billable entry with no resolvable rate prices at 0 —
        // visible on the draft, where a wrong total gets noticed, rather than
        // silently excluded.
        rateMinor:
          (rate?.method === "per_task"
            ? entry.projectTask.hourlyRateMinor
            : rate?.projectRateMinor) ?? 0,
      };
    });

    timeLines = deriveTimeLines(facts, invoice.grouping as InvoiceGrouping, {
      showDate: invoice.showDate,
      showPerson: invoice.showPerson,
      showTask: invoice.showTask,
      showNote: invoice.showNote,
    });
    poolEntryIds = entries.map((entry) => entry.id);
  }

  const feeLines = feeProjects.map((project) => ({
    ...deriveFeeLine(project.name, project.fixedFeeMinor ?? 0),
    projectId: project.id,
  }));

  const manualLines = invoice.lines
    .filter((line) => line.source === "manual")
    .sort((a, b) => a.position - b.position);

  const totals = invoiceTotals(
    [...timeLines, ...feeLines, ...manualLines].map((l) => l.amountMinor),
    {
      discountPercentBps: invoice.discountPercentBps,
      discountFlatMinor: invoice.discountFlatMinor,
      taxRateBps: invoice.taxRateBps,
    },
  );

  return { timeLines, feeLines, manualLines, poolEntryIds, totals };
}
