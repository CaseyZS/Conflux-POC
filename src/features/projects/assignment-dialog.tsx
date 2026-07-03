"use client";

import { useState } from "react";
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
import { SubmitButton } from "@/components/submit-button";
import { assignTask, updateAssignment } from "./assignment-actions";
import type { AssignableTask, AssignmentRow } from "./queries";
import type { AssignmentFieldErrors } from "./validate";

// One dialog for assign and edit (`assignment` present = edit). Assign mode
// picks from the unassigned tasks; edit mode shows the task name fixed —
// changing *which* task is retire + assign, so history stays attached to the
// right work. Billable is controlled: picking a task seeds it from that
// task's default (per-assignment override starts from the org-wide answer),
// and it decides whether the rate field exists on per-task-rate projects.
export function AssignmentDialog({
  projectId,
  currency,
  perTaskRates,
  tasks,
  assignment,
}: {
  projectId: string;
  currency: string;
  perTaskRates: boolean;
  tasks?: AssignableTask[]; // assign mode
  assignment?: AssignmentRow; // edit mode
}) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<AssignmentFieldErrors>({});
  const [taskId, setTaskId] = useState<string | null>(null);
  const [billable, setBillable] = useState(assignment?.billable ?? true);

  async function submit(formData: FormData) {
    const result = assignment
      ? await updateAssignment(assignment.id, formData)
      : await assignTask(projectId, formData);
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
      setTaskId(null);
      setBillable(assignment?.billable ?? true);
    }
  }

  function handleTaskChange(nextTaskId: string | null) {
    setTaskId(nextTaskId);
    const task = tasks?.find((candidate) => candidate.id === nextTaskId);
    if (task) setBillable(task.defaultBillable);
  }

  const items = (tasks ?? []).map((task) => ({
    value: task.id,
    label: task.name,
  }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {assignment ? (
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>
          Edit
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={<Button disabled={tasks !== undefined && tasks.length === 0} />}
        >
          Assign task
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {assignment ? `Edit ${assignment.taskName}` : "Assign a task"}
          </DialogTitle>
          <DialogDescription>
            {assignment
              ? "Billability and rate are owned by this assignment; the org-wide task is unchanged."
              : "Pick from the organization's task list. Time on this project is tracked against its assigned tasks."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          {!assignment && (
            <div className="grid gap-2">
              <Label htmlFor="assignment-task">Task</Label>
              <Select
                name="taskId"
                items={items}
                value={taskId}
                onValueChange={handleTaskChange}
              >
                <SelectTrigger id="assignment-task" className="w-full">
                  <SelectValue placeholder="Choose a task" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.taskId && (
                <p className="text-sm text-destructive">{errors.taskId}</p>
              )}
            </div>
          )}

          <Label className="flex items-start gap-3 font-normal">
            <Checkbox
              name="billable"
              checked={billable}
              onCheckedChange={(checked) => setBillable(checked === true)}
              className="mt-0.5"
            />
            <span>
              Billable on this project
              <span className="block text-muted-foreground">
                Starts from the task&apos;s default; this assignment owns the
                final answer
              </span>
            </span>
          </Label>

          {perTaskRates && billable && (
            <div className="grid gap-2">
              <Label htmlFor="assignment-hourly-rate">
                Hourly rate ({currency})
              </Label>
              <Input
                id="assignment-hourly-rate"
                name="hourlyRate"
                inputMode="decimal"
                required
                placeholder="95.00"
                defaultValue={assignment?.rateInput ?? ""}
                className="w-32"
                aria-invalid={errors.hourlyRate ? true : undefined}
              />
              {errors.hourlyRate && (
                <p className="text-sm text-destructive">{errors.hourlyRate}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <SubmitButton pendingText={assignment ? "Saving…" : "Assigning…"}>
              {assignment ? "Save changes" : "Assign"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
