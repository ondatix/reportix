/**
 * Aggregation module — named aggregation operations applied to row sets,
 * plus the shared "wrangle" step (filter → groupby → aggregate crosstab)
 * consumed by the table renderer, the chart renderer, and the alt-text
 * module. Self-contained and reusable.
 */
import type { DataSet } from "../types";
import { t } from "../i18n";

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

// ── Wrangle ─────────────────────────────────────────────────────────
// The shared "wrangled table" step: filter → group by rows (× cols) →
// aggregate. Computed once per block and consumed by the table renderer,
// the chart renderer, and the alt-text module, so all three present the
// exact same numbers (and the same data-protection flags).

/** The data-shaping subset of a table spec (structurally satisfied by `TableSpec`). */
export interface WrangleSpec {
  /** Boolean column whose truthy rows are kept before aggregation. */
  filter?: string;
  /** Crosstab axes: `rows` labels the table rows, optional `cols` the columns. */
  groupby: { rows: string; cols?: string };
  /** Single aggregation op applied per cell. */
  aggregation: AggregationOp;
  /** Column the op aggregates (required by sum/mean/min/max/median/share_group). */
  value?: string;
}

export interface WrangledCell {
  /** Raw aggregated value — never clamped/masked here; consumers decide presentation. */
  value: number;
  /** Number of source rows in the cell's bucket. */
  n: number;
  /** True when data protection applies (count-like op, 0 < |value| < threshold). */
  protected: boolean;
}

export interface WrangledTable {
  /** The `groupby.rows` column name (crosstab corner header). */
  rowHeader: string;
  /** Distinct row labels, first-seen order. */
  rows: string[];
  /** The `groupby.cols` column name, if a column axis was requested. */
  colHeader?: string;
  /** Distinct column labels (first-seen order) — `[valueLabel]` when `cols` is omitted. */
  cols: string[];
  /** Header for the synthetic single column (localized op name, or the value column). */
  valueLabel: string;
  /** cells[rowIdx][colIdx]. */
  cells: WrangledCell[][];
  aggregation: AggregationOp;
  /** Formatting hint: values are percentages (share ops). */
  isShare: boolean;
  /** The data-protection threshold used, echoed for display masking ("<5"). */
  threshold: number;
}

/**
 * Build the wrangled crosstab for a spec: apply the row filter, bucket rows
 * by `groupby.rows` (and `groupby.cols` when present, both in first-seen
 * order, skipping empty keys), then aggregate each bucket with the spec's
 * op. Cells keep the raw value plus a `protected` flag; clamping (charts)
 * and masking (tables, alt text) are the consumers' concern.
 */
export function wrangleTable(spec: WrangleSpec, data: DataSet, threshold = 0): WrangledTable {
  const op = spec.aggregation;
  const filtered = applyFilter(data, spec.filter);
  const total = filtered.length;

  const rowField = spec.groupby.rows;
  const colField = spec.groupby.cols;

  const rows: string[] = [];
  const cols: string[] = [];
  // buckets[rowLabel][colLabel] — colLabel is "" for the synthetic single column.
  const buckets = new Map<string, Map<string, DataSet>>();

  for (const row of filtered) {
    const r = String(row[rowField] ?? "");
    if (r === "") continue;
    let c = "";
    if (colField) {
      c = String(row[colField] ?? "");
      if (c === "") continue;
      if (!cols.includes(c)) cols.push(c);
    }
    if (!buckets.has(r)) {
      rows.push(r);
      buckets.set(r, new Map());
    }
    const byCol = buckets.get(r)!;
    if (!byCol.has(c)) byCol.set(c, []);
    byCol.get(c)!.push(row);
  }

  const valueLabel = spec.value ?? t(`agg.valueLabel.${op}`);
  const colLabels = colField ? cols : [valueLabel];
  const colKeys = colField ? cols : [""];

  const cells = rows.map((r) =>
    colKeys.map((c): WrangledCell => {
      const bucket = buckets.get(r)!.get(c) ?? [];
      const value = aggregateField(bucket, spec.value, op, total);
      const abs = Math.abs(value);
      return {
        value,
        n: bucket.length,
        protected: shouldProtect(op) && threshold > 0 && abs > 0 && abs < threshold,
      };
    })
  );

  return {
    rowHeader: rowField,
    rows,
    colHeader: colField,
    cols: colLabels,
    valueLabel,
    cells,
    aggregation: op,
    isShare: isShareOp(op),
    threshold,
  };
}

