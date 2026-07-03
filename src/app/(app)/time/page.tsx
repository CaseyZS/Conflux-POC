import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { addDays, formatDayHeading, isIsoDate, todayLocal } from "@/lib/dates";
import { TimeEntryDialog } from "@/features/time/entry-dialog";
import {
  LiveDuration,
  ResumeDialog,
  StartTimerDialog,
  StopButton,
} from "@/features/time/timer-controls";
import { listAssignmentOptions, listDayEntries } from "@/features/time/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const navLinkClass =
  "rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground";

// The day view — the default timesheet. The day lives in the URL (?date=) so
// navigation is plain links and the page stays a server component; no param
// means today. Entries render through the time read layer (G10), which is
// where billability is derived from the assignment.
export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const actor = await requireActor();
  const { date: dateParam } = await searchParams;
  if (dateParam !== undefined && !isIsoDate(dateParam)) notFound();
  const today = todayLocal();
  const date = dateParam ?? today;

  const [entries, projectOptions] = await Promise.all([
    listDayEntries(actor, date),
    listAssignmentOptions(actor),
  ]);
  // The total is committed seconds; if a timer for this day is running, its
  // live elapsed rides on top (LiveHours ticks from the start instant). At most
  // one entry runs at a time (G6).
  const baseTotalSeconds = entries.reduce(
    (sum, entry) => sum + entry.durationSeconds,
    0,
  );
  const runningToday = entries.find((entry) => entry.running);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Time</h1>
        <nav className="flex items-center gap-1">
          <Link
            href={`/time?date=${addDays(date, -1)}`}
            aria-label="Previous day"
            className={navLinkClass}
          >
            ←
          </Link>
          <Link
            href={`/time?date=${addDays(date, 1)}`}
            aria-label="Next day"
            className={navLinkClass}
          >
            →
          </Link>
          <Link href="/time" className={navLinkClass}>
            Today
          </Link>
        </nav>
      </div>

      <div className="mt-6 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {formatDayHeading(date)}
          {date === today && (
            <span className="ml-3 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Today
            </span>
          )}
        </h2>
        <div className="flex items-center gap-4">
          {entries.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Total{" "}
              <LiveDuration
                baseSeconds={baseTotalSeconds}
                startedAtMs={runningToday?.startedAtMs ?? null}
              />
            </p>
          )}
          <div className="flex items-center gap-2">
            {date === today && <StartTimerDialog projects={projectOptions} />}
            <TimeEntryDialog
              date={date}
              today={today}
              projects={projectOptions}
            />
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No time logged this day.
          </p>
        </div>
      ) : (
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <p className="flex items-center gap-2 font-medium">
                    {entry.projectName}
                    {entry.running && (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Running
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.clientName}
                  </p>
                </TableCell>
                <TableCell>{entry.taskName}</TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">
                  {entry.note}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.billable ? "Billable" : "Non-billable"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {entry.running && entry.startedAtMs !== null ? (
                    <LiveDuration
                      baseSeconds={entry.durationSeconds}
                      startedAtMs={entry.startedAtMs}
                      className="font-mono text-emerald-600 dark:text-emerald-400"
                    />
                  ) : (
                    entry.hoursLabel
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {entry.running ? (
                    <StopButton entryId={entry.id} />
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <TimeEntryDialog
                        date={date}
                        today={today}
                        projects={projectOptions}
                        entry={entry}
                      />
                      <ResumeDialog entry={entry} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
