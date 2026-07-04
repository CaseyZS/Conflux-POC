import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  CAPABILITIES,
  can,
  capabilityUnion,
  requireCapability,
  type Actor,
  type Capability,
} from "./authz";

function actorWith(
  capabilities: Capability[],
  overrides: Partial<Actor> = {},
): Actor {
  return {
    userId: "user-1",
    membershipId: "membership-1",
    organizationId: "org-1",
    email: "a@example.test",
    displayName: "A",
    active: true,
    capabilities: new Set(capabilities),
    timeFormat: "hms",
    ...overrides,
  };
}

describe("capabilityUnion", () => {
  it("unions capabilities across multiple roles (D8)", () => {
    const union = capabilityUnion([
      ["time.track"],
      ["time.track", "client.manage"],
      ["invoice.manage"],
    ]);
    expect(union).toEqual(
      new Set(["time.track", "client.manage", "invoice.manage"]),
    );
  });

  it("drops unknown capability strings from the data layer (D13)", () => {
    const union = capabilityUnion([["time.track", "not.a.capability"]]);
    expect(union).toEqual(new Set(["time.track"]));
  });

  it("is empty for no roles", () => {
    expect(capabilityUnion([]).size).toBe(0);
  });

  it("accepts the full capability list", () => {
    expect(capabilityUnion([[...CAPABILITIES]]).size).toBe(CAPABILITIES.length);
  });
});

describe("can", () => {
  it("grants a held capability and denies a missing one", () => {
    const actor = actorWith(["client.manage"]);
    expect(can(actor, "client.manage")).toBe(true);
    expect(can(actor, "invoice.manage")).toBe(false);
  });

  it("denies an inactive membership outright, whatever its roles say", () => {
    const actor = actorWith(["client.manage"], { active: false });
    expect(can(actor, "client.manage")).toBe(false);
  });
});

describe("requireCapability", () => {
  it("returns the actor when allowed", () => {
    const actor = actorWith(["client.manage"]);
    expect(requireCapability(actor, "client.manage")).toBe(actor);
  });

  it("throws AuthorizationError when denied", () => {
    const actor = actorWith([]);
    expect(() => requireCapability(actor, "client.manage")).toThrow(
      AuthorizationError,
    );
    expect(() => requireCapability(actor, "client.manage")).toThrow(
      "client.manage",
    );
  });
});
