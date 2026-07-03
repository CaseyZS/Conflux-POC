"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { updateDraftSettings } from "./actions";
import type { InvoiceView } from "./queries";
import type { DraftSettingsFieldErrors, InvoiceGrouping } from "./validate";

const GROUPING_ITEMS: { value: InvoiceGrouping; label: string }[] = [
  { value: "task", label: "By task" },
  { value: "person", label: "By person" },
  { value: "summary", label: "Summary (one line)" },
  { value: "detailed", label: "Detailed (per entry)" },
];

const DISCOUNT_ITEMS = [
  { value: "none", label: "No discount" },
  { value: "percent", label: "Percent" },
  { value: "flat", label: "Flat amount" },
];

const TOGGLES: { name: string; label: string }[] = [
  { name: "showDate", label: "Date" },
  { name: "showPerson", label: "Person" },
  { name: "showTask", label: "Task" },
  { name: "showNote", label: "Notes" },
];

// The draft's stored choices in one form: how time lines present (grouping +
// detail toggles) and the paper details (dates, terms, PO, discount, tax,
// footer). Saving re-derives the lines server-side, so the table above always
// reflects what's set here. Checkbox/select values submit via hidden inputs
// (state is the source of truth), the same pattern as the new-invoice form.
export function DraftSettingsForm({ invoice }: { invoice: InvoiceView }) {
  const [errors, setErrors] = useState<DraftSettingsFieldErrors>({});
  const [saved, setSaved] = useState(false);
  const [grouping, setGrouping] = useState<string | null>(invoice.grouping);
  const [toggles, setToggles] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        TOGGLES.filter(
          (t) => invoice[t.name as keyof InvoiceView] === true,
        ).map((t) => t.name),
      ),
  );
  const [discountKind, setDiscountKind] = useState<string | null>(
    invoice.discountKind,
  );

  async function submit(formData: FormData) {
    const result = await updateDraftSettings(invoice.id, formData);
    if (result.status === "error") {
      setErrors(result.errors);
      setSaved(false);
    } else {
      setErrors({});
      setSaved(true);
    }
  }

  function toggle(name: string, on: boolean) {
    const next = new Set(toggles);
    if (on) next.add(name);
    else next.delete(name);
    setToggles(next);
    setSaved(false);
  }

  return (
    <form action={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="invoice-grouping">Group time lines</Label>
          <Select
            name="grouping"
            items={GROUPING_ITEMS}
            value={grouping}
            onValueChange={(v) => {
              setGrouping(v);
              setSaved(false);
            }}
          >
            <SelectTrigger id="invoice-grouping" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPING_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.grouping && (
            <p className="text-sm text-destructive">{errors.grouping}</p>
          )}
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Line detail</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {TOGGLES.map((t) => (
              <Label
                key={t.name}
                className="flex items-center gap-2 font-normal"
              >
                <Checkbox
                  checked={toggles.has(t.name)}
                  onCheckedChange={(on) => toggle(t.name, on === true)}
                />
                {t.label}
              </Label>
            ))}
          </div>
        </fieldset>
      </div>

      {[...toggles].map((name) => (
        <input key={name} type="hidden" name={name} value="true" />
      ))}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="invoice-issue-date">Issue date</Label>
          <Input
            id="invoice-issue-date"
            name="issueDate"
            type="date"
            defaultValue={invoice.issueDate ?? ""}
            aria-invalid={errors.issueDate ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">
            Empty = day of finalizing.
          </p>
          {errors.issueDate && (
            <p className="text-sm text-destructive">{errors.issueDate}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invoice-terms">Terms (days)</Label>
          <Input
            id="invoice-terms"
            name="paymentTermsDays"
            inputMode="numeric"
            defaultValue={String(invoice.paymentTermsDays)}
            aria-invalid={errors.paymentTermsDays ? true : undefined}
          />
          {errors.paymentTermsDays && (
            <p className="text-sm text-destructive">
              {errors.paymentTermsDays}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invoice-due-date">Due date</Label>
          <Input
            id="invoice-due-date"
            name="dueDate"
            type="date"
            defaultValue={invoice.dueDate ?? ""}
            aria-invalid={errors.dueDate ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">
            Empty = issue date + terms ({invoice.effectiveDueDate}).
          </p>
          {errors.dueDate && (
            <p className="text-sm text-destructive">{errors.dueDate}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="invoice-discount-kind">Discount</Label>
          <Select
            name="discountKind"
            items={DISCOUNT_ITEMS}
            value={discountKind}
            onValueChange={(v) => {
              setDiscountKind(v);
              setSaved(false);
            }}
          >
            <SelectTrigger id="invoice-discount-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCOUNT_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {discountKind !== "none" && (
          <div className="grid gap-2">
            <Label htmlFor="invoice-discount-value">
              {discountKind === "percent"
                ? "Discount %"
                : `Discount (${invoice.currency})`}
            </Label>
            <Input
              id="invoice-discount-value"
              name="discountValue"
              inputMode="decimal"
              placeholder={discountKind === "percent" ? "10" : "250.00"}
              defaultValue={invoice.discountValueInput}
              aria-invalid={errors.discount ? true : undefined}
            />
            {errors.discount && (
              <p className="text-sm text-destructive">{errors.discount}</p>
            )}
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="invoice-tax">Tax %</Label>
          <Input
            id="invoice-tax"
            name="taxRate"
            inputMode="decimal"
            placeholder="8.25"
            defaultValue={invoice.taxRateInput}
            aria-invalid={errors.taxRate ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">
            Applied after the discount. Empty = no tax.
          </p>
          {errors.taxRate && (
            <p className="text-sm text-destructive">{errors.taxRate}</p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="invoice-subject">Subject</Label>
        <Input
          id="invoice-subject"
          name="subject"
          defaultValue={invoice.subject ?? ""}
          placeholder="Shown above the line items (e.g. Website redesign — June 2026)"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="invoice-po">PO number</Label>
          <Input
            id="invoice-po"
            name="poNumber"
            defaultValue={invoice.poNumber ?? ""}
            placeholder="Client's purchase order"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invoice-footer">Footer</Label>
          <Textarea
            id="invoice-footer"
            name="footer"
            rows={2}
            defaultValue={invoice.footer ?? ""}
            placeholder="Notes / terms shown at the bottom"
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
