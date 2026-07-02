import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// The only file that instantiates Prisma (G8). Features import `db` from here —
// or, once org scoping exists, the scopedDb wrapper in scope.ts (G1/G10).
// Cached on globalThis so Next.js dev hot-reload reuses one connection instead
// of leaking a new client per reload.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
