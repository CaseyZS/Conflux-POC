import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { can } from "@/lib/authz";
import { weekOf } from "@/lib/dates";
import { getDashboard } from "@/features/dashboard/queries";
import { LiveDuration } from "@/features/time/timer-controls";
import { InvoiceStatusBadge } from "@/features/invoices/status-badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// The post-login landing: an at-a-glance summary assembled by the dashboard
// read layer from the feature read layers it surfaces. Every figure links to
// the screen that owns it, so this is the demo's front door — glance, then
// dive in. Time figures reuse LiveDuration, so today's/this week's totals tick
// while a timer runs (the same base + live-elapsed math as the day view).
export default async function DashboardPage() {
  const actor = await requireActor();
  const data = await getDashboard(actor);
  const canInvoice = can(actor, "invoice.manage");

  // A running timer only ticks the totals it actually contributes to: today's
  // if it counts today, the week's if its day falls inside this week (a
  // continued entry can be dated earlier). Its committed seconds are already in
  // the base; LiveDuration adds only the live elapsed on top.
  const week = weekOf(data.today);
  const runningDate = data.running?.date ?? null;
  const runningStart = data.running?.startedAtMs ?? null;
  const todayTick = runningDate === data.today ? runningStart : null;
  const weekTick =
    runningDate && week.includes(runningDate) ? runningStart : null;

  const firstName = actor.displayName.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s where things stand for {data.weekLabel}.
          </p>
        </div>
        {data.running && (
          <Link
            href={`/time?date=${data.running.date}`}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Timer running · {data.running.taskName}
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tracked this week" href="/time/week">
          <LiveDuration
            baseSeconds={data.weekSeconds}
            startedAtMs={weekTick}
            format={actor.timeFormat}
          />
        </StatCard>
        <StatCard label="Tracked today" href="/time">
          <LiveDuration
            baseSeconds={data.todaySeconds}
            startedAtMs={todayTick}
            format={actor.timeFormat}
          />
        </StatCard>
        {data.invoices ? (
          <>
            <StatCard label="Open drafts" href="/invoices">
              {data.invoices.draftCount}
            </StatCard>
            <StatCard label="Awaiting payment" href="/invoices">
              {data.invoices.unpaidCount}
            </StatCard>
          </>
        ) : (
          <StatCard label="Active clients" href="/clients">
            {data.activeClientCount}
          </StatCard>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <QuickActions canInvoice={canInvoice} />
        {canInvoice && data.invoices ? (
          <RecentInvoices invoices={data.invoices} />
        ) : (
          <ClientsSummary count={data.activeClientCount} />
        )}
      </div>
    </div>
  );
}

// A single headline metric that doubles as a link to the screen it summarizes.
function StatCard({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group">
      <Card className="transition-colors group-hover:ring-foreground/20">
        <CardContent className="grid gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </span>
          <span className="text-2xl font-semibold tabular-nums">
            {children}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

const actionClass =
  "flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground";

function QuickActions({ canInvoice }: { canInvoice: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jump back in</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Link href="/time" className={actionClass}>
          Track time <span aria-hidden>→</span>
        </Link>
        {canInvoice && (
          <Link href="/invoices/new" className={actionClass}>
            New invoice <span aria-hidden>→</span>
          </Link>
        )}
        <Link href="/clients" className={actionClass}>
          Browse clients <span aria-hidden>→</span>
        </Link>
        <Link href="/projects" className={actionClass}>
          Manage projects <span aria-hidden>→</span>
        </Link>
      </CardContent>
    </Card>
  );
}

function RecentInvoices({
  invoices,
}: {
  invoices: NonNullable<Awaited<ReturnType<typeof getDashboard>>["invoices"]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent invoices</CardTitle>
        <CardAction>
          <Link
            href="/invoices"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {invoices.recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No invoices yet. Draft one from unbilled time.
          </p>
        ) : (
          <ul className="grid gap-1">
            {invoices.recent.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent",
                  )}
                >
                  <span className="w-24 shrink-0 font-medium">
                    {invoice.number ?? "Draft"}
                  </span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {invoice.clientName}
                  </span>
                  <InvoiceStatusBadge status={invoice.status} />
                  <span className="w-24 text-right tabular-nums">
                    {invoice.totalLabel}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ClientsSummary({ count }: { count: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your clients</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <span className="text-3xl font-semibold tabular-nums">{count}</span>
        <p className="text-sm text-muted-foreground">
          {count === 1 ? "active client" : "active clients"}. Open the clients
          list to add work and track time against it.
        </p>
        <Link
          href="/clients"
          className="text-sm font-medium text-foreground hover:underline"
        >
          Browse clients →
        </Link>
      </CardContent>
    </Card>
  );
}
