// The org settings read layer (G10): the Settings page reads this view model,
// never the raw Organization row — money/percent leave here already formatted
// for the form inputs, matching the invoices read layer. No logo yet (upload
// deferred, D17).

import type { Actor } from "@/lib/authz";
import { scopedDb } from "@/lib/scope";
import { formatBpsPercent } from "@/features/invoices/validate";
import {
  formatInvoiceNumber,
  nextInvoiceNumberValue,
} from "@/features/invoices/numbering";

export type OrgSettingsView = {
  name: string;
  fromDetails: string;
  defaultCurrency: string;
  defaultTaxRateInput: string; // percent for the form; "" = no default tax
  defaultPaymentTermsDays: string;
  invoiceNumberPrefix: string;
  invoiceFooter: string;
  // Read-only: the number the next new draft will pre-fill (highest + 1, D15),
  // shown so the prefix change's effect is visible without an editable counter.
  nextInvoiceNumberPreview: string;
};

export async function getOrgSettings(actor: Actor): Promise<OrgSettingsView> {
  const db = scopedDb(actor.organizationId);
  const org = await db.organization.findFirst();
  if (!org) throw new Error("Organization not found.");

  const invoices = await db.invoice.findMany({ select: { number: true } });
  const next = nextInvoiceNumberValue(invoices.map((i) => i.number));

  return {
    name: org.name,
    fromDetails: org.fromDetails ?? "",
    defaultCurrency: org.defaultCurrency,
    defaultTaxRateInput:
      org.defaultTaxRateBps > 0 ? formatBpsPercent(org.defaultTaxRateBps) : "",
    defaultPaymentTermsDays: String(org.defaultPaymentTermsDays),
    invoiceNumberPrefix: org.invoiceNumberPrefix,
    invoiceFooter: org.invoiceFooter ?? "",
    nextInvoiceNumberPreview: formatInvoiceNumber(org.invoiceNumberPrefix, next),
  };
}
