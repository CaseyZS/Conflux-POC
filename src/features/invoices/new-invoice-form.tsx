"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { createInvoice } from "./actions";
import type { InvoiceClientCandidate } from "./queries";

// The whole candidate tree rides in as props and the client/project choice is
// browser state — org scale keeps that cheap, and it saves a round trip per
// client change. Everything is re-validated server-side (createInvoice); this
// form only shapes the request. Projects start checked because the common
// case is "bill everything outstanding"; unchecking is the exception.
export function NewInvoiceForm({
  candidates,
}: {
  candidates: InvoiceClientCandidate[];
}) {
  const [clientId, setClientId] = useState<string | null>(
    candidates.length === 1 ? candidates[0].clientId : null,
  );
  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () => allProjectIds(candidates, clientId),
  );
  const [message, setMessage] = useState<string | null>(null);

  const client = candidates.find((c) => c.clientId === clientId) ?? null;
  const clientItems = candidates.map((c) => ({
    value: c.clientId,
    label: c.clientName,
  }));

  function handleClientChange(nextClientId: string | null) {
    setClientId(nextClientId);
    setChecked(allProjectIds(candidates, nextClientId));
    setMessage(null);
  }

  function toggle(projectId: string, on: boolean) {
    const next = new Set(checked);
    if (on) next.add(projectId);
    else next.delete(projectId);
    setChecked(next);
  }

  async function submit(formData: FormData) {
    // On success createInvoice redirects to the new draft, so only the error
    // arm ever returns here.
    const result = await createInvoice(formData);
    setMessage(result.message);
  }

  return (
    <form action={submit} className="grid max-w-lg gap-6">
      <div className="grid gap-2">
        <Label htmlFor="invoice-client">Client</Label>
        <Select
          name="clientId"
          items={clientItems}
          value={clientId}
          onValueChange={handleClientChange}
        >
          <SelectTrigger id="invoice-client" className="w-full">
            <SelectValue placeholder="Choose a client" />
          </SelectTrigger>
          <SelectContent>
            {clientItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {client && (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">
            What feeds this invoice
          </legend>
          {client.projects.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No billable projects for this client yet — the draft can still
              hold manual lines.
            </p>
          ) : (
            <div className="grid gap-1">
              {client.projects.map((project) => (
                <Label
                  key={project.projectId}
                  className="flex items-start gap-3 rounded-md border p-3 font-normal"
                >
                  <Checkbox
                    checked={checked.has(project.projectId)}
                    onCheckedChange={(on) =>
                      toggle(project.projectId, on === true)
                    }
                    className="mt-0.5"
                  />
                  <span>
                    {project.projectName}
                    {project.archived && (
                      <span className="text-muted-foreground"> (archived)</span>
                    )}
                    <span className="block text-muted-foreground">
                      {project.detail}
                    </span>
                  </span>
                </Label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {/* The checked set submits as hidden inputs (state is the source of
          truth) rather than relying on the checkbox primitive's form
          integration. */}
      {[...checked].map((projectId) => (
        <input key={projectId} type="hidden" name="projects" value={projectId} />
      ))}

      {message && <p className="text-sm text-destructive">{message}</p>}

      <div>
        <SubmitButton pendingText="Creating…">Create draft</SubmitButton>
      </div>
    </form>
  );
}

function allProjectIds(
  candidates: InvoiceClientCandidate[],
  clientId: string | null,
): ReadonlySet<string> {
  const client = candidates.find((c) => c.clientId === clientId);
  return new Set(client?.projects.map((p) => p.projectId) ?? []);
}
