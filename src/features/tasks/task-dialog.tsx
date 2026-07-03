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
import { SubmitButton } from "@/components/submit-button";
import { createTask, updateTask } from "./actions";
import type { TaskFieldErrors } from "./validate";

type EditableTask = {
  id: string;
  name: string;
  defaultBillable: boolean;
};

// One dialog for create and edit (the projects pattern): the form is shared,
// and `task` present means edit. The fields are uncontrolled — DialogContent
// unmounts on close, so defaultValue/defaultChecked reset themselves.
export function TaskDialog({ task }: { task?: EditableTask }) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<TaskFieldErrors>({});

  async function submit(formData: FormData) {
    const result = task
      ? await updateTask(task.id, formData)
      : await createTask(formData);
    if (result.status === "error") {
      setErrors(result.errors);
    } else {
      setErrors({});
      setOpen(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setErrors({});
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {task ? (
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>
          Edit
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>New task</DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {task
              ? "Changes apply everywhere this task is used; projects that overrode billability keep their override."
              : "A reusable kind of work (e.g. Development, Meetings) shared across the organization. Projects assign tasks from this list."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="task-name">Name</Label>
            <Input
              id="task-name"
              name="name"
              required
              placeholder="Development"
              defaultValue={task?.name ?? ""}
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <Label className="flex items-start gap-3 font-normal">
            <Checkbox
              name="defaultBillable"
              defaultChecked={task?.defaultBillable ?? true}
              className="mt-0.5"
            />
            <span>
              Billable by default
              <span className="block text-muted-foreground">
                New project assignments start billable; each assignment can
                override
              </span>
            </span>
          </Label>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <SubmitButton pendingText={task ? "Saving…" : "Creating…"}>
              {task ? "Save changes" : "Create task"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
