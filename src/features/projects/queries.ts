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

// The org-wide index's view: every project with its client context. Currency
// rides in from each project's own client, so mixed-currency orgs read right.
export type OrgProjectRow = {
  id: string;
  name: string;
  archived: boolean;
  clientId: string;
  clientName: string;
  clientArchived: boolean;
  billingSummary: string;
};

export async function listOrgProjects(actor: Actor): Promise<OrgProjectRow[]> {
  const showRates = can(actor, "rate.view");
  const projects = await scopedDb(actor.organizationId).project.findMany({
    include: { client: true },
    orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    archived: project.archivedAt !== null,
    clientId: project.clientId,
    clientName: project.client.name,
    clientArchived: project.client.archivedAt !== null,
    billingSummary: billingSummary(
      project.billingType as BillingType,
      project.billingMethod as BillingMethod | null,
      project.hourlyRateMinor,
      project.fixedFeeMinor,
      project.client.currency,
      showRates,
    ),
  }));
}

// The detail page's view: a ProjectRow (so the shared edit dialog slots in)
// plus the client context the page needs for its backlink and currency.
export type ProjectDetail = ProjectRow & {
  clientId: string;
  clientName: string;
  currency: string;
  // hourly + per_task — the one shape where assignments carry money.
  perTaskRates: boolean;
};

export async function getProject(
  actor: Actor,
  projectId: string,
): Promise<ProjectDetail | null> {
  const showRates = can(actor, "rate.view");
  const project = await scopedDb(actor.organizationId).project.findFirst({
    where: { id: projectId },
    include: { client: true },
  });
  if (!project) return null;

  const billingType = project.billingType as BillingType;
  const billingMethod = project.billingMethod as BillingMethod | null;
  const currency = project.client.currency;
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
    clientId: project.clientId,
    clientName: project.client.name,
    currency,
    perTaskRates: billingType === "hourly" && billingMethod === "per_task",
  };
}

export type AssignmentRow = {
  id: string;
  taskName: string;
  billable: boolean;
  active: boolean;
  // "$95.00/hr" for display; null when not billable, not per-task, or
  // amount-stripped by rate.view. rateInput is the edit form's raw value.
  rateSummary: string | null;
  rateInput: string | null;
};

export async function listAssignments(
  actor: Actor,
  projectId: string,
  currency: string,
): Promise<AssignmentRow[]> {
  const showRates = can(actor, "rate.view");
  const assignments = await scopedDb(
    actor.organizationId,
  ).projectTask.findMany({
    where: { projectId },
    include: { task: true },
    orderBy: { task: { name: "asc" } },
  });

  return assignments.map((assignment) => ({
    id: assignment.id,
    taskName: assignment.task.name,
    billable: assignment.billable,
    active: assignment.active,
    rateSummary:
      showRates && assignment.hourlyRateMinor !== null
        ? `${formatMoney(assignment.hourlyRateMinor, currency)}/hr`
        : null,
    rateInput:
      showRates && assignment.hourlyRateMinor !== null
        ? formatMoneyInput(assignment.hourlyRateMinor, currency)
        : null,
  }));
}

export type AssignableTask = {
  id: string;
  name: string;
  defaultBillable: boolean;
};

// Tasks with no assignment row on this project at all — a retired assignment
// still occupies its (projectId, taskId) slot and comes back via Reactivate,
// not by assigning the same task twice.
export async function listAssignableTasks(
  actor: Actor,
  projectId: string,
): Promise<AssignableTask[]> {
  const tasks = await scopedDb(actor.organizationId).task.findMany({
    where: { archivedAt: null, assignments: { none: { projectId } } },
    orderBy: { name: "asc" },
  });
  return tasks.map((task) => ({
    id: task.id,
    name: task.name,
    defaultBillable: task.defaultBillable,
  }));
}
