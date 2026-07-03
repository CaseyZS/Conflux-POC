"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { formatDayHeading } from "@/lib/dates";
import { resumeEntry, startTimer, stopTimer } from "./actions";
import { elapsedSeconds, formatClock, formatHours } from "./duration";
import type {
  ProjectOptions,
  RunningEntryView,
  TimeEntryRow,
} from "./queries";
import type { TimeEntryFieldErrors } from "./validate";

// One timer runs at a time (G6), so a running entry's total is a live figure:
// the committed base plus whole seconds since startedAt. The tick lives on the
// client; the server only stores base seconds + a start instant.
//
// The wall clock is state living *outside* React, which is exactly what
// useSyncExternalStore models: subscribe to a 1 Hz interval, snapshot "now"
// floored to the second (stable within a render pass — a raw Date.now() would
// change between snapshot reads and loop). The server snapshot is null, so the
// server render and the hydration render both show the static base and the
// tick starts only after mount — no hydration mismatch. A null startedAtMs
// means "not running": nothing subscribed, just the base.
function subscribeEverySecond(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const subscribeNever = () => () => {};
const nowFlooredToSecond = () => Math.floor(Date.now() / 1000) * 1000;
const serverSnapshot = () => null;

function useLiveSeconds(
  baseSeconds: number,
  startedAtMs: number | null,
): number {
  const nowMs = useSyncExternalStore<number | null>(
    startedAtMs === null ? subscribeNever : subscribeEverySecond,
    startedAtMs === null ? serverSnapshot : nowFlooredToSecond,
    serverSnapshot,
  );
  if (startedAtMs === null || nowMs === null) return baseSeconds;
  return baseSeconds + elapsedSeconds(startedAtMs, nowMs);
}

// The running entry's elapsed as a ticking clock (h:mm:ss).
export function LiveClock({
  baseSeconds,
  startedAtMs,
  className,
}: {
  baseSeconds: number;
  startedAtMs: number;
  className?: string;
}) {
  const seconds = useLiveSeconds(baseSeconds, startedAtMs);
  return <span className={className}>{formatClock(seconds)}</span>;
}

// The day's running total in decimal hours — live when a timer for that day is
// running (startedAtMs set), static otherwise.
export function LiveHours({
  baseSeconds,
  startedAtMs,
}: {
  baseSeconds: number;
  startedAtMs: number | null;
}) {
  const seconds = useLiveSeconds(baseSeconds, startedAtMs);
  return <>{formatHours(seconds)}</>;
}

// Stop the running timer. router.refresh() (not just the action's
// revalidatePath) because the timer surfaces in the shell layout too — the
// sidebar widget on whatever page you're on — and refresh re-renders the whole
// current route, layout included.
export function StopButton({
  entryId,
  variant = "destructive",
  size = "sm",
  className,
  label = "Stop",
}: {
  entryId: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await stopTimer(entryId);
          router.refresh();
        })
      }
    >
      {pending ? "Stopping…" : label}
    </Button>
  );
}

