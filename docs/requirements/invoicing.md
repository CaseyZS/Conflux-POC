# Invoicing

_Part of the [Conflux requirements](../requirements.md). Builds on the [data model](./data-model.md)._

The payoff feature and the heart of the stakeholder demo: turning tracked work into a professional-looking invoice. "Looks professional" is the explicit bar.

## What feeds an invoice (all three, mixable on one invoice)

- **Tracked billable time** — unbilled billable hours for a project become line items (hours × rate).
- **Fixed-fee amount** — a project's flat fee as a single line, independent of hours.
- **Manual line items** — free-form lines the user adds (reimbursables, ad-hoc charges, etc.).

## Line grouping — chosen per invoice

When creating an invoice from tracked time, the user picks how to itemize. All four are computed from the same underlying billable entries — grouping is a presentation choice, not stored duplication:

- **By task** — one line per task (`Design — 12h × $150`). The clean default.
- **By person** — one line per team member (meaningful once multi-user exists).
- **Summary** — a single lump-sum "Services rendered" line.
- **Detailed** — one line per time entry, notes included.

## Lifecycle: draft → finalized → sent → paid

- **Draft** — reads **live** from currently unbilled billable time; edit freely, choose grouping, add manual lines.
- **Finalize** — the numbers **snapshot** onto the invoice (line items, rates, amounts), an **invoice number** is assigned, and the billed time entries are **linked to this invoice** so they can never be invoiced twice. The finalized invoice is immutable: later edits to a project's rate do not change it. (This is the "derive until finalized, then snapshot" rule from the [data model](./data-model.md), realized.)
- **Sent / Paid** — manual status flags (`draft` → `sent` → `paid`). No payment processing or gateway in the POC; "mark as paid" is a human action.

The "billed" state of a time entry is real state (a link to the invoice that billed it), justified because it prevents double-billing — this is a deliberate stored value, not a convenience copy.

## Output

A **polished on-screen invoice** in the browser, plus **PDF download / print**. No email delivery or payment gateway in the POC.

## Invoice fields

- **Header / branding** — company logo, business name, and "from" details.
- **Bill-to** — client name, contact, address, pulled from the Client record.
- **Reference block** — auto invoice number, issue date, due date, payment terms, and the **client PO number**.
- **Line items** — per the chosen grouping.
- **Money block** — subtotal, optional **discount** (percent or flat), optional **tax** (percent applied to subtotal after discount), total.
- **Footer** — notes / terms.
- **Currency** — taken from the client record.

## Money-handling assumption (a "why" worth stating)

Monetary amounts are stored as **integer minor units** (e.g. cents), not floating-point, to avoid rounding errors like `0.1 + 0.2 ≠ 0.3`. Formatting to `$1,800.00` happens only at display time. (In LabVIEW terms: keep the wire an integer of pennies; convert to a formatted string only at the indicator.)
