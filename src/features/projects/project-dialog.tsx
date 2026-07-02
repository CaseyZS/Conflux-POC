"use client";

import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SubmitButton } from "@/components/submit-button";
import { createProject, updateProject } from "./actions";
import type { ProjectRow } from "./queries";
import type {
  BillingMethod,
  BillingType,
  ProjectFieldErrors,
} from "./validate";

// One dialog for create and edit: the billing form is the bulk of both, and
// D6's selectors need client-side state (the chosen type decides which fields
// exist), so duplicating it per mode would be the expensive kind of copy.
// The two selectors are controlled; this component outlives a close, so state
// resets on open rather than relying on unmount.
export function ProjectDialog({
  clientId,
  currency,
  project,
}: {
  clientId: string;
  currency: string;
  project?: ProjectRow; // present = edit mode
}) {
  const initialType = project?.billingType ?? "hourly";
  const initialMethod = project?.billingMethod ?? "per_project";

  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<ProjectFieldErrors>({});
  const [billingType, setBillingType] = useState<BillingType>(initialType);
  const [billingMethod, setBillingMethod] =
    useState<BillingMethod>(initialMethod);

  async function submit(formData: FormData) {
    const result = project
      ? await updateProject(project.id, formData)
      : await createProject(clientId, formData);
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
      setBillingType(initialType);
      setBillingMethod(initialMethod);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {project ? (
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>
          Edit
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>New project</DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {project
              ? "Rate changes re-price unbilled time; finalized invoices keep their snapshot."
              : "A body of work for this client. Time is tracked against a project's tasks."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              name="name"
              required
              placeholder="Website redesign"
              defaultValue={project?.name ?? ""}
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Billing type</legend>
            <RadioGroup
              name="billingType"
              value={billingType}
              onValueChange={(value) => setBillingType(value as BillingType)}
            >
              <Label className="flex items-start gap-3 font-normal">
                <RadioGroupItem value="hourly" className="mt-0.5" />
                <span>
                  Hourly
                  <span className="block text-muted-foreground">
                    Bill tracked billable hours at a rate
                  </span>
                </span>
              </Label>
              <Label className="flex items-start gap-3 font-normal">
                <RadioGroupItem value="fixed_fee" className="mt-0.5" />
                <span>
                  Fixed fee
                  <span className="block text-muted-foreground">
                    Bill a flat amount; time is still tracked for cost
                  </span>
                </span>
              </Label>
              <Label className="flex items-start gap-3 font-normal">
                <RadioGroupItem value="non_billable" className="mt-0.5" />
                <span>
                  Non-billable
                  <span className="block text-muted-foreground">
                    Internal work that is never invoiced
                  </span>
                </span>
              </Label>
            </RadioGroup>
            {errors.billingType && (
              <p className="text-sm text-destructive">{errors.billingType}</p>
            )}
          </fieldset>

          {billingType === "hourly" && (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Hourly rate comes from</legend>
              <RadioGroup
                name="billingMethod"
                value={billingMethod}
                onValueChange={(value) =>
                  setBillingMethod(value as BillingMethod)
                }
              >
                <Label className="flex items-start gap-3 font-normal">
                  <RadioGroupItem value="per_project" className="mt-0.5" />
                  <span>
                    Project rate
                    <span className="block text-muted-foreground">
                      One rate for everything on this project
                    </span>
                  </span>
                </Label>
                <Label className="flex items-start gap-3 font-normal">
                  <RadioGroupItem value="per_task" className="mt-0.5" />
                  <span>
                    Task rates
                    <span className="block text-muted-foreground">
                      Each assigned task carries its own rate
                    </span>
                  </span>
                </Label>
                <Label className="flex items-start gap-3 font-normal opacity-60">
                  <RadioGroupItem value="per_person" disabled className="mt-0.5" />
                  <span>
                    Person rates
                    <span className="block text-muted-foreground">
                      Coming with multi-user support
                    </span>
                  </span>
                </Label>
                <Label className="flex items-start gap-3 font-normal opacity-60">
                  <RadioGroupItem value="flat" disabled className="mt-0.5" />
                  <span>
                    Flat rate
                    <span className="block text-muted-foreground">
                      One app-wide rate — coming later
                    </span>
                  </span>
                </Label>
              </RadioGroup>
              {errors.billingMethod && (
                <p className="text-sm text-destructive">
                  {errors.billingMethod}
                </p>
              )}
            </fieldset>
          )}

          {billingType === "hourly" && billingMethod === "per_project" && (
            <div className="grid gap-2">
              <Label htmlFor="project-hourly-rate">
                Hourly rate ({currency})
              </Label>
              <Input
                id="project-hourly-rate"
                name="hourlyRate"
                inputMode="decimal"
                required
                placeholder="150.00"
                defaultValue={project?.hourlyRateInput ?? ""}
                className="w-32"
                aria-invalid={errors.hourlyRate ? true : undefined}
              />
              {errors.hourlyRate && (
                <p className="text-sm text-destructive">{errors.hourlyRate}</p>
              )}
            </div>
          )}

          {billingType === "fixed_fee" && (
            <div className="grid gap-2">
              <Label htmlFor="project-fixed-fee">Fixed fee ({currency})</Label>
              <Input
                id="project-fixed-fee"
                name="fixedFee"
                inputMode="decimal"
                required
                placeholder="12000.00"
                defaultValue={project?.fixedFeeInput ?? ""}
                className="w-32"
                aria-invalid={errors.fixedFee ? true : undefined}
              />
              {errors.fixedFee && (
                <p className="text-sm text-destructive">{errors.fixedFee}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <SubmitButton pendingText={project ? "Saving…" : "Creating…"}>
              {project ? "Save changes" : "Create project"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
