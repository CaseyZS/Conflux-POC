"use client";

import { useTransition } from "react";
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
import { deleteDraft } from "./actions";

// Only drafts are deletable (the action re-checks); the dialog is the
// confirm. Nothing needs releasing — a draft never linked any time entries.
export function DeleteDraftButton({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteDraft(invoiceId);
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Delete draft
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this draft?</DialogTitle>
          <DialogDescription>
            The draft and its manual lines go away. Tracked time was never
            linked, so it all stays available for a future invoice.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Deleting…" : "Delete draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
