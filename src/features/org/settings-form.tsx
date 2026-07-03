"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { updateOrgSettings } from "./actions";
import type { OrgSettingsView } from "./queries";
import type { OrgSettingsFieldErrors } from "./validate";

// The org's identity + invoice defaults in one form. These pre-fill new
// clients/invoices and are snapshotted onto an invoice only at finalize, so
// editing them here never rewrites an existing invoice (G5). Uncontrolled
// inputs (defaultValue) — the server action re-validates and returns field
// errors, the same pattern as the client and draft-settings forms.
export function SettingsForm({ settings }: { settings: OrgSettingsView }) {
  // Freeze the settings at first render. Saving revalidates /settings, which
  // re-renders this form with a fresh `settings`; uncontrolled inputs keep what
  // the user typed regardless, so pinning defaultValue to this initial snapshot
  // matches React's behavior and stops Base UI warning that an uncontrolled
  // field's defaultValue changed after init. The next-number preview below stays
  // live (reads `settings`) so it reflects a just-saved prefix.
  const [initial] = useState(settings);
  const [errors, setErrors] = useState<OrgSettingsFieldErrors>({});
  const [saved, setSaved] = useState(false);

  async function submit(formData: FormData) {
    const result = await updateOrgSettings(formData);
    if (result.status === "error") {
      setErrors(result.errors);
      setSaved(false);
    } else {
      setErrors({});
      setSaved(true);
    }
  }

  return (
    <form action={submit} onChange={() => setSaved(false)} className="grid gap-6">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="org-name">Business name</Label>
          <Input
            id="org-name"
            name="name"
            defaultValue={initial.name}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="org-from">&ldquo;From&rdquo; details</Label>
          <Textarea
            id="org-from"
            name="fromDetails"
            rows={4}
            defaultValue={initial.fromDetails}
            placeholder={"Address, email, phone — shown in the invoice header"}
          />
          <p className="text-xs text-muted-foreground">
            The block under your business name on every invoice.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="org-currency">Default currency</Label>
          <Input
            id="org-currency"
            name="defaultCurrency"
            defaultValue={initial.defaultCurrency}
            className="uppercase"
            aria-invalid={errors.defaultCurrency ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">
            Pre-fills a new client (like USD).
          </p>
          {errors.defaultCurrency && (
            <p className="text-sm text-destructive">{errors.defaultCurrency}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="org-tax">Default tax %</Label>
          <Input
            id="org-tax"
            name="defaultTaxRate"
            inputMode="decimal"
            placeholder="8.25"
            defaultValue={initial.defaultTaxRateInput}
            aria-invalid={errors.defaultTaxRate ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">Empty = no default tax.</p>
          {errors.defaultTaxRate && (
            <p className="text-sm text-destructive">{errors.defaultTaxRate}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="org-terms">Default terms (days)</Label>
          <Input
            id="org-terms"
            name="defaultPaymentTermsDays"
            inputMode="numeric"
            defaultValue={initial.defaultPaymentTermsDays}
            aria-invalid={errors.defaultPaymentTermsDays ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">
            0 = due on receipt.
          </p>
          {errors.defaultPaymentTermsDays && (
            <p className="text-sm text-destructive">
              {errors.defaultPaymentTermsDays}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="org-prefix">Invoice number prefix</Label>
          <Input
            id="org-prefix"
            name="invoiceNumberPrefix"
            defaultValue={initial.invoiceNumberPrefix}
            className="w-40"
            aria-invalid={errors.invoiceNumberPrefix ? true : undefined}
          />
          {errors.invoiceNumberPrefix ? (
            <p className="text-sm text-destructive">
              {errors.invoiceNumberPrefix}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Next invoice will be{" "}
              <span className="font-medium tabular-nums text-foreground">
                {settings.nextInvoiceNumberPreview}
              </span>{" "}
              — numbers auto-increment from the highest used.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="org-footer">Invoice footer</Label>
          <Textarea
            id="org-footer"
            name="invoiceFooter"
            rows={2}
            defaultValue={initial.invoiceFooter}
            placeholder="Default notes / terms at the bottom of an invoice"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
      </div>
    </form>
  );
}
