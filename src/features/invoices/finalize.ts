// Finalize: the one transaction that turns a draft into a financial record
// (G5's licensed snapshot). Everything happens inside db.$transaction — the
// gapless number consumed from the org counter, the line/total/bill-to/from
// snapshot, and the anti-double-bill links — so a failure at any step leaves
// no half-finalized invoice. Not a server action itself: the finalizeDraft
// action wraps it with the guard chain, and the seed calls it directly so
// seeded history goes through the exact code the button runs.

import { addDays, todayLocal } from "@/lib/dates";
import type { ScopedDb } from "@/lib/scope";
import { computeDraft } from "./draft";

export type FinalizeResult =
  | { ok: true; number: string }
  | { ok: false; message: string };

// "INV-" + 1 → "INV-0001": four digits keeps numbers sortable-looking in a
// list without pretending to be a spec — the padding is display-at-assign,
// stored on the snapshot like every other finalized value.
export function formatInvoiceNumber(prefix: string, value: number): string {
  return `${prefix}${String(value).padStart(4, "0")}`;
}

export async function finalizeInvoice(
  db: ScopedDb,
  invoiceId: string,
): Promise<FinalizeResult> {
  return db.$transaction(async (tx) => {
    // Everything is re-read inside the transaction: the draft's status (a
    // stale tab must not finalize twice), and — via computeDraft — the live
    // pool, whose `invoiceId IS NULL` predicate is what makes double-billing
    // impossible rather than merely unlikely.
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId },
      include: {
        client: true,
        projectSelections: { include: { project: true } },
        lines: true,
      },
    });
    if (!invoice) return { ok: false, message: "Invoice not found." };
    if (invoice.status !== "draft") {
      return { ok: false, message: "This invoice is already finalized." };
    }

    const computed = await computeDraft(tx, invoice);
    const derived = [
      ...computed.timeLines.map((line) => ({
        ...line,
        source: "time",
        projectId: null as string | null,
      })),
      ...computed.feeLines.map(({ projectId, ...line }) => ({
        ...line,
        source: "fixed_fee",
        projectId: projectId as string | null,
      })),
    ];
    if (derived.length + computed.manualLines.length === 0) {
      return {
        ok: false,
        message: "Nothing to bill — the draft has no lines.",
      };
    }

    // The gapless number: read + increment + assign in this transaction, the
    // only place a number is ever produced.
    const org = await tx.organization.findFirst();
    if (!org) throw new Error("Organization not found.");
    const number = formatInvoiceNumber(
      org.invoiceNumberPrefix,
      org.invoiceNextNumber,
    );
    await tx.organization.update({
      where: { id: org.id },
      data: { invoiceNextNumber: org.invoiceNextNumber + 1 },
    });

    // Snapshot the derived lines as rows; manual lines already are rows and
    // just take their print positions after the derived block (position is
    // part of the financial record).
    if (derived.length > 0) {
      await tx.invoiceLine.createMany({
        data: derived.map((line, index) => ({
          organizationId: invoice.organizationId,
          invoiceId: invoice.id,
          source: line.source,
          description: line.description,
          quantityMilli: line.quantityMilli,
          unitRateMinor: line.unitRateMinor,
          amountMinor: line.amountMinor,
          projectId: line.projectId,
          position: index,
        })),
      });
    }
    for (const [index, line] of computed.manualLines.entries()) {
      await tx.invoiceLine.update({
        where: { id: line.id },
        data: { position: derived.length + index },
      });
    }

    // The anti-double-bill links: billed time points at this invoice forever
    // (immutable thereafter — the time actions refuse billed entries), and a
    // billed fixed fee never gets offered again.
    if (computed.poolEntryIds.length > 0) {
      await tx.timeEntry.updateMany({
        where: { id: { in: computed.poolEntryIds }, invoiceId: null },
        data: { invoiceId: invoice.id },
      });
    }
    const feeProjectIds = computed.feeLines.map((line) => line.projectId);
    if (feeProjectIds.length > 0) {
      await tx.project.updateMany({
        where: { id: { in: feeProjectIds }, fixedFeeInvoiceId: null },
        data: { fixedFeeInvoiceId: invoice.id },
      });
    }

    // Dates freeze now: an unset issue date resolves to the day of
    // finalizing, an unset due date to issue + terms (user-overridable while
    // it was a draft).
    const issueDate = invoice.issueDate ?? todayLocal();
    const dueDate =
      invoice.dueDate ?? addDays(issueDate, invoice.paymentTermsDays);
    const logo = await tx.asset.findFirst({ where: { kind: "logo" } });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "sent",
        number,
        issueDate,
        dueDate,
        currency: invoice.client.currency,
        subtotalMinor: computed.totals.subtotalMinor,
        discountMinor: computed.totals.discountMinor,
        taxMinor: computed.totals.taxMinor,
        totalMinor: computed.totals.totalMinor,
        billToName: invoice.client.name,
        billToContact: invoice.client.contactPerson,
        billToAddress: invoice.client.billingAddress,
        fromName: org.name,
        fromDetails: org.fromDetails,
        logoAssetId: logo?.id ?? null, // by reference; upload arrives in M5
      },
    });

    return { ok: true, number };
  });
}
