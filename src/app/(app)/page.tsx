import { requireActor } from "@/lib/auth";

// Placeholder dashboard: the home route just proves the shell + actor wiring.
// It grows real content (running timer, recent entries) as milestones land.
export default async function DashboardPage() {
  const actor = await requireActor();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome, {actor.displayName}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Time tracking &amp; invoicing — proof of concept. The dashboard fills
        in as features land; head to Clients to get started.
      </p>
    </div>
  );
}
