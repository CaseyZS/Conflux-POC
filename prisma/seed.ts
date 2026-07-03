// Seed v0 (M0): one Organization, the admin User + Membership, the three seed
// roles with their capability rows, Admin granted to the seeded member.
// Seed v1 (M1): two sample clients with invoice-ready details.
// Seed v2 (M2): projects covering all three billing types and both wired
// methods, the global task list, and assignments with mixed billable/rates.
// Seed v3 (M3): a working week of time entries anchored to today, so the day
// view and timer demo aren't empty.
// Seed v4 (M4): invoices — a finalized-and-paid one over a dedicated history
// project (billed through the real finalizeInvoice, so seeded history took
// the same path the button does), and an open draft over the demo week's
// unbilled pool.
// Idempotent: everything is upserted on stable keys, so re-running is always
// safe — each milestone extends this script (seed v1, v2, ...) rather than
// replacing it. Run via `npm run db:seed` (or `npx prisma db seed`).

import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { scopedDb } from "../src/lib/scope";
import { CAPABILITIES, type Capability } from "../src/lib/authz";
import { addDays, todayLocal } from "../src/lib/dates";
import { finalizeInvoice } from "../src/features/invoices/finalize";

// Fixed sentinel UUID so upserts have a stable key (Organization has no natural unique field).
const SEED_ORG_ID = "00000000-0000-4000-8000-000000000001";

const ADMIN_EMAIL = "admin@conflux.test";
const ADMIN_PASSWORD = "conflux-demo"; // demo-only; documented in README

// Role → capabilities per docs/requirements/access-control.md (each role extends the previous).
const MEMBER_CAPS: Capability[] = ["time.track"];
const MANAGER_CAPS: Capability[] = [
  ...MEMBER_CAPS,
  "time.view.all",
  "rate.view",
  "client.manage",
  "project.manage",
  "invoice.manage",
];
const ADMIN_CAPS: Capability[] = [
  ...MANAGER_CAPS,
  "company.settings",
  "users.manage",
  "roles.manage",
  "billing.account",
];

const SEED_ROLES: { name: string; capabilities: Capability[] }[] = [
  { name: "Member", capabilities: MEMBER_CAPS },
  { name: "Manager", capabilities: MANAGER_CAPS },
  { name: "Admin", capabilities: ADMIN_CAPS },
];

// Seed v1: fixed ids so upserts stay idempotent (name isn't unique).
// One client deliberately uses a non-default currency so per-client currency
// is visible in the demo data.
const SEED_CLIENTS = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    name: "Acme Corporation",
    contactPerson: "Jane Porter",
    email: "ap@acme.test",
    billingAddress: "Acme Corporation\n42 Industrial Way\nSpringfield, IL 62704",
    currency: "USD",
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    name: "Globex GmbH",
    contactPerson: "Lena Meyer",
    email: "accounts@globex.test",
    billingAddress: "Globex GmbH\nUnter den Linden 5\n10117 Berlin\nGermany",
    currency: "EUR",
  },
];

// Seed v2: one project per billing shape the UI wires today — hourly with a
// project-wide rate, hourly with per-task rates, fixed fee, and non-billable —
// split across both clients so both currencies show up.
const SEED_PROJECTS: {
  id: string;
  clientId: string;
  name: string;
  billingType: string;
  billingMethod?: string;
  hourlyRateMinor?: number;
  fixedFeeMinor?: number;
}[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    clientId: SEED_CLIENTS[0].id, // Acme (USD)
    name: "Website Redesign",
    billingType: "hourly",
    billingMethod: "per_project",
    hourlyRateMinor: 12500, // $125.00/hr
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    clientId: SEED_CLIENTS[0].id, // Acme (USD)
    name: "Mobile App",
    billingType: "hourly",
    billingMethod: "per_task", // rates live on the assignments below
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    clientId: SEED_CLIENTS[1].id, // Globex (EUR)
    name: "ERP Migration",
    billingType: "fixed_fee",
    fixedFeeMinor: 1_800_000, // €18,000.00
  },
  {
    id: "00000000-0000-4000-8000-000000000204",
    clientId: SEED_CLIENTS[1].id, // Globex (EUR)
    name: "Internal Support",
    billingType: "non_billable",
  },
  // Seed v4: the finalized invoice's project. Its entries are last-week
  // history (below), so billing it leaves the demo week's pool untouched.
  {
    id: "00000000-0000-4000-8000-000000000205",
    clientId: SEED_CLIENTS[0].id, // Acme (USD)
    name: "Brand Refresh",
    billingType: "hourly",
    billingMethod: "per_project",
    hourlyRateMinor: 11000, // $110.00/hr
  },
];

