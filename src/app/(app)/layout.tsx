import { requireActor, signOut } from "@/lib/auth";
import { scopedDb } from "@/lib/scope";
import { findRunningEntry } from "@/features/time/queries";
import { RunningTimerWidget } from "@/features/time/timer-controls";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";

// The guarded shell around every app page. requireActor() here is the
// authoritative auth check (G3) — the proxy's cookie-presence sniff only
// handles the UX redirect. Everything under (app) renders with a fully
// validated actor, and the sidebar is defined once for all of it.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await requireActor();
  const org = await scopedDb(actor.organizationId).organization.findFirst();
  const runningEntry = await findRunningEntry(actor);

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-5">
          <p className="text-lg font-semibold tracking-tight">Conflux</p>
          <p className="truncate text-xs text-muted-foreground">{org?.name}</p>
        </div>
        <NavLinks />
        <RunningTimerWidget entry={runningEntry} />
        <div className="mt-auto border-t px-4 py-4">
          <p className="truncate text-sm font-medium">{actor.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {actor.email}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="mt-3 w-full"
            >
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
