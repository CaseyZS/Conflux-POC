"use client";

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
import { SubmitButton } from "@/components/submit-button";
import { addManualLine, deleteManualLine, updateManualLine } from "./actions";
import type { InvoiceLineView } from "./queries";
import type { ManualLineFieldErrors } from "./validate";

// One dialog for add and edit (`line` present = edit), the app-wide pattern.
// Manual lines belong to the invoice itself (no double-bill concern), carry
// an optional project attribution captured at entry, and are the only rows
// an invoice stores while it's a draft. Delete lives in the edit dialog —
// opening it first is the confirm step (same as time entries).
export function ManualLineDialog({
  invoiceId,
  currency,
  projects,
  line,
}: {
  invoiceId: string;
  currency: string;
  projects: { id: string; name: string }[];
  line?: InvoiceLineView;
}) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<ManualLineFieldErrors>({});
  const [projectId, setProjectId] = useState<string>(line?.projectId ?? "");
  const [deleting, startDelete] = useTransition();

  const projectItems = [
    { value: "", label: "No project" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  async function submit(formData: FormData) {
    const result = line?.id
      ? await updateManualLine(line.id, formData)
      : await addManualLine(invoiceId, formData);
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
      setProjectId(line?.projectId ?? "");
    }
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteManualLine(line!.id!);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {line ? (
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>
          Edit
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="outline" />}>
          Add manual line
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {line ? "Edit manual line" : "Add manual line"}
          </DialogTitle>
          <DialogDescription>
            A free-form charge — reimbursables, materials, anything not
            derived from tracked time.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="line-description">Description</Label>
            <Input
              id="line-description"
              name="description"
              required
              placeholder="Travel expenses"
              defaultValue={line?.description ?? ""}
              aria-invalid={errors.description ? true : undefined}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="line-quantity">Quantity</Label>
              <Input
                id="line-quantity"
                name="quantity"
                inputMode="decimal"
                required
                defaultValue={line?.quantityInput ?? "1"}
                aria-invalid={errors.quantity ? true : undefined}
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="line-rate">Unit price ({currency})</Label>
              <Input
                id="line-rate"
                name="unitRate"
                inputMode="decimal"
                required
                placeholder="150.00"
                defaultValue={line?.rateInput ?? ""}
                aria-invalid={errors.unitRate ? true : undefined}
              />
              {errors.unitRate && (
                <p className="text-sm text-destructive">{errors.unitRate}</p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="line-project">Project (optional)</Label>
            <Select
              name="projectId"
              items={projectItems}
              value={projectId}
              onValueChange={(v) => setProjectId(v ?? "")}
            >
              <SelectTrigger id="line-project" className="w-full">
                <SelectValue />
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

          <DialogFooter className={line ? "sm:justify-between" : undefined}>
            {line && (
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Delete line"}
              </Button>
            )}
            <div className="flex gap-2">
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <SubmitButton pendingText={line ? "Saving…" : "Adding…"}>
                {line ? "Save changes" : "Add line"}
              </SubmitButton>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
