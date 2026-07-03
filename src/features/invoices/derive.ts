// Pure derivation of a draft's computed lines: unbilled billable time facts
// in, presentation-ready lines out. Grouping and the detail toggles are
// presentation choices over the same entries (requirements/invoicing.md) —
// nothing here stores anything, and finalize snapshots exactly what this
// produced. No db imports, so the grouping rules are unit-testable the same
// way money.ts is.

import { divRoundHalfUp, lineAmountMinor } from "@/lib/money";
import { formatDaySlashes } from "@/lib/dates";
import type { InvoiceGrouping } from "./validate";

// One unbilled billable time entry, with its rate already resolved (D6:
// per_project → the project's rate, per_task → the assignment's) — resolution
// is the caller's job because it needs project rows; deriving is pure.
export type PoolEntryFact = {
  date: string; // "YYYY-MM-DD" (D11) — lexicographic order is date order
  personName: string;
  taskName: string;
  note: string | null;
  durationSeconds: number;
  rateMinor: number;
};

export type DerivedLine = {
  description: string;
  quantityMilli: number; // thousandths: hours for time lines, count for fees
  unitRateMinor: number;
  amountMinor: number;
};

export type DetailToggles = {
  showDate: boolean;
  showPerson: boolean;
  showTask: boolean;
  showNote: boolean;
};

// Seconds → thousandths of an hour, half-up (the same rounding rule as money:
// one convention for hours and counts). Groups convert their *summed* seconds
// in one step, so a group's printed hours are exact to the milli-hour rather
// than a sum of per-entry roundings.
export function secondsToMilliHours(seconds: number): number {
  return divRoundHalfUp(seconds * 1000, 3600);
}

// "12.5", "0.833", "1" — the quantity column's display, integer math only.
export function formatQuantityMilli(quantityMilli: number): string {
  const whole = Math.trunc(quantityMilli / 1000);
  const fraction = String(Math.abs(quantityMilli % 1000))
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

// Every line carries a single rate (requirements: person lines "split by
// rate" — the same is true of any grouping), so group keys always include the
// rate. Within a group the seconds sum, then price as one line (D9's
// round-each-line rule applied to what actually prints).
type Group = {
  lead: string;
  entries: PoolEntryFact[];
  rateMinor: number;
};

export function deriveTimeLines(
  entries: readonly PoolEntryFact[],
  grouping: InvoiceGrouping,
  toggles: DetailToggles,
): DerivedLine[] {
  const nonEmpty = entries.filter((e) => e.durationSeconds > 0);
  if (nonEmpty.length === 0) return [];

  if (grouping === "summary") return summaryLines(nonEmpty, toggles);

  let groups: Group[];
  if (grouping === "detailed") {
    // One line per entry, in day order; notes are inherent to this grouping.
    groups = [...nonEmpty]
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.taskName.localeCompare(b.taskName),
      )
      .map((entry) => ({
        lead: entry.taskName,
        entries: [entry],
        rateMinor: entry.rateMinor,
      }));
  } else {
    const keyOf = (e: PoolEntryFact) =>
      grouping === "task"
        ? `${e.taskName}\x00${e.rateMinor}`
        : `${e.personName}\x00${e.rateMinor}`;
    const byKey = new Map<string, PoolEntryFact[]>();
    for (const entry of nonEmpty) {
      const key = keyOf(entry);
      const group = byKey.get(key);
      if (group) group.push(entry);
      else byKey.set(key, [entry]);
    }
    groups = [...byKey.values()]
      .map((groupEntries) => ({
        lead:
          grouping === "task"
            ? groupEntries[0].taskName
            : groupEntries[0].personName,
        entries: groupEntries,
        rateMinor: groupEntries[0].rateMinor,
      }))
      .sort(
        (a, b) => a.lead.localeCompare(b.lead) || a.rateMinor - b.rateMinor,
      );

    // A person split across rates gets the disambiguating parenthetical from
    // the requirement's example — "Bob (Design)" vs "Bob (Admin)".
    if (grouping === "person") {
      const leadCounts = new Map<string, number>();
      for (const g of groups)
        leadCounts.set(g.lead, (leadCounts.get(g.lead) ?? 0) + 1);
      for (const g of groups) {
        if ((leadCounts.get(g.lead) ?? 0) > 1) {
          g.lead = `${g.lead} (${distinct(g.entries.map((e) => e.taskName)).join(", ")})`;
        }
      }
    }
  }

  return groups.map((group) => {
    const quantityMilli = secondsToMilliHours(
      group.entries.reduce((sum, e) => sum + e.durationSeconds, 0),
    );
    return {
      description: describe(group.lead, group.entries, grouping, toggles),
      quantityMilli,
      unitRateMinor: group.rateMinor,
      amountMinor: lineAmountMinor(quantityMilli, group.rateMinor),
    };
  });
}

