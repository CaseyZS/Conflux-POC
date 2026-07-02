// Capabilities seam (G2, G10): the single source for capability names and
// the only place authorization is computed. Business code checks capabilities,
// never role names. The list mirrors docs/requirements/access-control.md;
// roles are data (rows), not code. This module stays pure (no db/session
// imports) — currentActor() in auth.ts builds the Actor from db rows.

export const CAPABILITIES = [
  "time.track",
  "time.view.all",
  "rate.view",
  "client.manage",
  "project.manage",
  "invoice.manage",
  "company.settings",
  "users.manage",
  "roles.manage",
  "billing.account",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

// "Who is calling" as server code sees it: one Membership resolved to its
// org and effective capabilities. Assembled by currentActor() (auth.ts).
export type Actor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  email: string;
  displayName: string;
  active: boolean;
  capabilities: ReadonlySet<Capability>;
};

const CAPABILITY_SET: ReadonlySet<string> = new Set(CAPABILITIES);

// Effective capabilities = union across all held roles (D8, Discord-style).
// Input is raw strings from RoleCapability rows; unknown names are dropped
// (D13: the data layer validates what the schema can't).
export function capabilityUnion(
  roleCapabilities: readonly (readonly string[])[],
): ReadonlySet<Capability> {
  const union = new Set<Capability>();
  for (const capabilities of roleCapabilities) {
    for (const capability of capabilities) {
      if (CAPABILITY_SET.has(capability)) union.add(capability as Capability);
    }
  }
  return union;
}

// The golden rule's enforcement point: an inactive membership is denied
// outright, whatever its roles say (access-control: authn + authz both deny).
export function can(actor: Actor, capability: Capability): boolean {
  return actor.active && actor.capabilities.has(capability);
}

export class AuthorizationError extends Error {
  constructor(capability: Capability) {
    super(`Not allowed: requires the "${capability}" capability`);
    this.name = "AuthorizationError";
  }
}

// Server-action guard: throws (→ error UI) instead of returning false.
export function requireCapability(actor: Actor, capability: Capability): Actor {
  if (!can(actor, capability)) throw new AuthorizationError(capability);
  return actor;
}
