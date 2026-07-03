# Invoicing

_Part of the [Conflux requirements](../requirements.md). Builds on the [data model](./data-model.md)._

The payoff feature and the heart of the stakeholder demo: turning tracked work into a professional-looking invoice. "Looks professional" is the explicit bar.

## What feeds an invoice (all three, mixable on one invoice)

An invoice bills **one Client** and may draw from **one or more of that client's Projects** (the bill-to comes from the Client record). Three kinds of source line, mixable on the same invoice:

- **Tracked billable time** — unbilled billable hours for the client's hourly projects become line items (hours × rate). Finalizing **links** those entries to the invoice so they can't be billed again.
- **Fixed-fee amount** — a fixed-fee project's flat fee as a single line, independent of hours. It is billable **once**: finalizing links the fee to the invoice the same way, so a second invoice won't offer it again. (Milestone/installment billing of a fee is out of scope for the POC.)
- **Manual line items** — free-form lines the user adds (reimbursables, ad-hoc charges, etc.). These belong to the invoice itself, so there's no double-bill concern.

## Line grouping — chosen per invoice

When creating an invoice from tracked time, the user picks how to itemize. All four are computed from the same underlying billable entries — grouping is a presentation choice, not stored duplication. (When an invoice spans several of the client's projects, whether lines are also sectioned per project is a display detail, not a data one — a two-way door.)

- **By task** — one line per task (`Design — 12h × $150`). The clean default.
- **By person** — one line per team member, **split by rate** where a person logged at more than one rate (e.g. `Bob (Design) — 5h × $150`, `Bob (Admin) — 5h × $75`); every line always carries a single rate. Meaningful once multi-user exists.
- **Summary** — a single lump-sum "Services rendered" line.
- **Detailed** — one line per time entry, notes included.

## Optional line-item detail

Independent of the grouping, the user can toggle which per-entry fields appear on the line items — **date, person, task, and note** — the way Harvest exposes detail columns. Like grouping, these are **derived** from the same billable entries (a presentation choice, not stored duplication), so showing them is additive and changes nothing about what's stored; at finalize the shown detail is captured in the line snapshot. Most useful with the **Detailed** grouping, but the toggles can annotate any grouping.

## Lifecycle: draft → finalized → sent → paid

- **Draft** — reads **live** from currently unbilled billable time; edit freely, choose grouping, add manual lines. A draft **stores its choices** (client, the projects/fees included, grouping, manual lines, discount, tax, PO number, dates, footer) but **not** the computed time line items — those stay derived from the live entries until finalize. _Planned (not in the POC):_ scope the pull to a **period** — month, quarter, or a custom cutoff — instead of all unbilled time; a purely additive filter, since "unbilled" already excludes prior-invoice entries.
- **Finalize** — the numbers **snapshot** onto the invoice (line items, rates, amounts, **currency**, and the frozen **bill-to** and **from/branding** blocks), the **invoice number** is frozen, and the billed time entries — plus any fixed fee — are **linked to this invoice** so they can never be invoiced twice. The invoice number is **pre-filled when the draft is created** — one past the highest number on any existing invoice, under the Organization's prefix — and stays **editable while the invoice is a draft**, then freezes at finalize. Numbers are **unique per organization** (a duplicate is rejected), but because they're editable they are **not strictly gapless** — a deliberate revision of the original gapless-counter design (see the decision log in [architecture](../architecture.md)). The finalized invoice is immutable: later edits to a project's rate — or to the client's address or the company's branding — do not change it. (This is the "derive until finalized, then snapshot" rule from the [data model](./data-model.md), realized.)
- **Sent / Paid** — manual status flags (`draft` → `sent` → `paid`). No payment processing or gateway in the POC; "mark as paid" is a human action.
- **Void** — a finalized invoice (sent or paid) that turns out to be wrong can be **voided**. It stays on record with its number, marked **void** (the audit trail is preserved), and the time entries and fixed fees it billed are **released back to the unbilled pool** so a corrected invoice can bill them again. This is the POC's correction path — a finalized invoice is never edited in place.

The "billed" state of a time entry is real state (a link to the invoice that billed it), justified because it prevents double-billing — this is a deliberate stored value, not a convenience copy. Because this link is set only at **finalize**, deleting a **draft** removes just the draft and its manual lines — no entries were ever reserved, so none need releasing back to the unbilled pool. **Voiding** a finalized invoice is the reverse of finalize: it releases those links.

**Correction: void is the POC path; credit note is deferred.** A finalized invoice can't be edited in place. Voiding (above) is the correction flow — release the linked work and issue a corrected invoice. A **credit note** — a reversing document that _offsets_ an invoice already paid or filed rather than cancelling it, keeping both on the ledger — is **deferred to the full version** (the accounting-correct path when money has already changed hands).

### Deferred to the full version (not POC)

- **Credit notes** — the offset-don't-cancel correction described above.
- **Email delivery** — at finalize, offer to **send the invoice to chosen client contacts** by email (recipients picked from the client's contacts). The POC output is on-screen + PDF only (see [Output](#output)); no email or gateway.

## Output

A **polished on-screen invoice** in the browser, plus **PDF download / print**. No email delivery or payment gateway in the POC.

## Invoice fields

- **Header / branding** — company logo, business name, and "from" details, from the Organization; likewise **snapshotted at finalize** (logo by reference).
- **Bill-to** — client name, contact, address; pulled live from the Client record on a draft, then **snapshotted at finalize** so a later client-address change can't rewrite a sent invoice (G5).
- **Reference block** — the invoice number (pre-filled and editable on the draft; see lifecycle), issue date, **payment terms and a due date derived from them** (terms pre-filled from the Organization default; the **due date is user-overridable** on the draft), and the **client PO number**.
- **Line items** — per the chosen grouping.
- **Money block** — subtotal, optional **discount** (percent or flat), a single optional **tax** (percent applied to subtotal after discount; compound/multiple taxes are out of scope), total. Every step rounds **per line, half-up, then sums** (see below), so the printed figures always add up.
- **Footer** — notes / terms.
- **Currency** — taken from the client record.

## Money-handling assumption (a "why" worth stating)

Monetary amounts are stored as **integer minor units** (e.g. cents), not floating-point, to avoid rounding errors like `0.1 + 0.2 ≠ 0.3`. Formatting to `$1,800.00` happens only at display time, through **one central formatter** that takes the currency (never a hardcoded `÷100`). The POC targets 2-decimal currencies but stores nothing that blocks other exponents (JPY has 0, some have 3) later. (In LabVIEW terms: keep the wire an integer of pennies; convert to a formatted string only at the indicator.)

**Rounding rule.** When math yields fractional minor units (an odd rate, or `8.25%` tax), round **each line item to the currency's minor unit, half-up (away from zero)**, then make the subtotal the sum of the rounded lines; apply the discount, then the tax, rounding each the same way. This keeps the visible line items summing exactly to the total — the whole point of storing integer minor units.
