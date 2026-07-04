import { db } from "@/lib/db";

// Org-scoping seam (G1, G10): scopedDb(organizationId) is a Prisma client
// extension that injects the tenant filter into every model operation, so
// feature code cannot forget it — only bypass it on purpose by importing the
// bare `db` (which review catches). All the logic lives in scopeArgs(), a
// pure function, so "the filter lands on every verb" is unit-testable
// without a database.
//
// Two models are special: User is global identity with no organizationId
// (G11) and passes through untouched — it's only reachable via Membership,
// which *is* scoped. Organization is the tenant itself, scoped by its own id.
//
// Known edge (fine for the POC, revisit with multi-tenant reality): nested
// relation writes (create: { client: { create: ... } }) aren't traversed —
// feature code writes scalar FKs. Raw SQL is banned outright by G8.
//
// Types vs. runtime on create: a query extension can't relax Prisma's arg
// types, so `create` still *requires* organizationId at compile time. Call
// sites pass the actor's org id to satisfy the type; scopeArgs stamps over
// whatever was passed (spread first, stamp last), so the runtime value is
// always the scoped one.

// Operations whose `where` is a plain filter — AND the tenant key in.
const FILTER_WHERE_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "updateManyAndReturn",
  "deleteMany",
]);

// Operations whose `where` is a unique selector — merge the tenant key as an
// additional condition (Prisma's extended where-unique allows non-unique
// fields alongside the unique one, turning "found" into "found AND mine").
const UNIQUE_WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
]);

// Operations that write new rows — stamp the tenant key into the data.
const CREATE_DATA_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

type Args = Record<string, unknown>;

export function scopeArgs(
  model: string,
  operation: string,
  args: Args | undefined,
  organizationId: string,
): Args {
  const scoped: Args = { ...(args ?? {}) };

  if (model === "User") return scoped;
  const field = model === "Organization" ? "id" : "organizationId";

  if (FILTER_WHERE_OPS.has(operation)) {
    scoped.where = { AND: [{ [field]: organizationId }, scoped.where ?? {}] };
  } else if (UNIQUE_WHERE_OPS.has(operation)) {
    scoped.where = { ...((scoped.where as Args) ?? {}), [field]: organizationId };
  }

  // The tenant row itself is never created (or re-keyed) from a scoped context.
  if (model === "Organization") return scoped;

  if (CREATE_DATA_OPS.has(operation)) {
    scoped.data = Array.isArray(scoped.data)
      ? scoped.data.map((row: Args) => ({ ...row, organizationId }))
      : { ...((scoped.data as Args) ?? {}), organizationId };
  } else if (operation === "upsert") {
    scoped.create = { ...((scoped.create as Args) ?? {}), organizationId };
  }
  // Deliberately no injection into update `data`: the tenant key is immutable.

  return scoped;
}

export function scopedDb(organizationId: string) {
  return db.$extends({
    name: "orgScope",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(
            scopeArgs(model, operation, args as Args, organizationId) as typeof args,
          );
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof scopedDb>;
