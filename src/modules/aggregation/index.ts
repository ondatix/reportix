/**
 * Aggregation module — small set of named aggregation operations applied
 * to row sets. Used by both the chart renderer (pivot/grouping) and the
 * table renderer (GROUP BY semantics). Self-contained and reusable.
 */
import type { DataSet } from "../types";

export type AggregationOp =
  | "identity"
  | "count"
  | "sum"
  | "mean"
  | "min"
  | "max"
  | "median"
  | "share_total"
  | "share_group";

export const AGGREGATION_OPS: AggregationOp[] = [
  "identity",
  "count",
  "sum",
  "mean",
  "min",
  "max",
  "median",
  "share_total",
  "share_group",
];

/** Per-op flag: does this op produce a percentage (0–100) value? Used for default formatting. */
export function isShareOp(op: AggregationOp): boolean {
  return op === "share_total" || op === "share_group";
}

/**
 * Whether data protection (suppress values below a privacy threshold) should
 * apply to this aggregation. Counts, sums, and shares are "count-like" and
 * therefore reveal group sizes; means/medians/min/max do not.
 */
export function shouldProtect(op: AggregationOp): boolean {
  return op === "count" || op === "sum" || op === "share_total" || op === "share_group";
}

export function isAggregationOp(s: unknown): s is AggregationOp {
  return typeof s === "string" && (AGGREGATION_OPS as string[]).includes(s);
}

/**
 * Apply an aggregation to a group of rows for a given numeric field.
 * `count` returns the row count and ignores the field.
 * `share_total` returns the group's row count as a percentage of `total`
 *   (the universe of rows the group was drawn from). Falls back to 100 if
 *   `total` is not provided or zero.
 * `share_group` interprets `field` as a boolean column and returns the
 *   percentage of `true` rows within the group.
 * `identity` returns the first value found (useful as a "first-of-group"
 *   passthrough, e.g. for displaying a group key in tables).
 * Non-numeric / missing values are skipped before numeric aggregations.
 */
export function aggregateField(
  rows: DataSet,
  field: string | undefined,
  op: AggregationOp,
  total?: number
): number {
  if (op === "count") return rows.length;
  if (op === "share_total") {
    if (!total || total === 0) return 100;
    return (rows.length / total) * 100;
  }
  if (op === "share_group") {
    if (!field || rows.length === 0) return 0;
    const truthy = rows.filter((r) => coerceBoolean(r[field])).length;
    return (truthy / rows.length) * 100;
  }
  if (!field) return 0;

  const values = rows
    .map((r) => Number(r[field]))
    .filter((v) => !Number.isNaN(v));

  if (op === "identity") return values[0] ?? 0;
  if (values.length === 0) return 0;

  switch (op) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "mean":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "median": {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }
  }
}

/** Coerce common truthy-ish representations into a boolean. */
function coerceBoolean(v: unknown): boolean {
  if (v === true) return true;
  if (v === false || v === null || v === undefined || v === "") return false;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return /^(ja|yes|true|wahr|1)$/i.test(v.trim());
  return Boolean(v);
}

/**
 * Filter rows by a column whose values should be truthy.
 * `Alle`, `-`, empty, or undefined `field` values disable filtering.
 * Strings like "Ja"/"Yes"/"true"/"1" are treated as truthy.
 */
export function applyFilter(data: DataSet, field?: string): DataSet {
  if (!field || field === "Alle" || field === "-") return data;
  // If the named field doesn't exist on any row, leave the data unchanged
  // (keeps templates resilient to filter typos / data-driven configs).
  if (data.length > 0 && !(field in data[0])) return data;
  return data.filter((row) => coerceBoolean(row[field]));
}

/**
 * Replace numeric values below a privacy threshold with the threshold
 * itself (so the bar/cell is still visible at minimum size), and return
 * a parallel set of indices that callers can use to relabel them as
 * "<threshold" in tooltips, tables, etc.
 *
 * Zero is preserved (no data to protect). Negative values (e.g. pyramid
 * left-side which is negated) are protected by absolute magnitude.
 */
export function applyDataProtection(
  values: number[],
  threshold: number
): { values: number[]; protectedIdx: Set<number> } {
  const protectedIdx = new Set<number>();
  const out = values.map((v, i) => {
    const abs = Math.abs(v);
    if (abs > 0 && abs < threshold) {
      protectedIdx.add(i);
      return v < 0 ? -threshold : threshold;
    }
    return v;
  });
  return { values: out, protectedIdx };
}

/**
 * Apply `identity` semantics: returns the first non-empty raw value of
 * `field` across `rows`. Preserves non-numeric values (strings, dates, ...),
 * unlike `aggregateField` which coerces to number.
 */
