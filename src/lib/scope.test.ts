import { describe, expect, it } from "vitest";
import { scopeArgs } from "./scope";

const ORG = "org-1";

describe("scopeArgs — filter-where verbs", () => {
  const verbs = [
    "findMany",
    "findFirst",
    "findFirstOrThrow",
    "count",
    "aggregate",
    "groupBy",
    "updateMany",
    "updateManyAndReturn",
    "deleteMany",
  ];

  it.each(verbs)("ANDs the tenant filter into %s", (verb) => {
    const out = scopeArgs("Client", verb, { where: { name: "Acme" } }, ORG);
    expect(out.where).toEqual({
      AND: [{ organizationId: ORG }, { name: "Acme" }],
    });
  });

  it("injects the filter even when no where was given", () => {
    const out = scopeArgs("Client", "findMany", undefined, ORG);
    expect(out.where).toEqual({ AND: [{ organizationId: ORG }, {}] });
  });
});

describe("scopeArgs — unique-where verbs", () => {
  const verbs = ["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"];

  it.each(verbs)("merges the tenant key into %s's unique where", (verb) => {
    const out = scopeArgs("Client", verb, { where: { id: "c-1" } }, ORG);
    expect(out.where).toEqual({ id: "c-1", organizationId: ORG });
  });

  it("does not stamp the tenant key into update data (immutable)", () => {
    const out = scopeArgs(
      "Client",
      "update",
      { where: { id: "c-1" }, data: { name: "New" } },
      ORG,
    );
    expect(out.data).toEqual({ name: "New" });
  });
});

describe("scopeArgs — create verbs", () => {
  it("stamps organizationId into create data", () => {
    const out = scopeArgs("Client", "create", { data: { name: "Acme" } }, ORG);
    expect(out.data).toEqual({ name: "Acme", organizationId: ORG });
  });

  it("stamps every row of a createMany array", () => {
    const out = scopeArgs(
      "Client",
      "createMany",
      { data: [{ name: "A" }, { name: "B" }] },
      ORG,
    );
    expect(out.data).toEqual([
      { name: "A", organizationId: ORG },
      { name: "B", organizationId: ORG },
    ]);
  });

  it("stamps upsert's create branch and scopes its where", () => {
    const out = scopeArgs(
      "Client",
      "upsert",
      { where: { id: "c-1" }, create: { name: "A" }, update: { name: "B" } },
      ORG,
    );
    expect(out.where).toEqual({ id: "c-1", organizationId: ORG });
    expect(out.create).toEqual({ name: "A", organizationId: ORG });
    expect(out.update).toEqual({ name: "B" });
  });
});

describe("scopeArgs — special models", () => {
  it("leaves User untouched (global identity, G11)", () => {
    const args = { where: { email: "a@b.test" } };
    expect(scopeArgs("User", "findUnique", args, ORG)).toEqual(args);
    expect(scopeArgs("User", "findMany", { where: {} }, ORG)).toEqual({
      where: {},
    });
  });

  it("scopes Organization by its own id", () => {
    const out = scopeArgs("Organization", "findUnique", { where: {} }, ORG);
    expect(out.where).toEqual({ id: ORG });
    const many = scopeArgs("Organization", "findMany", undefined, ORG);
    expect(many.where).toEqual({ AND: [{ id: ORG }, {}] });
  });

  it("never stamps data on the Organization row itself", () => {
    const out = scopeArgs(
      "Organization",
      "update",
      { where: {}, data: { name: "Renamed" } },
      ORG,
    );
    expect(out.where).toEqual({ id: ORG });
    expect(out.data).toEqual({ name: "Renamed" });
  });
});
