import { describe, expect, it } from "vitest";
import {
  deriveFeeLine,
  deriveTimeLines,
  formatQuantityMilli,
  secondsToMilliHours,
  type DetailToggles,
  type PoolEntryFact,
} from "./derive";

const OFF: DetailToggles = {
  showDate: false,
  showPerson: false,
  showTask: false,
  showNote: false,
};

function fact(overrides: Partial<PoolEntryFact>): PoolEntryFact {
  return {
    date: "2026-06-29",
    personName: "Demo Admin",
    taskName: "Development",
    note: null,
    durationSeconds: 3600,
    rateMinor: 12500,
    ...overrides,
  };
}

describe("secondsToMilliHours", () => {
  it("converts whole and fractional hours half-up", () => {
    expect(secondsToMilliHours(3600)).toBe(1000);
    expect(secondsToMilliHours(5400)).toBe(1500);
    expect(secondsToMilliHours(1800)).toBe(500);
    expect(secondsToMilliHours(3000)).toBe(833); // 50 min = 833.3… milli
    expect(secondsToMilliHours(2700)).toBe(750);
  });
});

describe("formatQuantityMilli", () => {
  it("trims to the digits that matter", () => {
    expect(formatQuantityMilli(12500)).toBe("12.5");
    expect(formatQuantityMilli(833)).toBe("0.833");
    expect(formatQuantityMilli(1000)).toBe("1");
    expect(formatQuantityMilli(0)).toBe("0");
  });
});

describe("deriveTimeLines — task grouping", () => {
  it("groups by task and sums hours (the clean default)", () => {
    const lines = deriveTimeLines(
      [
        fact({ taskName: "Design", durationSeconds: 5400 }),
        fact({ taskName: "Design", durationSeconds: 3600 }),
        fact({ taskName: "Development", durationSeconds: 7200 }),
      ],
      "task",
      OFF,
    );
    expect(lines).toEqual([
      {
        description: "Design",
        quantityMilli: 2500,
        unitRateMinor: 12500,
        amountMinor: 31250,
      },
      {
        description: "Development",
        quantityMilli: 2000,
        unitRateMinor: 12500,
        amountMinor: 25000,
      },
    ]);
  });

  it("splits the same task at two rates — every line carries one rate", () => {
    const lines = deriveTimeLines(
      [
        fact({ taskName: "Design", rateMinor: 9500 }),
        fact({ taskName: "Design", rateMinor: 11000 }),
      ],
      "task",
      OFF,
    );
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.unitRateMinor)).toEqual([9500, 11000]);
  });

  it("drops zero-duration entries and yields nothing for an empty pool", () => {
    expect(deriveTimeLines([], "task", OFF)).toEqual([]);
    expect(
      deriveTimeLines([fact({ durationSeconds: 0 })], "task", OFF),
    ).toEqual([]);
  });
});

describe("deriveTimeLines — person grouping", () => {
  it("splits a person by rate with the task parenthetical", () => {
    const lines = deriveTimeLines(
      [
        fact({ taskName: "Design", rateMinor: 15000, durationSeconds: 18000 }),
        fact({ taskName: "Admin", rateMinor: 7500, durationSeconds: 18000 }),
      ],
      "person",
      OFF,
    );
    expect(lines).toEqual([
      {
        description: "Demo Admin (Admin)",
        quantityMilli: 5000,
        unitRateMinor: 7500,
        amountMinor: 37500,
      },
      {
        description: "Demo Admin (Design)",
        quantityMilli: 5000,
        unitRateMinor: 15000,
        amountMinor: 75000,
      },
    ]);
  });

  it("keeps a single-rate person as one plain line", () => {
    const lines = deriveTimeLines(
      [fact({}), fact({ taskName: "Design" })],
      "person",
      OFF,
    );
    expect(lines).toEqual([
      {
        description: "Demo Admin",
        quantityMilli: 2000,
        unitRateMinor: 12500,
        amountMinor: 25000,
      },
    ]);
  });
});

