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
