/**
 * Column-transform tests — the registry built from `config/functions/*.ts`
 * and the `date_difference` transform that project uses for the
 * Beurlaubungsdauer column.
 */
import { describe, it, expect } from "vitest";
import { buildRegistry, type ColumnTransform, type TransformContext } from "../../src/modules/transforms";
import { date_difference } from "../../config/functions/dates";

function ctx(rowCount: number, options: Record<string, unknown> = {}): TransformContext {
  return { rowCount, options, dataset: "D", column: "c" };
}

describe("buildRegistry", () => {
  it("collects every named function export, skipping non-functions", () => {
    const fn: ColumnTransform = () => [];
    const { registry, duplicates } = buildRegistry({
      "/config/functions/a.ts": { alpha: fn, NOT_A_FN: 42 },
      "/config/functions/b.ts": { beta: fn },
    });
    expect(Object.keys(registry).sort()).toEqual(["alpha", "beta"]);
    expect(duplicates).toEqual([]);
  });

  it("reports a name defined in two files (last one wins)", () => {
    const first: ColumnTransform = () => ["first"];
    const second: ColumnTransform = () => ["second"];
    const { registry, duplicates } = buildRegistry({
      "/config/functions/b.ts": { dup: second },
      "/config/functions/a.ts": { dup: first },
    });
    expect(duplicates).toEqual(["dup"]);
    // Sorted by path, so b.ts loads last.
    expect(registry.dup([], ctx(1))).toEqual(["second"]);
  });
});

describe("date_difference", () => {
  it("counts whole days between two ISO dates", () => {
    const out = date_difference([["2025-01-31"], ["2025-01-01"]], ctx(1));
    expect(out).toEqual([30]);
  });

  it("accepts German TT.MM.JJJJ, Date objects and Excel serials", () => {
    expect(date_difference([["31.01.2025"], ["01.01.2025"]], ctx(1))).toEqual([30]);
    expect(
      date_difference([[new Date(2025, 0, 31)], [new Date(2025, 0, 1)]], ctx(1))
    ).toEqual([30]);
    // 45688 = 2025-01-31, 45658 = 2025-01-01 in Excel's serial calendar.
    expect(date_difference([[45688], [45658]], ctx(1))).toEqual([30]);
  });

  it("counts both endpoints with inclusive", () => {
    expect(date_difference([["2025-01-31"], ["2025-01-01"]], ctx(1, { inclusive: true }))).toEqual([31]);
  });

  it("clamps with min and max", () => {
    // End before start would be -30 days.
    expect(date_difference([["2025-01-01"], ["2025-01-31"]], ctx(1, { min: 0 }))).toEqual([0]);
    expect(date_difference([["2025-12-31"], ["2025-01-01"]], ctx(1, { max: 90 }))).toEqual([90]);
  });

  it("yields an empty cell — not 0 — when a date is missing or unparseable", () => {
    const out = date_difference(
      [["2025-01-31", "", "kein Datum", "2025-01-31"], ["2025-01-01", "2025-01-01", "2025-01-01", ""]],
      ctx(4)
    );
    expect(out).toEqual([30, "", "", ""]);
  });

  it("rejects an overflowing date rather than rolling it over", () => {
    expect(date_difference([["31.02.2025"], ["01.01.2025"]], ctx(1))).toEqual([""]);
  });

  describe("clamping to a reporting period", () => {
    const period = { clamp_start: "2025-01-01", clamp_end: "2025-12-31", inclusive: true };

    it("counts a span that lies wholly inside the period unchanged", () => {
      expect(date_difference([["2025-03-31"], ["2025-03-01"]], ctx(1, period))).toEqual([31]);
    });

    it("counts a span starting before the period from the first day", () => {
      expect(date_difference([["2025-01-10"], ["2024-11-01"]], ctx(1, period))).toEqual([10]);
    });

    it("counts a span ending after the period to the last day", () => {
      expect(date_difference([["2026-04-01"], ["2025-12-01"]], ctx(1, period))).toEqual([31]);
    });

    it("caps a span covering the whole period at the period length", () => {
      expect(date_difference([["2026-06-01"], ["2024-06-01"]], ctx(1, period))).toEqual([365]);
    });

    it("yields an empty cell for a span entirely outside the period", () => {
      // Not 0: the row contributes nothing, rather than dragging a mean down.
      expect(date_difference([["2024-12-31"], ["2024-01-01"]], ctx(1, period))).toEqual([""]);
      expect(date_difference([["2026-12-31"], ["2026-01-01"]], ctx(1, period))).toEqual([""]);
    });

    it("treats a boundary day as inside the period", () => {
      expect(date_difference([["2025-01-01"], ["2024-01-01"]], ctx(1, period))).toEqual([1]);
      expect(date_difference([["2026-01-01"], ["2025-12-31"]], ctx(1, period))).toEqual([1]);
    });
  });

  it("returns one entry per row even when the columns are short", () => {
    expect(date_difference([[], []], ctx(3))).toEqual(["", "", ""]);
  });
});
