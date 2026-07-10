/**
 * Wrangle tests — the shared filter → groupby (rows × cols) → aggregate
 * crosstab step consumed by the table renderer, chart renderer, and
 * alt-text module. Covers every aggregation op, rows-only vs rows×cols,
 * filtering, first-seen ordering, empty-key skipping, protection flags
 * (including the share-op percentage quirk), and empty datasets.
 */
import { describe, it, expect } from "vitest";
import { wrangleTable } from "../../src/modules/aggregation";
import type { DataSet } from "../../src/modules/types";

// 7 rows: 4 women (2 in A, 2 in B), 3 men (2 in A, 1 in B).
function employees(): DataSet {
  return [
    { Org: "A", Geschlecht: "w", Gehalt: 10, Aktiv: "Ja" },
    { Org: "A", Geschlecht: "w", Gehalt: 20, Aktiv: "Nein" },
    { Org: "A", Geschlecht: "m", Gehalt: 30, Aktiv: "Ja" },
    { Org: "A", Geschlecht: "m", Gehalt: 50, Aktiv: "Ja" },
    { Org: "B", Geschlecht: "w", Gehalt: 40, Aktiv: "Ja" },
    { Org: "B", Geschlecht: "w", Gehalt: 60, Aktiv: "Nein" },
    { Org: "B", Geschlecht: "m", Gehalt: 70, Aktiv: "Ja" },
  ];
}

describe("wrangleTable — shapes", () => {
  it("rows × cols crosstab with count", () => {
    const w = wrangleTable(
      { groupby: { rows: "Org", cols: "Geschlecht" }, aggregation: "count" },
      employees()
    );
    expect(w.rowHeader).toBe("Org");
    expect(w.colHeader).toBe("Geschlecht");
    expect(w.rows).toEqual(["A", "B"]);
    expect(w.cols).toEqual(["w", "m"]); // first-seen order
    expect(w.cells.map((r) => r.map((c) => c.value))).toEqual([
      [2, 2],
      [2, 1],
    ]);
    expect(w.cells[1][1].n).toBe(1);
    expect(w.isShare).toBe(false);
  });

  it("rows-only produces a single synthetic value column", () => {
    const w = wrangleTable({ groupby: { rows: "Geschlecht" }, aggregation: "count" }, employees());
    expect(w.rows).toEqual(["w", "m"]);
    expect(w.colHeader).toBeUndefined();
    expect(w.cols).toEqual([w.valueLabel]);
    expect(w.cells.map((r) => r.map((c) => c.value))).toEqual([[4], [3]]);
  });

  it("uses the value column name as the synthetic column label", () => {
    const w = wrangleTable(
      { groupby: { rows: "Org" }, aggregation: "mean", value: "Gehalt" },
      employees()
    );
    expect(w.valueLabel).toBe("Gehalt");
    expect(w.cols).toEqual(["Gehalt"]);
  });

  it("skips rows with empty row/col keys", () => {
    const data: DataSet = [
      { Org: "A", Geschlecht: "w" },
      { Org: "", Geschlecht: "w" },
      { Org: "B", Geschlecht: "" },
      { Org: null, Geschlecht: "m" },
    ];
    const w = wrangleTable(
      { groupby: { rows: "Org", cols: "Geschlecht" }, aggregation: "count" },
      data
    );
    expect(w.rows).toEqual(["A"]);
    expect(w.cols).toEqual(["w"]);
  });

  it("empty dataset yields an empty crosstab", () => {
    const w = wrangleTable(
      { groupby: { rows: "Org", cols: "Geschlecht" }, aggregation: "count" },
      []
    );
    expect(w.rows).toEqual([]);
    expect(w.cells).toEqual([]);
  });

  it("missing cells (row/col combination absent) aggregate over an empty bucket", () => {
    const data: DataSet = [
      { Org: "A", Geschlecht: "w" },
      { Org: "B", Geschlecht: "m" },
    ];
    const w = wrangleTable(
      { groupby: { rows: "Org", cols: "Geschlecht" }, aggregation: "count" },
      data
    );
    expect(w.cells.map((r) => r.map((c) => c.value))).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(w.cells[0][1].n).toBe(0);
  });
});

