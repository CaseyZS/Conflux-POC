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
import { finalizeDraft, markInvoicePaid, voidInvoice } from "./actions";

// The two forward-only lifecycle moves, each behind a confirm dialog because
// neither has an undo: finalize is the one-way door of the whole milestone
// (snapshot + number + billed links), and paid is a bookkeeping fact.
export function FinalizeButton({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFinalize() {
    startTransition(async () => {
      const result = await finalizeDraft(invoiceId);
      if (result.status === "error") {
        setMessage(result.message);
      } else {
        setMessage(null);
        setOpen(false); // the page re-renders as the sent invoice
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Finalize</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalize this invoice?</DialogTitle>
          <DialogDescription>
            This freezes the invoice number, amounts, addresses, and branding as
            they are now, and locks the billed time entries so they can never be
            invoiced again. A finalized invoice can&apos;t be edited — if it&apos;s
            wrong, you void it (which releases the billed work for a corrected
            invoice).
          </DialogDescription>
        </DialogHeader>
        {message && <p className="text-sm text-destructive">{message}</p>}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button disabled={pending} onClick={handleFinalize}>
            {pending ? "Finalizing…" : "Finalize invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MarkPaidButton({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handlePaid() {
    startTransition(async () => {
      await markInvoicePaid(invoiceId);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Mark as paid</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark this invoice paid?</DialogTitle>
          <DialogDescription>
            Records that payment arrived. Like finalize, there is no backward
            step in the POC.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button disabled={pending} onClick={handlePaid}>
            {pending ? "Saving…" : "Mark as paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Void a finalized invoice that's wrong: it stays on record (marked void, its
// number kept) while the time and fees it billed return to the unbilled pool
// for a corrected invoice. Destructive-ish and irreversible, so it's behind a
// confirm and styled as a caution.
export function VoidButton({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleVoid() {
    setMessage(null);
    startTransition(async () => {
      const result = await voidInvoice(invoiceId);
      if (result.status === "error") {
        setMessage(result.message);
      } else {
        setMessage(null);
        setOpen(false); // the page re-renders as the void invoice
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>
        Void
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this invoice?</DialogTitle>
          <DialogDescription>
            This cancels the invoice. Its number and figures stay on record
            marked <strong>Void</strong>, and the time entries and fixed fees it
            billed return to the unbilled pool so you can issue a corrected
            invoice. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        {message && <p className="text-sm text-destructive">{message}</p>}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={handleVoid}>
            {pending ? "Voiding…" : "Void invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
