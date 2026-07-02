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
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "./actions";
import type { ClientFieldErrors } from "./validate";

// Client component only for the dialog open/close state and inline validation
// errors; the create itself is the server action. Closing on success unmounts
// the form, so fields reset for the next open.
export function NewClientDialog({
  defaultCurrency,
}: {
  defaultCurrency: string;
}) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<ClientFieldErrors>({});

  async function submit(formData: FormData) {
    const result = await createClient(formData);
    if (result.status === "error") {
      setErrors(result.errors);
    } else {
      setErrors({});
      setOpen(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setErrors({});
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>New client</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>
            Someone you bill. Projects and invoices hang off a client.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="client-name">Name</Label>
            <Input
              id="client-name"
              name="name"
              required
              placeholder="Acme Corporation"
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-contact">Contact person</Label>
            <Input
              id="client-contact"
              name="contactPerson"
              placeholder="Optional"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-email">Email</Label>
            <Input
              id="client-email"
              name="email"
              type="email"
              placeholder="Optional"
              aria-invalid={errors.email ? true : undefined}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-billing-address">Billing address</Label>
            <Textarea
              id="client-billing-address"
              name="billingAddress"
              placeholder="Optional — printed on invoices as-is"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-currency">Currency</Label>
            <Input
              id="client-currency"
              name="currency"
              required
              maxLength={3}
              defaultValue={defaultCurrency}
              className="w-24 uppercase"
              aria-invalid={errors.currency ? true : undefined}
            />
            {errors.currency && (
              <p className="text-sm text-destructive">{errors.currency}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <SubmitButton pendingText="Creating…">Create client</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