// The org-wide task list; one task defaults to non-billable so the default
// shows up in the tasks page and in freshly created assignments.
const SEED_TASKS = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    name: "Development",
    defaultBillable: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    name: "Design",
    defaultBillable: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000303",
    name: "Project Management",
    defaultBillable: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000304",
    name: "Internal Meeting",
    defaultBillable: false,
  },
];

// Mixed on purpose: per-task rates only where the project prices per task,
// a billable-default task assigned non-billable (per-assignment override),
// and one retired assignment so the Retired section has demo data.
const SEED_ASSIGNMENTS: {
  id: string;
  projectId: string;
  taskId: string;
  billable: boolean;
  hourlyRateMinor?: number;
  active?: boolean;
}[] = [
  // Website Redesign (hourly · project rate): the rate is on the project.
  {
    id: "00000000-0000-4000-8000-000000000401",
    projectId: SEED_PROJECTS[0].id,
    taskId: SEED_TASKS[0].id, // Development
    billable: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    projectId: SEED_PROJECTS[0].id,
    taskId: SEED_TASKS[1].id, // Design
    billable: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000403",
    projectId: SEED_PROJECTS[0].id,
    taskId: SEED_TASKS[3].id, // Internal Meeting
    billable: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000404",
    projectId: SEED_PROJECTS[0].id,
    taskId: SEED_TASKS[2].id, // Project Management — retired, keeps its slot
    billable: true,
    active: false,
  },
  // Mobile App (hourly · per-task rates): billable rows carry their own rate.
  {
    id: "00000000-0000-4000-8000-000000000405",
    projectId: SEED_PROJECTS[1].id,
    taskId: SEED_TASKS[0].id, // Development
    billable: true,
    hourlyRateMinor: 9500, // $95.00/hr
  },
  {
    id: "00000000-0000-4000-8000-000000000406",
    projectId: SEED_PROJECTS[1].id,
    taskId: SEED_TASKS[1].id, // Design
    billable: true,
    hourlyRateMinor: 11000, // $110.00/hr
  },
  {
    id: "00000000-0000-4000-8000-000000000407",
    projectId: SEED_PROJECTS[1].id,
    taskId: SEED_TASKS[2].id, // Project Management — billable by default, overridden here
    billable: false,
  },
  // ERP Migration (fixed fee): billable marks work covered by the fee; no rates.
  {
    id: "00000000-0000-4000-8000-000000000408",
    projectId: SEED_PROJECTS[2].id,
    taskId: SEED_TASKS[0].id, // Development
    billable: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000409",
    projectId: SEED_PROJECTS[2].id,
    taskId: SEED_TASKS[2].id, // Project Management
    billable: true,
  },
  // Internal Support (non-billable): nothing here is ever invoiced.
  {
    id: "00000000-0000-4000-8000-000000000410",
    projectId: SEED_PROJECTS[3].id,
    taskId: SEED_TASKS[0].id, // Development — non-billable here despite its default
    billable: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000411",
    projectId: SEED_PROJECTS[3].id,
    taskId: SEED_TASKS[3].id, // Internal Meeting
    billable: false,
  },
  // Brand Refresh (hourly · project rate): the billed-history project (v4).
  {
    id: "00000000-0000-4000-8000-000000000412",
    projectId: SEED_PROJECTS[4].id,
    taskId: SEED_TASKS[1].id, // Design
    billable: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000413",
    projectId: SEED_PROJECTS[4].id,
    taskId: SEED_TASKS[0].id, // Development
    billable: true,
  },
];

