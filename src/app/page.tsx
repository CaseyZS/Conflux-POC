import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

// M0 shell page: proves the stack boots and the session plumbing works.
// M1 replaces this with the real app shell (nav sidebar, clients page).

export default async function Home() {
  const session = await auth();

  return (
    <main className="mx-auto mt-24 max-w-lg p-4">
      <h1 className="text-3xl font-semibold">Conflux</h1>
      <p className="mt-2 text-sm text-gray-500">
        Time tracking &amp; invoicing — proof of concept (M0 scaffold).
      </p>

      {session?.user ? (
        <div className="mt-8 flex items-center gap-4">
          <p>
            Signed in as <strong>{session.user.name}</strong> (
            {session.user.email})
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded border px-3 py-1.5 text-sm"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-8">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to get started.
        </p>
      )}
    </main>
  );
}
