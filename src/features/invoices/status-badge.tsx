import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "./validate";

// One badge for every place a lifecycle state shows (list, detail, document
// header) so the states always read the same. Server-safe: no client hooks.
const STATUS_STYLES: Record<InvoiceStatus, { label: string; classes: string }> =
  {
    draft: {
      label: "Draft",
      classes: "border border-dashed text-muted-foreground",
    },
    sent: { label: "Sent", classes: "bg-sky-100 text-sky-900" },
    paid: { label: "Paid", classes: "bg-emerald-100 text-emerald-900" },
    void: { label: "Void", classes: "bg-rose-100 text-rose-900 line-through" },
  };

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, classes } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        classes,
      )}
    >
      {label}
    </span>
  );
}
