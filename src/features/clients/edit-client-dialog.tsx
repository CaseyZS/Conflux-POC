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
import { updateClient } from "./actions";
import type { ClientFieldErrors } from "./validate";

// The editable subset of a Client row; the page passes its Prisma row, which
// satisfies this structurally. Closing the dialog unmounts the form, so a
// reopen after cancel starts fresh from the (possibly revalidated) props.
type EditableClient = {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  billingAddress: string | null;
  currency: string;
};

export function EditClientDialog({ client }: { client: EditableClient }) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<ClientFieldErrors>({});

  async function submit(formData: FormData) {
    const result = await updateClient(client.id, formData);
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
      <DialogTrigger render={<Button variant="outline" />}>Edit</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit client</DialogTitle>
          <DialogDescription>
            Changes apply everywhere the client is shown; finalized invoices
            keep their snapshot.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-client-name">Name</Label>
            <Input
              id="edit-client-name"
              name="name"
              required
              defaultValue={client.name}
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-client-contact">Contact person</Label>
            <Input
              id="edit-client-contact"
              name="contactPerson"
              placeholder="Optional"
              defaultValue={client.contactPerson ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-client-email">Email</Label>
            <Input
              id="edit-client-email"
              name="email"
              type="email"
              placeholder="Optional"
              defaultValue={client.email ?? ""}
              aria-invalid={errors.email ? true : undefined}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-client-billing-address">Billing address</Label>
            <Textarea
              id="edit-client-billing-address"
              name="billingAddress"
              placeholder="Optional — printed on invoices as-is"
              defaultValue={client.billingAddress ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-client-currency">Currency</Label>
            <Input
              id="edit-client-currency"
              name="currency"
              required
              maxLength={3}
              defaultValue={client.currency}
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
            <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
