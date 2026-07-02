import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

// M0 skeleton: deliberately bare — proves the credentials flow end-to-end.
// M1 restyles this with shadcn/ui and adds the middleware route guard.

async function login(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error; // success path: Next's redirect signal must propagate
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto mt-24 max-w-sm p-4">
      <h1 className="mb-6 text-2xl font-semibold">Sign in to Conflux</h1>
      {error && (
        <p className="mb-4 text-sm text-red-600">
          Invalid email or password. Try again.
        </p>
      )}
      <form action={login} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded border px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded bg-black px-3 py-1.5 text-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