// Seed v3: a plausible recent working week. Each entry is dated by an offset
// from today (0 = today, -1 = yesterday, …) rather than a fixed calendar day,
// so the demo week always lands on the current week and never in the future —
// re-seeding slides the whole set forward to the new "today" (the upsert's
// update writes the recomputed date). Spread across five live assignments and
// both clients, mixing billable and non-billable; today carries two entries so
// the day view has a running total and the timer demo has company. No entry is
// left running — the exit check ("exactly one timer can run") starts clean.
const SEED_TIME_ENTRIES: {
  id: string;
  assignmentId: string;
  dayOffset: number;
  durationSeconds: number;
  note: string;
}[] = [
  // Three days ago.
  {
    id: "00000000-0000-4000-8000-000000000501",
    assignmentId: SEED_ASSIGNMENTS[0].id, // Website Redesign · Development
    dayOffset: -3,
    durationSeconds: 9000, // 2:30
    note: "Home page layout",
  },
  {
    id: "00000000-0000-4000-8000-000000000502",
    assignmentId: SEED_ASSIGNMENTS[7].id, // ERP Migration · Development
    dayOffset: -3,
    durationSeconds: 10800, // 3:00
    note: "Data model mapping",
  },
  // Two days ago.
  {
    id: "00000000-0000-4000-8000-000000000503",
    assignmentId: SEED_ASSIGNMENTS[4].id, // Mobile App · Development
    dayOffset: -2,
    durationSeconds: 14400, // 4:00
    note: "Auth flow",
  },
  {
    id: "00000000-0000-4000-8000-000000000504",
    assignmentId: SEED_ASSIGNMENTS[1].id, // Website Redesign · Design
    dayOffset: -2,
    durationSeconds: 5400, // 1:30
    note: "Style guide",
  },
  // Yesterday.
  {
    id: "00000000-0000-4000-8000-000000000505",
    assignmentId: SEED_ASSIGNMENTS[0].id, // Website Redesign · Development
    dayOffset: -1,
    durationSeconds: 11700, // 3:15
    note: "Nav and footer",
  },
  {
    id: "00000000-0000-4000-8000-000000000506",
    assignmentId: SEED_ASSIGNMENTS[10].id, // Internal Support · Internal Meeting (non-billable)
    dayOffset: -1,
    durationSeconds: 1800, // 0:30
    note: "Team standup",
  },
  // Today — two entries so the day view has a total and the timer demo isn't
  // alone.
  {
    id: "00000000-0000-4000-8000-000000000507",
    assignmentId: SEED_ASSIGNMENTS[4].id, // Mobile App · Development
    dayOffset: 0,
    durationSeconds: 7200, // 2:00
    note: "Profile screen",
  },
  {
    id: "00000000-0000-4000-8000-000000000508",
    assignmentId: SEED_ASSIGNMENTS[8].id, // ERP Migration · Project Management
    dayOffset: 0,
    durationSeconds: 3600, // 1:00
    note: "Sprint planning",
  },
];

// Seed v4: the finalized invoice's work — Brand Refresh, a week and a half
// back. Unlike the demo week these do NOT slide on re-seed (create-only):
// they're billed history the moment the seed finalizes invoice INV-0001, and
// billed entries are immutable everywhere else in the app, the seed included.
// Design 9:00 × $110 = $990.00, Development 4:00 × $110 = $440.00 → $1,430.00.
const SEED_HISTORY_ENTRIES: typeof SEED_TIME_ENTRIES = [
  {
    id: "00000000-0000-4000-8000-000000000509",
    assignmentId: SEED_ASSIGNMENTS[11].id, // Brand Refresh · Design
    dayOffset: -14,
    durationSeconds: 10800, // 3:00
    note: "Moodboards and direction",
  },
  {
    id: "00000000-0000-4000-8000-000000000510",
    assignmentId: SEED_ASSIGNMENTS[12].id, // Brand Refresh · Development
    dayOffset: -13,
    durationSeconds: 9000, // 2:30
    note: "Style tokens",
  },
  {
    id: "00000000-0000-4000-8000-000000000511",
    assignmentId: SEED_ASSIGNMENTS[11].id, // Brand Refresh · Design
    dayOffset: -12,
    durationSeconds: 14400, // 4:00
    note: "Logo exploration",
  },
  {
    id: "00000000-0000-4000-8000-000000000512",
    assignmentId: SEED_ASSIGNMENTS[12].id, // Brand Refresh · Development
    dayOffset: -11,
    durationSeconds: 5400, // 1:30
    note: "Landing hero build",
  },
  {
    id: "00000000-0000-4000-8000-000000000513",
    assignmentId: SEED_ASSIGNMENTS[11].id, // Brand Refresh · Design
    dayOffset: -10,
    durationSeconds: 7200, // 2:00
    note: "Brand book layout",
  },
];

