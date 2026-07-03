// The dashboard read layer (G10): the post-login landing reads this one view
// model, assembled from the feature read layers it summarizes — it owns no
// tables of its own. The invoice slice is gated on invoice.manage here, so a
// role without it never even loads (let alone renders) money figures.

import { can, type Actor } from "@/lib/authz";
import { formatWeekHeading, todayLocal, weekOf } from "@/lib/dates";
import { scopedDb } from "@/lib/scope";
import {
  findRunningEntry,
  type RunningEntryView,
} from "@/features/time/queries";
import { listInvoices, type InvoiceListRow } from "@/features/invoices/queries";

export type DashboardData = {
  today: string;
  weekLabel: string; // "Jun 29 – Jul 5, 2026"
  weekSeconds: number; // committed seconds this week (a running timer's live tick rides on top at display)
  todaySeconds: number;
  running: RunningEntryView | null;
  activeClientCount: number;
  // Present only when the actor can manage invoices; null hides the whole slice.
  invoices: {
    draftCount: number;
    unpaidCount: number; // finalized + sent, awaiting payment
    total: number; // all invoices, for empty-state logic
    recent: InvoiceListRow[]; // newest first, capped
  } | null;
};

const RECENT_LIMIT = 5;

export async function getDashboard(actor: Actor): Promise<DashboardData> {
  const db = scopedDb(actor.organizationId);
  const today = todayLocal();
  const week = weekOf(today);
  const canInvoice = can(actor, "invoice.manage");

  const [weekEntries, running, activeClientCount, invoiceList] =
    await Promise.all([
      db.timeEntry.findMany({
        where: { membershipId: actor.membershipId, date: { in: week } },
        select: { date: true, durationSeconds: true },
      }),
      findRunningEntry(actor),
      db.client.count({ where: { archivedAt: null } }),
      canInvoice ? listInvoices(actor) : Promise.resolve(null),
    ]);

  let weekSeconds = 0;
  let todaySeconds = 0;
  for (const entry of weekEntries) {
    weekSeconds += entry.durationSeconds;
    if (entry.date === today) todaySeconds += entry.durationSeconds;
  }

  return {
    today,
    weekLabel: formatWeekHeading(week[0], week[6]),
    weekSeconds,
    todaySeconds,
    running,
    activeClientCount,
    invoices: invoiceList
      ? {
          draftCount: invoiceList.filter((i) => i.status === "draft").length,
          unpaidCount: invoiceList.filter((i) => i.status === "sent").length,
          total: invoiceList.length,
          recent: invoiceList.slice(0, RECENT_LIMIT),
        }
      : null,
  };
}
