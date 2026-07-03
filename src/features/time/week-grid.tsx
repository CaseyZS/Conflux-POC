"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { saveWeekCell } from "./actions";
import { formatDuration } from "./duration";
import { LiveDuration } from "./timer-controls";
import type { ProjectOptions, WeekCell, WeekRow } from "./queries";

// The weekly grid: one row per assignment, one editable cell per day. Cells
// commit on blur or Enter (Escape reverts), each cell independently — bulk
// entry is tabbing across the week. Only unambiguous cells are inputs; a cell
// holding several entries, a running timer, or invoiced time renders
// read-only and links to the day view, where entries are individual rows.

export type WeekDayColumn = {
  date: string;
  weekday: string; // "Mon"
  monthDay: string; // "Jun 29"
};

// A row added from the picker for bulk entry. Client-side only until a cell
// is saved — the refresh then returns it as a real server row, and the
// duplicate-filter in WeekGrid drops the local copy.
type ExtraRow = {
  projectTaskId: string;
  clientName: string;
  projectName: string;
  taskName: string;
};

function toWeekRow(extra: ExtraRow, days: WeekDayColumn[]): WeekRow {
  return {
    ...extra,
    assignmentLive: true, // it came from the live-assignments picker
    cells: days.map(({ date }) => ({
      date,
      totalSeconds: 0,
      entryCount: 0,
      running: false,
      startedAtMs: null,
      billed: false,
    })),
  };
}

export function WeekGrid({
  days,
  rows,
  projects,
  today,
}: {
  days: WeekDayColumn[];
  rows: WeekRow[];
  projects: ProjectOptions[];
  today: string;
}) {
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([]);
  const serverIds = new Set(rows.map((row) => row.projectTaskId));
  const visibleExtras = extraRows.filter(
    (row) => !serverIds.has(row.projectTaskId),
  );
  const presentIds = new Set([
    ...serverIds,
    ...visibleExtras.map((row) => row.projectTaskId),
  ]);

  const dayTotals = days.map((_, index) =>
    rows.reduce((sum, row) => sum + row.cells[index].totalSeconds, 0),
  );
  const grandTotal = dayTotals.reduce((sum, seconds) => sum + seconds, 0);
  const empty = rows.length + visibleExtras.length === 0;

  return (
    <>
      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Project / Task</TableHead>
            {days.map((day) => (
              <TableHead
                key={day.date}
                className={cn(
                  "w-24 text-right",
                  day.date === today && "bg-muted/40",
                )}
              >
                <span className="block">{day.weekday}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {day.monthDay}
                </span>
              </TableHead>
            ))}
            <TableHead className="w-20 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {empty ? (
            <TableRow>
              <TableCell
                colSpan={days.length + 2}
                className="h-24 text-center text-muted-foreground"
              >
                No time logged this week. Add a row to start.
              </TableCell>
            </TableRow>
          ) : (
            <>
              {rows.map((row) => (
                <GridRow key={row.projectTaskId} row={row} today={today} />
              ))}
              {visibleExtras.map((extra) => (
                <GridRow
                  key={extra.projectTaskId}
                  row={toWeekRow(extra, days)}
                  today={today}
                />
              ))}
            </>
          )}
        </TableBody>
        {!empty && (
          <TableFooter>
            <TableRow>
              <TableCell className="text-muted-foreground">Total</TableCell>
              {dayTotals.map((seconds, index) => (
                <TableCell
                  key={days[index].date}
                  className={cn(
                    "text-right font-medium tabular-nums",
                    days[index].date === today && "bg-muted/40",
                  )}
                >
                  {formatDuration(seconds)}
                </TableCell>
              ))}
              <TableCell className="text-right font-semibold tabular-nums">
                {formatDuration(grandTotal)}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
      <div className="mt-3">
        <AddRowDialog
          projects={projects}
          excludeIds={presentIds}
          onAdd={(row) => setExtraRows((prev) => [...prev, row])}
        />
      </div>
    </>
  );
}

function GridRow({ row, today }: { row: WeekRow; today: string }) {
  const rowTotal = row.cells.reduce((sum, cell) => sum + cell.totalSeconds, 0);
  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">
          {row.projectName} · {row.taskName}
        </p>
        <p className="text-xs text-muted-foreground">{row.clientName}</p>
      </TableCell>
      {row.cells.map((cell) => (
        <TableCell
          key={cell.date}
          className={cn(
            "text-right align-top",
            cell.date === today && "bg-muted/40",
          )}
        >
          <GridCell cell={cell} row={row} />
        </TableCell>
      ))}
      <TableCell className="text-right font-medium tabular-nums">
        {formatDuration(rowTotal)}
      </TableCell>
    </TableRow>
  );
}

