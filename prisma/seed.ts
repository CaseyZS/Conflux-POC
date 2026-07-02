// Seed v0 (M0): one Organization, the admin User + Membership, the three seed
// roles with their capability rows, Admin granted to the seeded member.
// Idempotent: everything is upserted on stable keys, so re-running is always
// safe — each milestone extends this script (seed v1, v2, ...) rather than
// replacing it. Run via `npm run db:seed` (or `npx prisma db seed`).

import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { CAPABILITIES, type Capability } from "../src/lib/authz";

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

  const counts = {
    organizations: await db.organization.count(),
    users: await db.user.count(),
    memberships: await db.membership.count(),
    roles: await db.role.count(),
    roleCapabilities: await db.roleCapability.count(),
    membershipRoles: await db.membershipRole.count(),
  };
  console.log(`Seed v0 complete for "${org.name}" (${ADMIN_EMAIL}):`, counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
