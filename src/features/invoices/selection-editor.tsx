"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { updateProjectSelections } from "./actions";
import type { SelectionChoice } from "./queries";

// The draft's "what feeds this invoice" — the same checkbox list as the
// new-invoice page, editable while the invoice is a draft. Unchecking never
// loses data (a draft derives live; nothing is reserved), so no confirm.
export function SelectionEditor({
  invoiceId,
  choices,
}: {
  invoiceId: string;
  choices: SelectionChoice[];
}) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () => new Set(choices.filter((c) => c.selected).map((c) => c.projectId)),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(projectId: string, on: boolean) {
    const next = new Set(checked);
    if (on) next.add(projectId);
    else next.delete(projectId);
    setChecked(next);
    setSaved(false);
  }

  async function submit(formData: FormData) {
    const result = await updateProjectSelections(invoiceId, formData);
    if (result.status === "error") {
      setMessage(result.message);
      setSaved(false);
    } else {
      setMessage(null);
      setSaved(true);
    }
  }

  if (choices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing billable for this client — the draft can still hold manual
        lines.
      </p>
    );
  }

  return (
    <form action={submit} className="grid gap-3">
      <div className="grid gap-1">
        {choices.map((choice) => (
          <Label
            key={choice.projectId}
            className="flex items-start gap-3 rounded-md border p-3 font-normal"
          >
            <Checkbox
              checked={checked.has(choice.projectId)}
              onCheckedChange={(on) => toggle(choice.projectId, on === true)}
              className="mt-0.5"
            />
            <span>
              {choice.projectName}
              {choice.archived && (
                <span className="text-muted-foreground"> (archived)</span>
              )}
              <span className="block text-muted-foreground">
                {choice.detail}
              </span>
            </span>
          </Label>
        ))}
      </div>

      {[...checked].map((projectId) => (
        <input key={projectId} type="hidden" name="projects" value={projectId} />
      ))}

      {message && <p className="text-sm text-destructive">{message}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton variant="outline" pendingText="Saving…">
          Update selection
        </SubmitButton>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
      </div>
    </form>
  );
}