function GridCell({ cell, row }: { cell: WeekCell; row: WeekRow }) {
  if (cell.running && cell.startedAtMs !== null) {
    return (
      <Link
        href={`/time?date=${cell.date}`}
        title="Timer running — stop it from the sidebar or the day view"
        className="inline-block py-1.5"
      >
        <LiveDuration
          baseSeconds={cell.totalSeconds}
          startedAtMs={cell.startedAtMs}
          className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400"
        />
      </Link>
    );
  }
  if (cell.billed) {
    return (
      <span
        title="This day's time is on an invoice and can't be changed"
        className="inline-block py-1.5 text-muted-foreground tabular-nums"
      >
        {formatDuration(cell.totalSeconds)}
      </span>
    );
  }
  if (cell.entryCount > 1) {
    return (
      <Link
        href={`/time?date=${cell.date}`}
        title={`${cell.entryCount} entries — edit them in the day view`}
        className="inline-block py-1.5 tabular-nums underline decoration-dotted underline-offset-4"
      >
        {formatDuration(cell.totalSeconds)}
      </Link>
    );
  }
  if (cell.entryCount === 0 && !row.assignmentLive) {
    return (
      <span
        title="This task is retired — it can't take new time"
        className="inline-block py-1.5 text-muted-foreground"
      >
        –
      </span>
    );
  }
  return (
    <WeekCellInput
      key={`${cell.date}:${cell.totalSeconds}`}
      projectTaskId={row.projectTaskId}
      date={cell.date}
      initialSeconds={cell.totalSeconds}
    />
  );
}

// One editable cell. The key above remounts it whenever the server total
// changes (the post-save refresh), which is what syncs the input to fresh
// data without effect-based state mirroring. "confirm" is the grid's
// warn-and-acknowledge for future days: the first commit comes back asking,
// the second one acknowledges.
function WeekCellInput({
  projectTaskId,
  date,
  initialSeconds,
}: {
  projectTaskId: string;
  date: string;
  initialSeconds: number;
}) {
  const initial = initialSeconds === 0 ? "" : formatDuration(initialSeconds);
  const [value, setValue] = useState(initial);
  const [note, setNote] = useState<
    { kind: "confirm" } | { kind: "error"; message: string } | null
  >(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function commit() {
    if (pending) return;
    const next = value.trim();
    const acknowledging = note?.kind === "confirm";
    if (next === initial && !acknowledging) {
      setNote(null);
      return;
    }
    start(async () => {
      const formData = new FormData();
      formData.set("projectTaskId", projectTaskId);
      formData.set("date", date);
      formData.set("hours", next);
      if (acknowledging) formData.set("acknowledgeFuture", "true");
      const result = await saveWeekCell(formData);
      if (result.status === "confirm-future") {
        setNote({ kind: "confirm" });
      } else if (result.status === "error") {
        setNote({ kind: "error", message: result.message });
      } else {
        setNote(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid justify-items-end gap-1">
      <Input
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (note?.kind === "error") setNote(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            setValue(initial);
            setNote(null);
          }
        }}
        aria-label={`Time on ${date}`}
        aria-invalid={note?.kind === "error" || undefined}
        className={cn(
          "h-8 w-16 px-2 text-right tabular-nums",
          pending && "opacity-60",
        )}
      />
      {note && (
        <p
          className={cn(
            "max-w-24 text-right text-xs",
            note.kind === "confirm" ? "text-amber-600" : "text-destructive",
          )}
        >
          {note.kind === "confirm"
            ? "Future day — Enter again to confirm"
            : note.message}
        </p>
      )}
    </div>
  );
}

// The same two-stage project → task picker as the dialogs, but it only adds a
// client-side row for bulk entry — no data is written until a cell is saved.
// Assignments already in the grid are filtered out of the choices.
function AddRowDialog({
  projects,
  excludeIds,
  onAdd,
}: {
  projects: ProjectOptions[];
  excludeIds: Set<string>;
  onAdd: (row: ExtraRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTaskId, setProjectTaskId] = useState<string | null>(null);

  const available = projects
    .map((project) => ({
      ...project,
      tasks: project.tasks.filter(
        (task) => !excludeIds.has(task.projectTaskId),
      ),
    }))
    .filter((project) => project.tasks.length > 0);
  const selectedProject =
    available.find((project) => project.projectId === projectId) ?? null;

  const projectItems = available.map((project) => ({
    value: project.projectId,
    label: `${project.projectName} · ${project.clientName}`,
  }));
  const taskItems = (selectedProject?.tasks ?? []).map((task) => ({
    value: task.projectTaskId,
    label: task.taskName,
  }));

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setProjectId(null);
      setProjectTaskId(null);
    }
  }

  function handleAdd() {
    if (!selectedProject || !projectTaskId) return;
    const task = selectedProject.tasks.find(
      (t) => t.projectTaskId === projectTaskId,
    );
    if (!task) return;
    onAdd({
      projectTaskId,
      clientName: selectedProject.clientName,
      projectName: selectedProject.projectName,
      taskName: task.taskName,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" disabled={available.length === 0} />}
      >
        Add row
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a row</DialogTitle>
          <DialogDescription>
            Pick the project and task to log time against this week.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="week-row-project">Project</Label>
            <Select
              items={projectItems}
              value={projectId}
              onValueChange={(next) => {
                setProjectId(next);
                setProjectTaskId(null);
              }}
            >
              <SelectTrigger id="week-row-project" className="w-full">
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
            <Label htmlFor="week-row-task">Task</Label>
            <Select
              items={taskItems}
              value={projectTaskId}
              onValueChange={setProjectTaskId}
              disabled={selectedProject === null}
            >
              <SelectTrigger id="week-row-task" className="w-full">
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
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={projectTaskId === null}
          >
            Add row
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
