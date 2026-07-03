import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import {
  addDays,
  formatMonthDay,
  formatWeekHeading,
  formatWeekday,
  isIsoDate,
  todayLocal,
  weekOf,
} from "@/lib/dates";
import { getWeekRows, listAssignmentOptions } from "@/features/time/queries";
import { TimesheetTabs } from "@/features/time/view-tabs";
import { WeekGrid } from "@/features/time/week-grid";

const navLinkClass =
  "rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground";

// The weekly view — review and bulk entry. Like the day view, the week lives
// in the URL (?date= is any day inside it, normalized to its Monday-start
// week) so navigation is plain links and the page stays a server component.
export default async function TimeWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const actor = await requireActor();
  const { date: dateParam } = await searchParams;
  if (dateParam !== undefined && !isIsoDate(dateParam)) notFound();
  const today = todayLocal();
  const days = weekOf(dateParam ?? today);
  const monday = days[0];
  const containsToday = days.includes(today);

  const [rows, projectOptions] = await Promise.all([
    getWeekRows(actor, days),
    listAssignmentOptions(actor),
  ]);
  const columns = days.map((date) => ({
    date,
    weekday: formatWeekday(date),
    monthDay: formatMonthDay(date),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Time</h1>
        <nav className="flex items-center gap-3">
          <TimesheetTabs
            active="week"
            dayHref={containsToday ? "/time" : `/time?date=${monday}`}
            weekHref={`/time/week?date=${monday}`}
          />
          <div className="flex items-center gap-1">
            <Link
              href={`/time/week?date=${addDays(monday, -7)}`}
              aria-label="Previous week"
              className={navLinkClass}
            >
              ←
            </Link>
            <Link
              href={`/time/week?date=${addDays(monday, 7)}`}
              aria-label="Next week"
              className={navLinkClass}
            >
              →
            </Link>
            <Link href="/time/week" className={navLinkClass}>
              This week
            </Link>
          </div>
        </nav>
      </div>

      <div className="mt-6 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {formatWeekHeading(days[0], days[6])}
          {containsToday && (
            <span className="ml-3 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              This week
            </span>
          )}
        </h2>
      </div>

      <WeekGrid
        key={monday}
        days={columns}
        rows={rows}
        projects={projectOptions}
        today={today}
        format={actor.timeFormat}
      />
    </div>
  );
}
