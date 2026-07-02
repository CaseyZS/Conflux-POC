// The projects read layer (G10): every page that shows project billing reads
// these view models, so the `rate.view` gate lives in exactly one place —
// when a role without it arrives, amounts disappear here, not via a refactor
// across pages. Raw Prisma rows never reach a component.

import { can, type Actor } from "@/lib/authz";
import { formatMoney, formatMoneyInput } from "@/lib/money";
import { scopedDb } from "@/lib/scope";
import type { BillingMethod, BillingType } from "./validate";

export type ProjectRow = {
  id: string;
  name: string;
  archived: boolean;
  billingType: BillingType;
  billingMethod: BillingMethod | null;
  // One human-readable line for lists, already amount-stripped when the
  // actor lacks rate.view.
  billingSummary: string;
  // Plain decimal strings for the edit form (null when hidden by rate.view;
  // the POC's roles all hold it, so the manage-without-view interaction is a
  // later problem, noted here on purpose).
  hourlyRateInput: string | null;
  fixedFeeInput: string | null;
};

const METHOD_LABELS: Record<BillingMethod, string> = {
  per_project: "project rate",
  per_task: "per-task rates",
  per_person: "per-person rates",
  flat: "flat rate",
};

function billingSummary(
  billingType: BillingType,
  billingMethod: BillingMethod | null,
  hourlyRateMinor: number | null,
  fixedFeeMinor: number | null,
  currency: string,
  showRates: boolean,
): string {
  if (billingType === "non_billable") return "Non-billable";
  if (billingType === "fixed_fee") {
    return showRates && fixedFeeMinor !== null
      ? `Fixed fee · ${formatMoney(fixedFeeMinor, currency)}`
      : "Fixed fee";
  }
  if (billingMethod === "per_project") {
    return showRates && hourlyRateMinor !== null
      ? `Hourly · ${formatMoney(hourlyRateMinor, currency)}/hr`
      : "Hourly";
  }
  return billingMethod
    ? `Hourly · ${METHOD_LABELS[billingMethod]}`
    : "Hourly";
}

// Currency comes in from the caller's Client row (G5: derived, not stored on
// the project), which every caller already has in hand.
export async function listClientProjects(
  actor: Actor,
  clientId: string,
  currency: string,
): Promise<ProjectRow[]> {
  const showRates = can(actor, "rate.view");
  const projects = await scopedDb(actor.organizationId).project.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
  });

  return projects.map((project) => {
    const billingType = project.billingType as BillingType;
    const billingMethod = project.billingMethod as BillingMethod | null;
    return {
      id: project.id,
      name: project.name,
      archived: project.archivedAt !== null,
      billingType,
      billingMethod,
      billingSummary: billingSummary(
        billingType,
        billingMethod,
        project.hourlyRateMinor,
        project.fixedFeeMinor,
        currency,
        showRates,
      ),
      hourlyRateInput:
        showRates && project.hourlyRateMinor !== null
          ? formatMoneyInput(project.hourlyRateMinor, currency)
          : null,
      fixedFeeInput:
        showRates && project.fixedFeeMinor !== null
          ? formatMoneyInput(project.fixedFeeMinor, currency)
          : null,
    };
  });
}