// Seed v4: the two invoices — fixed ids like everything else.
const INVOICE_PAID_ID = "00000000-0000-4000-8000-000000000701";
const INVOICE_DRAFT_ID = "00000000-0000-4000-8000-000000000702";
const MANUAL_LINE_ID = "00000000-0000-4000-8000-000000000801";

async function main() {
  if (ADMIN_CAPS.length !== CAPABILITIES.length) {
    throw new Error("Seed drift: Admin should hold every capability");
  }

  const org = await db.organization.upsert({
    where: { id: SEED_ORG_ID },
    update: {},
    create: {
      id: SEED_ORG_ID,
      name: "Conflux Demo Co.",
      fromDetails:
        "Conflux Demo Co.\n100 Demo Street, Suite 400\nAustin, TX 78701\nbilling@conflux.test",
    },
  });

  const user = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
      displayName: "Demo Admin",
    },
  });

  const membership = await db.membership.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: user.id },
    },
    update: {},
    create: { organizationId: org.id, userId: user.id },
  });

  for (const { name, capabilities } of SEED_ROLES) {
    const role = await db.role.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name },
    });

    for (const capability of capabilities) {
      await db.roleCapability.upsert({
        where: { roleId_capability: { roleId: role.id, capability } },
        update: {},
        create: { roleId: role.id, capability, organizationId: org.id },
      });
    }

    if (name === "Admin") {
      await db.membershipRole.upsert({
        where: {
          membershipId_roleId: {
            membershipId: membership.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          membershipId: membership.id,
          roleId: role.id,
          organizationId: org.id,
        },
      });
    }
  }

  for (const client of SEED_CLIENTS) {
    await db.client.upsert({
      where: { id: client.id },
      update: {},
      create: {
        ...client,
        organizationId: org.id,
        createdById: membership.id,
      },
    });
  }

  for (const project of SEED_PROJECTS) {
    await db.project.upsert({
      where: { id: project.id },
      update: {},
      create: {
        ...project,
        organizationId: org.id,
        createdById: membership.id,
      },
    });
  }

  for (const task of SEED_TASKS) {
    await db.task.upsert({
      where: { id: task.id },
      update: {},
      create: {
        ...task,
        organizationId: org.id,
        createdById: membership.id,
      },
    });
  }

  for (const assignment of SEED_ASSIGNMENTS) {
    await db.projectTask.upsert({
      where: { id: assignment.id },
      update: {},
      create: { ...assignment, organizationId: org.id },
    });
  }

  // Time entries alone carry a date into `update`: re-seeding slides the demo
  // week onto the current week (and resets the demo values), where every other
  // entity uses `update: {}` to preserve edits. Billed entries are the
  // exception to the exception — once an invoice snapshot includes a row it's
  // immutable app-wide, and the seed honors that by skipping it entirely.
  const today = todayLocal();
  for (const entry of SEED_TIME_ENTRIES) {
    const existing = await db.timeEntry.findUnique({ where: { id: entry.id } });
    if (existing?.invoiceId) continue;
    const date = addDays(today, entry.dayOffset);
    await db.timeEntry.upsert({
      where: { id: entry.id },
      update: { date, durationSeconds: entry.durationSeconds, startedAt: null },
      create: {
        id: entry.id,
        organizationId: org.id,
        membershipId: membership.id,
        projectTaskId: entry.assignmentId,
        date,
        durationSeconds: entry.durationSeconds,
        note: entry.note,
        startedAt: null,
      },
    });
  }

  // The billed-history entries never slide or reset: create-only, so their
  // dates freeze relative to the first seed run — history stays put.
  for (const entry of SEED_HISTORY_ENTRIES) {
    await db.timeEntry.upsert({
      where: { id: entry.id },
      update: {},
      create: {
        id: entry.id,
        organizationId: org.id,
        membershipId: membership.id,
        projectTaskId: entry.assignmentId,
        date: addDays(today, entry.dayOffset),
        durationSeconds: entry.durationSeconds,
        note: entry.note,
        startedAt: null,
      },
    });
  }

  // Seed v4 — invoice history: a draft over Brand Refresh, finalized through
  // the real finalizeInvoice (same transaction the UI button runs: number
  // INV-0001 from the org counter, snapshot, billed links), then marked paid.
  // Re-seeding skips all of it once the invoice is out of draft.
  const paidInvoice = await db.invoice.upsert({
    where: { id: INVOICE_PAID_ID },
    update: {},
    create: {
      id: INVOICE_PAID_ID,
      organizationId: org.id,
      clientId: SEED_CLIENTS[0].id, // Acme
      paymentTermsDays: org.defaultPaymentTermsDays,
      subject: "Brand Refresh — identity & guidelines",
    },
  });
  await db.invoiceProject.upsert({
    where: {
      invoiceId_projectId: {
        invoiceId: INVOICE_PAID_ID,
        projectId: SEED_PROJECTS[4].id, // Brand Refresh
      },
    },
    update: {},
    create: {
      invoiceId: INVOICE_PAID_ID,
      projectId: SEED_PROJECTS[4].id,
      organizationId: org.id,
      includeTime: true,
      includeFixedFee: false,
    },
  });
  if (paidInvoice.status === "draft") {
    const finalized = await finalizeInvoice(scopedDb(org.id), INVOICE_PAID_ID);
    if (!finalized.ok) {
      throw new Error(`Seed finalize failed: ${finalized.message}`);
    }
    await db.invoice.update({
      where: { id: INVOICE_PAID_ID },
      data: { status: "paid" },
    });
  }

  // The open draft: the demo week's unbilled Acme pool plus a manual line,
  // with a tax and PO so the money block isn't empty. All its numbers stay
  // derived live — finalizing it is the demo's grand finale, not the seed's.
  await db.invoice.upsert({
    where: { id: INVOICE_DRAFT_ID },
    update: {},
    create: {
      id: INVOICE_DRAFT_ID,
      organizationId: org.id,
      clientId: SEED_CLIENTS[0].id, // Acme
      paymentTermsDays: org.defaultPaymentTermsDays,
      taxRateBps: 825, // 8.25%
      poNumber: "PO-2026-117",
      subject: "Q2 development — Website & Mobile App",
      showDate: true, // showcase the date-first line format
    },
  });
  for (const projectId of [SEED_PROJECTS[0].id, SEED_PROJECTS[1].id]) {
    await db.invoiceProject.upsert({
      where: {
        invoiceId_projectId: { invoiceId: INVOICE_DRAFT_ID, projectId },
      },
      update: {},
      create: {
        invoiceId: INVOICE_DRAFT_ID,
        projectId,
        organizationId: org.id,
        includeTime: true,
        includeFixedFee: false,
      },
    });
  }
  await db.invoiceLine.upsert({
    where: { id: MANUAL_LINE_ID },
    update: {},
    create: {
      id: MANUAL_LINE_ID,
      organizationId: org.id,
      invoiceId: INVOICE_DRAFT_ID,
      source: "manual",
      description: "Stock photography license",
      quantityMilli: 1000, // 1 ×
      unitRateMinor: 15000, // $150.00
      amountMinor: 15000,
      position: 0,
    },
  });

  const counts = {
    organizations: await db.organization.count(),
    users: await db.user.count(),
    memberships: await db.membership.count(),
    roles: await db.role.count(),
    roleCapabilities: await db.roleCapability.count(),
    membershipRoles: await db.membershipRole.count(),
    clients: await db.client.count(),
    projects: await db.project.count(),
    tasks: await db.task.count(),
    assignments: await db.projectTask.count(),
    timeEntries: await db.timeEntry.count(),
    invoices: await db.invoice.count(),
    invoiceLines: await db.invoiceLine.count(),
  };
  console.log(`Seed v4 complete for "${org.name}" (${ADMIN_EMAIL}):`, counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