export function firstValue(rows: DataSet, field: string): unknown {
  for (const r of rows) {
    const v = r[field];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
}

// ── Pivots ──────────────────────────────────────────────────────────
// Pure data-shape transformations used by both the chart renderer and the
// alt-text module so both consume the same source of truth.

/** Bucket rows by the string value of `field`, preserving first-seen order. */
export function groupRowsBy(data: DataSet, field: string): Map<string, DataSet> {
  const groups = new Map<string, DataSet>();
  for (const row of data) {
    const key = String(row[field] ?? "");
    if (key === "") continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return groups;
}

/**
 * Pivot long-form rows to wide-form: labels = unique x values (insertion
 * order), one series per distinct color value, y aggregated per (x, group)
 * using `op`.
 */
export function pivotByGroup(
  data: DataSet,
  xField: string,
  yField: string,
  colorField: string,
  op: AggregationOp,
  total: number
): { labels: string[]; series: { name: string; data: number[] }[] } {
  const labels: string[] = [];
  const seen = new Set<string>();
  const groups = new Map<string, Map<string, DataSet>>();

  for (const row of data) {
    const x = String(row[xField] ?? "");
    if (x === "") continue;
    const c = String(row[colorField] ?? "");
    if (c === "") continue;

    if (!seen.has(x)) {
      seen.add(x);
      labels.push(x);
    }
    if (!groups.has(c)) groups.set(c, new Map());
    const m = groups.get(c)!;
    if (!m.has(x)) m.set(x, []);
    m.get(x)!.push(row);
  }

  const series = [...groups.entries()].map(([name, m]) => ({
    name,
    data: labels.map((x) => aggregateField(m.get(x) ?? [], yField, op, total)),
  }));
  return { labels, series };
}

/** Group raw rows into one {x, y} dataset per distinct color value (scatter). */
export function groupScatter(
  data: DataSet,
  xField: string,
  yField: string,
  colorField: string
): { name: string; points: { x: number; y: number }[] }[] {
  const groups = new Map<string, { x: number; y: number }[]>();
  for (const row of data) {
    const c = String(row[colorField] ?? "");
    if (c === "") continue;
    const x = Number(row[xField]);
    const y = Number(row[yField]);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push({ x, y });
  }
  return [...groups.entries()].map(([name, points]) => ({ name, points }));
}

/** Aggregate by color group: one number per distinct value, using `op`. */
export function aggregateByGroup(
  data: DataSet,
  yField: string | undefined,
  colorField: string,
  op: AggregationOp,
  total: number
): { labels: string[]; values: number[] } {
  const groups = new Map<string, DataSet>();
  for (const row of data) {
    const c = String(row[colorField] ?? "");
    if (c === "") continue;
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(row);
  }
  const labels = [...groups.keys()];
  const values = labels.map((k) => aggregateField(groups.get(k)!, yField, op, total));
  return { labels, values };
}

/**
 * Pyramid pivot: bucket raw rows per (category, side) so any aggregation op
 * can be applied. Validates exactly two distinct split values.
 */
export function aggregatePyramid(
  data: DataSet,
  yField: string,
  splitField: string,
  valueField: string | undefined,
  op: AggregationOp,
  total: number
): { categories: string[]; leftKey: string; rightKey: string; left: number[]; right: number[] } {
  const buckets = new Map<string, [DataSet, DataSet]>();
  let leftKey: string | null = null;
  let rightKey: string | null = null;
  const extras = new Set<string>();

  for (const row of data) {
    const cat = String(row[yField] ?? "");
    if (cat === "") continue;
    const split = String(row[splitField] ?? "");
    if (split === "") continue;

    if (leftKey === null) leftKey = split;
    else if (rightKey === null && split !== leftKey) rightKey = split;
    else if (split !== leftKey && split !== rightKey) extras.add(split);

    if (!buckets.has(cat)) buckets.set(cat, [[], []]);
    const pair = buckets.get(cat)!;
    if (split === leftKey) pair[0].push(row);
    else if (split === rightKey) pair[1].push(row);
  }

  if (leftKey === null || rightKey === null) {
    throw new Error(
      `Pyramid chart needs exactly 2 distinct values in "${splitField}", found ${leftKey === null ? 0 : 1}.`
    );
  }
  if (extras.size > 0) {
    throw new Error(
      `Pyramid chart needs exactly 2 distinct values in "${splitField}". Extra values found: ${[...extras].join(", ")}.`
    );
  }

  const categories = [...buckets.keys()];
  return {
    categories,
    leftKey,
    rightKey,
    left: categories.map((c) => aggregateField(buckets.get(c)![0], valueField, op, total)),
    right: categories.map((c) => aggregateField(buckets.get(c)![1], valueField, op, total)),
  };
}
