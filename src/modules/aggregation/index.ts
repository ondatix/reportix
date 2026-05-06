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
  | "median";

export const AGGREGATION_OPS: AggregationOp[] = [
  "identity",
  "count",
  "sum",
  "mean",
  "min",
  "max",
  "median",
];

export function isAggregationOp(s: unknown): s is AggregationOp {
  return typeof s === "string" && (AGGREGATION_OPS as string[]).includes(s);
}

/**
 * Apply an aggregation to a group of rows for a given numeric field.
 * `count` returns the row count and ignores the field.
 * `identity` returns the first value found (useful as a "first-of-group"
 * passthrough, e.g. for displaying a group key in tables).
 * Non-numeric / missing values are skipped before numeric aggregations.
 */
export function aggregateField(
  rows: DataSet,
  field: string | undefined,
  op: AggregationOp
): number {
  if (op === "count") return rows.length;
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