describe("deriveTimeLines — summary grouping", () => {
  it("is one hours × rate line when the rate is uniform", () => {
    const lines = deriveTimeLines(
      [fact({ durationSeconds: 5400 }), fact({ durationSeconds: 3600 })],
      "summary",
      OFF,
    );
    expect(lines).toEqual([
      {
        description: "Services rendered",
        quantityMilli: 2500,
        unitRateMinor: 12500,
        amountMinor: 31250,
      },
    ]);
  });

  it("collapses mixed rates into 1 × amount, summing per-rate rounded groups", () => {
    // 20 min at $99.99 → 333 milli × 9999 = $33.30 (rounded); 30 min at
    // $125.00 → $62.50; the lump line must equal their sum exactly.
    const lines = deriveTimeLines(
      [
        fact({ durationSeconds: 1200, rateMinor: 9999 }),
        fact({ durationSeconds: 1800, rateMinor: 12500 }),
      ],
      "summary",
      OFF,
    );
    expect(lines).toEqual([
      {
        description: "Services rendered",
        quantityMilli: 1000,
        unitRateMinor: 9580,
        amountMinor: 9580, // 3330 + 6250
      },
    ]);
  });
});

describe("deriveTimeLines — detailed grouping", () => {
  it("keeps one line per entry in day order, notes included", () => {
    const lines = deriveTimeLines(
      [
        fact({ date: "2026-07-01", note: "Nav and footer" }),
        fact({ date: "2026-06-29", note: "Home page layout" }),
        fact({ date: "2026-06-30", note: null, taskName: "Design" }),
      ],
      "detailed",
      OFF,
    );
    expect(lines.map((l) => l.description)).toEqual([
      "Development — Home page layout",
      "Design",
      "Development — Nav and footer",
    ]);
  });
});

describe("deriveTimeLines — detail toggles", () => {
  const entries = [
    fact({ date: "2026-06-29", note: "Kickoff", durationSeconds: 3600 }),
    fact({ date: "2026-07-01", note: "Wireframes", durationSeconds: 3600 }),
  ];

  it("leads with the date range (YYYY/MM/DD), then person and notes", () => {
    const lines = deriveTimeLines(entries, "task", {
      showDate: true,
      showPerson: true,
      showTask: true, // already the lead — must not stutter
      showNote: true,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].description).toBe(
      "2026/06/29 – 2026/07/01 — Development · Kickoff; Wireframes · Demo Admin",
    );
  });

  it("leads with a single date, no range dash", () => {
    const lines = deriveTimeLines([entries[0]], "task", {
      ...OFF,
      showDate: true,
    });
    expect(lines[0].description).toBe("2026/06/29 — Development");
  });

  it("leads each detailed line with its own date", () => {
    const lines = deriveTimeLines(
      [
        fact({
          date: "2026-06-29",
          note: "Home page layout",
          taskName: "Design",
        }),
        fact({ date: "2026-07-02", note: null, taskName: "Development" }),
      ],
      "detailed",
      { ...OFF, showDate: true },
    );
    expect(lines.map((l) => l.description)).toEqual([
      "2026/06/29 — Design · Home page layout",
      "2026/07/02 — Development",
    ]);
  });

  it("skips the person part when person is the grouping", () => {
    const lines = deriveTimeLines(entries, "person", {
      ...OFF,
      showPerson: true,
      showTask: true,
    });
    expect(lines[0].description).toBe("Demo Admin — Development");
  });
});

describe("deriveFeeLine", () => {
  it("is a count-of-1 line at the fee", () => {
    expect(deriveFeeLine("ERP Migration", 1_800_000)).toEqual({
      description: "ERP Migration — fixed fee",
      quantityMilli: 1000,
      unitRateMinor: 1_800_000,
      amountMinor: 1_800_000,
    });
  });
});