// Summary is one "Services rendered" line. With a uniform rate it stays an
// honest hours × rate; with mixed rates there is no single rate, so the line
// becomes 1 × amount, where the amount sums the per-rate groups each rounded
// half-up — the same partition the other groupings price, so switching the
// grouping never changes the subtotal by more than presentation demands.
function summaryLines(
  entries: PoolEntryFact[],
  toggles: DetailToggles,
): DerivedLine[] {
  const description = describe(
    "Services rendered",
    entries,
    "summary",
    toggles,
  );
  const rates = distinct(entries.map((e) => e.rateMinor));
  if (rates.length === 1) {
    const quantityMilli = secondsToMilliHours(
      entries.reduce((sum, e) => sum + e.durationSeconds, 0),
    );
    return [
      {
        description,
        quantityMilli,
        unitRateMinor: rates[0],
        amountMinor: lineAmountMinor(quantityMilli, rates[0]),
      },
    ];
  }
  let amountMinor = 0;
  for (const rate of rates) {
    const seconds = entries
      .filter((e) => e.rateMinor === rate)
      .reduce((sum, e) => sum + e.durationSeconds, 0);
    amountMinor += lineAmountMinor(secondsToMilliHours(seconds), rate);
  }
  return [
    {
      description,
      quantityMilli: 1000,
      unitRateMinor: amountMinor,
      amountMinor,
    },
  ];
}

// The description: when a date is shown it LEADS the line (YYYY/MM/DD), then
// the grouping's lead and the toggled detail parts — all derived from the same
// entries, never stored (the snapshot captures the final string at finalize).
// Parts a grouping already shows are skipped, so toggles annotate instead of
// stutter.
function describe(
  lead: string,
  entries: PoolEntryFact[],
  grouping: InvoiceGrouping,
  toggles: DetailToggles,
): string {
  const parts: string[] = [];

  if (grouping === "detailed") {
    const note = entries[0].note;
    if (note) parts.push(note);
  } else if (toggles.showNote) {
    const notes = distinct(entries.flatMap((e) => (e.note ? [e.note] : [])));
    if (notes.length > 0) parts.push(notes.join("; "));
  }

  if (toggles.showPerson && grouping !== "person") {
    parts.push(distinct(entries.map((e) => e.personName)).join(", "));
  }

  const taskAlreadyShown =
    grouping === "task" || grouping === "detailed" || lead.includes("(");
  if (toggles.showTask && !taskAlreadyShown) {
    parts.push(distinct(entries.map((e) => e.taskName)).join(", "));
  }

  // Date first when shown: the date is the leading element, then the lead and
  // any other parts follow. A single day prints once; a spanning group prints
  // its first–last range, both in YYYY/MM/DD.
  if (toggles.showDate) {
    const dates = distinct(entries.map((e) => e.date)).sort();
    const first = formatDaySlashes(dates[0]);
    const last = formatDaySlashes(dates[dates.length - 1]);
    const dateLabel = dates.length === 1 ? first : `${first} – ${last}`;
    return `${dateLabel} — ${[lead, ...parts].join(" · ")}`;
  }

  return parts.length > 0 ? `${lead} — ${parts.join(" · ")}` : lead;
}

// A fixed fee is one count-of-1 line at the fee (requirements: the flat fee
// as a single line, independent of hours).
export function deriveFeeLine(
  projectName: string,
  feeMinor: number,
): DerivedLine {
  return {
    description: `${projectName} — fixed fee`,
    quantityMilli: 1000,
    unitRateMinor: feeMinor,
    amountMinor: lineAmountMinor(1000, feeMinor),
  };
}

function distinct<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
