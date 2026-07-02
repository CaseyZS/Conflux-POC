import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

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
