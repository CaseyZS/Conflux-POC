import { cache } from "react";
import { redirect } from "next/navigation";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { capabilityUnion, type Actor } from "@/lib/authz";

// The auth boundary (G3): the only file that knows *how* people log in.
// App code asks "who is the current user" via auth() — and, from M1,
// currentActor() resolves session → User → active Membership here too.
// Swapping seeded credentials for real accounts later happens in this file only.

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" }, // Credentials provider requires JWT sessions (no DB session table)
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.displayName };
      },
    }),
  ],
  callbacks: {
    // token.sub is the user id from authorize(); expose it on the session
    // so server code can reach the User row without re-parsing the JWT.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

// "Who is calling?" — session → User → active Membership (+ org + capability
// union). The one object server code asks for; null means "treat as logged
// out" (no session, user row gone, or seat deactivated — access-control says
// authn and authz both deny an inactive membership). The POC's single
// membership is picked automatically; a later org-switcher changes only this
// lookup, not its callers (G3/G11). React cache() dedupes per request.
export const currentActor = cache(async (): Promise<Actor | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const membership = await db.membership.findFirst({
    where: { userId, active: true },
    include: {
      user: true,
      organization: true, // for the org-level display preference carried on the Actor
      roles: { include: { role: { include: { capabilities: true } } } },
    },
  });
  if (!membership) return null;

  return {
    userId,
    membershipId: membership.id,
    organizationId: membership.organizationId,
    email: membership.user.email,
    displayName: membership.user.displayName,
    active: membership.active,
    capabilities: capabilityUnion(
      membership.roles.map((held) =>
        held.role.capabilities.map((row) => row.capability),
      ),
    ),
    timeFormat:
      membership.organization.timeDisplayFormat === "decimal"
        ? "decimal"
        : "hms",
  };
});

// Page/server-action guard: hand back the Actor or bounce to login.
export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return actor;
}