// Start a fresh timer from the day-view header. Same two-stage project → task
// picker as the manual dialog, minus hours/date: a timer has no duration yet
// and always counts on today.
export function StartTimerDialog({ projects }: { projects: ProjectOptions[] }) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<TimeEntryFieldErrors>({});
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTaskId, setProjectTaskId] = useState<string | null>(null);
  const router = useRouter();

  const selectedProject =
    projects.find((p) => p.projectId === projectId) ?? null;
  const projectItems = projects.map((p) => ({
    value: p.projectId,
    label: `${p.projectName} · ${p.clientName}`,
  }));
  const taskItems = (selectedProject?.tasks ?? []).map((t) => ({
    value: t.projectTaskId,
    label: t.taskName,
  }));

  async function submit(formData: FormData) {
    const result = await startTimer(formData);
    if (result.status === "error") {
      setErrors(result.errors);
    } else {
      setErrors({});
      setOpen(false);
      router.refresh();
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setErrors({});
      setProjectId(null);
      setProjectTaskId(null);
    }
  }

  function handleProjectChange(nextProjectId: string | null) {
    setProjectId(nextProjectId);
    setProjectTaskId(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button disabled={projects.length === 0} />}>
        Start timer
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start timer</DialogTitle>
          <DialogDescription>
            Pick the project and task to track. The timer starts now and counts
            toward today; any other running timer stops.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="timer-project">Project</Label>
            <Select
              items={projectItems}
              value={projectId}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger id="timer-project" className="w-full">
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projectItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="timer-task">Task</Label>
            <Select
              name="projectTaskId"
              items={taskItems}
              value={projectTaskId}
              onValueChange={setProjectTaskId}
              disabled={selectedProject === null}
            >
              <SelectTrigger id="timer-task" className="w-full">
                <SelectValue
                  placeholder={
                    selectedProject ? "Choose a task" : "Choose a project first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {taskItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.projectTask && (
              <p className="text-sm text-destructive">{errors.projectTask}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="timer-note">Note</Label>
            <Textarea
              id="timer-note"
              name="note"
              rows={2}
              placeholder="What are you working on? (optional)"
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <SubmitButton pendingText="Starting…">Start timer</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Resume a stopped entry, offering the two paths from D12. "Start fresh today"
// (encouraged) makes a new entry dated today with the same project/task/note;
// "Continue this entry" re-opens the same row, keeping its original day and
// accumulating onto its total. A retired assignment can't be started fresh —
// the server rejects it — so its only path is Continue, which this surfaces as
// an error if the fresh start fails.
export function ResumeDialog({ entry }: { entry: TimeEntryRow }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setError(null);
  }

  function startFresh() {
    start(async () => {
      const formData = new FormData();
      formData.set("projectTaskId", entry.projectTaskId);
      if (entry.note) formData.set("note", entry.note);
      const result = await startTimer(formData);
      if (result.status === "error") {
        setError(
          result.errors.projectTask ??
            "This task can't start a new timer — use Continue instead.",
        );
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function continueOriginal() {
    start(async () => {
      await resumeEntry(entry.id);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Resume
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resume {entry.taskName}</DialogTitle>
          <DialogDescription>
            {entry.projectName} · {entry.clientName}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm text-muted-foreground">
          <p>Pick up this task. Any other running timer stops either way.</p>
          <ul className="grid gap-2">
            <li>
              <span className="font-medium text-foreground">
                Start fresh today
              </span>{" "}
              — a new entry dated today. Recommended, so today&apos;s work lands
              on today.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Continue this entry
              </span>{" "}
              — keeps logging to its original day, {formatDayHeading(entry.date)}
              , with the time so far kept.
            </li>
          </ul>
          {error && <p className="text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="outline"
            onClick={continueOriginal}
            disabled={pending}
          >
            Continue this entry
          </Button>
          <Button type="button" onClick={startFresh} disabled={pending}>
            Start fresh today
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The always-visible running timer in the shell sidebar — the point of a live
// timer is to start it and go work elsewhere, so it can't only live on the day
// view. Renders nothing when no timer is running. The label links to the day
// the entry counts against (which may be an earlier day, for a continued one).
export function RunningTimerWidget({
  entry,
}: {
  entry: RunningEntryView | null;
}) {
  if (!entry) return null;
  return (
    <div className="mx-3 mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Running
        </span>
      </div>
      <Link href={`/time?date=${entry.date}`} className="mt-1.5 block">
        <p className="truncate text-sm font-medium">{entry.taskName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {entry.projectName} · {entry.clientName}
        </p>
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2">
        <LiveClock
          baseSeconds={entry.baseSeconds}
          startedAtMs={entry.startedAtMs}
          className="font-mono text-base tabular-nums"
        />
        <StopButton entryId={entry.id} />
      </div>
    </div>
  );
}