describe("wrangleTable — aggregation ops", () => {
  const spec = (aggregation: any, value?: string) => ({
    groupby: { rows: "Org", cols: "Geschlecht" },
    aggregation,
    value,
  });
  const values = (w: ReturnType<typeof wrangleTable>) =>
    w.cells.map((r) => r.map((c) => c.value));

  it("sum", () => {
    expect(values(wrangleTable(spec("sum", "Gehalt"), employees()))).toEqual([
      [30, 80],
      [100, 70],
    ]);
  });

  it("mean", () => {
    expect(values(wrangleTable(spec("mean", "Gehalt"), employees()))).toEqual([
      [15, 40],
      [50, 70],
    ]);
  });

  it("min / max", () => {
    expect(values(wrangleTable(spec("min", "Gehalt"), employees()))).toEqual([
      [10, 30],
      [40, 70],
    ]);
    expect(values(wrangleTable(spec("max", "Gehalt"), employees()))).toEqual([
      [20, 50],
      [60, 70],
    ]);
  });

  it("median", () => {
    const data: DataSet = [
      { Org: "A", Geschlecht: "w", Gehalt: 1 },
      { Org: "A", Geschlecht: "w", Gehalt: 2 },
      { Org: "A", Geschlecht: "w", Gehalt: 10 },
    ];
    expect(values(wrangleTable(spec("median", "Gehalt"), data))).toEqual([[2]]);
  });

  it("share_total is a percentage of all (filtered) rows and flags isShare", () => {
    const w = wrangleTable(spec("share_total"), employees());
    expect(w.isShare).toBe(true);
    const flat = w.cells.flat().map((c) => c.value);
    expect(flat.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(w.cells[0][0].value).toBeCloseTo((2 / 7) * 100);
  });

  it("share_group is the percentage of truthy value-rows within each cell", () => {
    const w = wrangleTable(spec("share_group", "Aktiv"), employees());
    expect(w.cells[0][0].value).toBeCloseTo(50); // A/w: 1 of 2 aktiv
    expect(w.cells[0][1].value).toBeCloseTo(100); // A/m: 2 of 2
    expect(w.cells[1][0].value).toBeCloseTo(50); // B/w: 1 of 2
  });
});

describe("wrangleTable — filter", () => {
  it("applies the truthy-column filter before grouping (and before share_total's total)", () => {
    const w = wrangleTable(
      { groupby: { rows: "Org" }, aggregation: "share_total", filter: "Aktiv" },
      employees()
    );
    // 5 aktiv rows: A=3, B=2.
    expect(w.cells.map((r) => r[0].value)).toEqual([60, 40]);
  });

  it('"Alle" and missing filter columns are no-ops', () => {
    const all = wrangleTable(
      { groupby: { rows: "Org" }, aggregation: "count", filter: "Alle" },
      employees()
    );
    const missing = wrangleTable(
      { groupby: { rows: "Org" }, aggregation: "count", filter: "NichtDa" },
      employees()
    );
    expect(all.cells.map((r) => r[0].value)).toEqual([4, 3]);
    expect(missing.cells.map((r) => r[0].value)).toEqual([4, 3]);
  });
});

describe("wrangleTable — data protection", () => {
  it("flags count-like cells below the threshold, keeping the raw value", () => {
    const w = wrangleTable(
      { groupby: { rows: "Org", cols: "Geschlecht" }, aggregation: "count" },
      employees(),
      2
    );
    expect(w.threshold).toBe(2);
    expect(w.cells[1][1]).toMatchObject({ value: 1, protected: true }); // B/m = 1
    expect(w.cells[0][0]).toMatchObject({ value: 2, protected: false }); // at threshold
  });

  it("zero cells are not flagged (no data to protect)", () => {
    const data: DataSet = [
      { Org: "A", Geschlecht: "w" },
      { Org: "B", Geschlecht: "m" },
    ];
    const w = wrangleTable(
      { groupby: { rows: "Org", cols: "Geschlecht" }, aggregation: "count" },
      data,
      5
    );
    expect(w.cells[0][1]).toMatchObject({ value: 0, protected: false });
    expect(w.cells[0][0]).toMatchObject({ value: 1, protected: true });
  });

  it("does not flag mean/median/min/max (they don't reveal group sizes)", () => {
    const w = wrangleTable(
      { groupby: { rows: "Org" }, aggregation: "mean", value: "Gehalt" },
      [{ Org: "A", Gehalt: 1 }],
      5
    );
    expect(w.cells[0][0].protected).toBe(false);
  });

  it("share ops threshold the percentage value (existing behavior)", () => {
    // A single cell holding 3% of rows with threshold 5 → flagged.
    const data: DataSet = Array.from({ length: 100 }, (_, i) => ({
      Org: i < 3 ? "A" : "B",
    }));
    const w = wrangleTable({ groupby: { rows: "Org" }, aggregation: "share_total" }, data, 5);
    expect(w.cells[0][0]).toMatchObject({ value: 3, protected: true });
    expect(w.cells[1][0]).toMatchObject({ value: 97, protected: false });
  });

  it("threshold 0 (unset) never flags", () => {
    const w = wrangleTable({ groupby: { rows: "Org" }, aggregation: "count" }, employees());
    expect(w.cells.flat().every((c) => !c.protected)).toBe(true);
  });
});
