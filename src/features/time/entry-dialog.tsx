"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { createTimeEntry, deleteTimeEntry, updateTimeEntry } from "./actions";
import type { ProjectOptions, TimeEntryRow } from "./queries";
import type { TimeEntryFieldErrors } from "./validate";

// One dialog for log and edit (`entry` present = edit), the M2 pattern. The
// picker is two stages — project, then that project's tasks — because an
// assignment (ProjectTask) is what an entry points at, and only live
// assignments are offered (the server re-checks). Future dates warn and ask
// for an acknowledgment instead of blocking (requirements/time-tracking.md);
// the check compares day strings, which is safe because ISO days sort
// lexicographically (D11). Delete lives in the edit dialog: opening it first
// is the confirm step.
export function TimeEntryDialog({
  date,
  today,
  projects,
  entry,
}: {
  date: string; // the day the view is on — what a new entry prefills
  today: string;
  projects: ProjectOptions[];
  entry?: TimeEntryRow;
}) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<TimeEntryFieldErrors>({});
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTaskId, setProjectTaskId] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState(date);
  const [futureAck, setFutureAck] = useState(false);
  const [deleting, startDelete] = useTransition();

  // An existing entry may point at an assignment that has since been retired
  // (or its project/task archived) — legal history (G12). Merge it into the
  // options so an untouched edit stays put instead of showing a blank picker.
  let projectOptions = projects;
  if (entry) {
    const own = projects.find((p) => p.projectId === entry.projectId);
    if (!own) {
      projectOptions = [
        {
          projectId: entry.projectId,
          projectName: entry.projectName,
          clientName: entry.clientName,
          tasks: [
            { projectTaskId: entry.projectTaskId, taskName: entry.taskName },
          ],
        },
        ...projects,
      ];
    } else if (
      !own.tasks.some((t) => t.projectTaskId === entry.projectTaskId)
    ) {
      projectOptions = projects.map((p) =>
        p === own
          ? {
              ...p,
              tasks: [
                ...p.tasks,
                {
                  projectTaskId: entry.projectTaskId,
                  taskName: `${entry.taskName} (retired)`,
                },
              ],
            }
          : p,
      );
    }
  }

  const selectedProject =
    projectOptions.find((p) => p.projectId === projectId) ?? null;
  const isFuture = dateValue > today;

  const projectItems = projectOptions.map((p) => ({
    value: p.projectId,
    label: `${p.projectName} · ${p.clientName}`,
  }));
  const taskItems = (selectedProject?.tasks ?? []).map((t) => ({
    value: t.projectTaskId,
    label: t.taskName,
  }));

  async function submit(formData: FormData) {
    if (isFuture && !futureAck) {
      setErrors({ date: "Check the box below to log time in the future." });
      return;
    }
    const result = entry
      ? await updateTimeEntry(entry.id, formData)
      : await createTimeEntry(formData);
    if (result.status === "error") {
      setErrors(result.errors);
    } else {
      setErrors({});
      setOpen(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setErrors({});
      setProjectId(entry?.projectId ?? null);
      setProjectTaskId(entry?.projectTaskId ?? null);
      setDateValue(entry?.date ?? date);
      setFutureAck(false);
    }
  }

  function handleProjectChange(nextProjectId: string | null) {
    setProjectId(nextProjectId);
    // Re-picking the entry's own project restores its task; any other
    // project starts the task choice fresh.
    setProjectTaskId(
      entry && nextProjectId === entry.projectId ? entry.projectTaskId : null,
    );
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteTimeEntry(entry!.id);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {entry ? (
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>
          Edit
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button disabled={projects.length === 0} />}>
          Log time
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Edit entry" : "Log time"}</DialogTitle>
          <DialogDescription>
            {entry
              ? "Time is hours:minutes (1:30) or decimal hours (1.5). Moving the date moves the entry to that day."
              : "Pick the project, then one of its assigned tasks. Time is hours:minutes (1:30) or decimal hours (1.5)."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="entry-project">Project</Label>
            <Select
              items={projectItems}
              value={projectId}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger id="entry-project" className="w-full">
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
            <Label htmlFor="entry-task">Task</Label>
            <Select
              name="projectTaskId"
              items={taskItems}
              value={projectTaskId}
              onValueChange={setProjectTaskId}
              disabled={selectedProject === null}
            >
              <SelectTrigger id="entry-task" className="w-full">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="entry-date">Date</Label>
              <Input
                id="entry-date"
                name="date"
                type="date"
                required
                value={dateValue}
                onChange={(event) => setDateValue(event.target.value)}
                aria-invalid={errors.date ? true : undefined}
              />
              {errors.date && (
                <p className="text-sm text-destructive">{errors.date}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="entry-hours">Hours</Label>
              <Input
                id="entry-hours"
                name="hours"
                required
                placeholder="1:30"
                defaultValue={entry?.hoursInput ?? ""}
                aria-invalid={errors.hours ? true : undefined}
              />
              {errors.hours && (
                <p className="text-sm text-destructive">{errors.hours}</p>
              )}
            </div>
          </div>

          {isFuture && (
            <Label className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 font-normal">
              <Checkbox
                checked={futureAck}
                onCheckedChange={(checked) => setFutureAck(checked === true)}
                className="mt-0.5"
              />
              <span>
                This date is in the future — log it anyway
                <span className="block text-muted-foreground">
                  Planned time is fine; just confirming it isn&apos;t a typo
                </span>
              </span>
            </Label>
          )}

          <div className="grid gap-2">
            <Label htmlFor="entry-note">Note</Label>
            <Textarea
              id="entry-note"
              name="note"
              rows={2}
              placeholder="What did you work on? (optional)"
              defaultValue={entry?.note ?? ""}
            />
          </div>

          <DialogFooter>
            {entry && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting}
                className="mr-auto text-destructive hover:text-destructive"
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <SubmitButton pendingText={entry ? "Saving…" : "Logging…"}>
              {entry ? "Save changes" : "Log time"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
