/**
 * Aggregation module — named aggregation operations applied to row sets,
 * plus the shared "wrangle" step (filter → groupby → aggregate crosstab)
 * consumed by the table renderer, the chart renderer, and the alt-text
 * module. Self-contained and reusable.
 */
import type { DataSet } from "../types";
import { t, getLocale } from "../i18n";

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
/**
 * Does this op's displayed number *is* the group size? Only then may a masked
 * cell be shown as `<threshold`: for a mean or a sum, that label would be a
 * factual lie (a suppressed mean of 4200 € is not "< 5"), so those render a
 * neutral placeholder instead. See `wrangleTable` for the masking criterion.
 */
export function showsGroupCount(op: AggregationOp): boolean {
  return op === "count";
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
  if (!isFilterActive(field)) return data;
  // If the named field doesn't exist on any row, leave the data unchanged
  // (keeps templates resilient to filter typos / data-driven configs) — the
  // no-op is reported separately by `checkFilterColumns` in the validation
  // module, so a filter typo doesn't quietly widen the Personenkreis.
  if (data.length > 0 && filterColumnMissing(data, field)) return data;
  return data.filter((row) => coerceBoolean(row[field!]));
}

/** True when `field` names a real filter — `Alle`, `-`, empty and undefined disable filtering. */
export function isFilterActive(field?: string): field is string {
  return !!field && field !== "Alle" && field !== "-";
}

/**
 * True when an active filter names a column no row carries. Scans every row,
 * not just the first: sheets are sparse (empty cells are omitted), so the
 * first row alone is not evidence that a column is absent.
 */
export function filterColumnMissing(data: DataSet, field?: string): boolean {
  if (!isFilterActive(field)) return false;
  return !data.some((row) => field in row);
}

// ── Wrangle ─────────────────────────────────────────────────────────
// The shared "wrangled table" step: filter → group by rows (× cols) →
// aggregate. Computed once per block and consumed by the table renderer,
// the chart renderer, and the alt-text module, so all three present the
// exact same numbers (and the same data-protection flags).

/** Separator joining the parts of a composite row label / row header. */
export const COMPOSITE_KEY_SEPARATOR = " · ";

/** The data-shaping subset of a table spec (structurally satisfied by `TableSpec`). */
export interface WrangleSpec {
  /** Boolean column whose truthy rows are kept before aggregation. */
  filter?: string;
  /** Crosstab axes: `rows` labels the table rows, optional `cols` the columns.
   *  `rows` may be a single column name or a list of them — a list buckets by
   *  the tuple of values, joined with `COMPOSITE_KEY_SEPARATOR` for the label.
   *  Omitting `rows` collapses every row into a single synthetic total row. */
  groupby: { rows?: string | string[]; cols?: string };
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
  /** The `groupby.rows` column name (crosstab corner header); `""` when `rows`
   *  was omitted, or the parts joined with `COMPOSITE_KEY_SEPARATOR` for a list. */
  rowHeader: string;
  /** Distinct row labels, sorted naturally by default ("E8" before "E10"), or per a configured
   *  `category_order` for single-column `groupby.rows` (composite labels are
   *  the tuple parts joined with `COMPOSITE_KEY_SEPARATOR`, always natural order).
   *  A single localized "Total" label when `rows` was omitted. */
  rows: string[];
  /** The `groupby.cols` column name, if a column axis was requested. */
  colHeader?: string;
  /** Distinct column labels — first-seen order by default, or per a configured
   *  `category_order` for this column — `[valueLabel]` when `cols` is omitted. */
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
 * Natural (alphanumeric) label order: text compares by locale, embedded
 * numbers by value — so "E8" < "E9" < "E10" rather than "E10" < "E8".
 */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, getLocale(), { numeric: true });
}

/**
 * Order `values` in place: entries found in `order` (matched NFC + trimmed)
 * come first, in `order`'s sequence; anything not listed follows in natural
 * order (see `naturalCompare`). Used to apply a `data_parameters.category_order`
 * override for a specific column, falling back to the default natural
 * (rows) / first-seen (cols) order for values the config doesn't mention.
 */
function applyCategoryOrder(values: string[], order: string[]): void {
  const normalize = (s: string) => s.normalize("NFC").trim();
  const rank = new Map(order.map((v, i) => [normalize(v), i]));
  values.sort((a, b) => {
    const ra = rank.get(normalize(a));
    const rb = rank.get(normalize(b));
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return naturalCompare(a, b);
  });
}

/**
 * Build the wrangled crosstab for a spec: apply the row filter, bucket rows
 * by `groupby.rows` (skipping empty keys) and `groupby.cols` when present
 * (first-seen order), then aggregate each bucket with the spec's op. Row
 * labels (the category axis) are sorted naturally by default (text alphabetically, numbers by value). Cells
 * keep the raw value plus a `protected` flag; clamping (charts) and masking
 * (tables, alt text) are the consumers' concern. Omitting `groupby.rows`
 * puts every row in a single bucket labelled with the localized "Total"
 * term, producing a one-row crosstab.
 *
 * `categoryOrder` (from `data_parameters.category_order`) overrides the
 * default order for a named column's values — on the column axis always,
 * and on the row axis when `groupby.rows` is a single column (a composite
 * row tuple keeps the default natural order).
 */
export function wrangleTable(
  spec: WrangleSpec,
  data: DataSet,
  threshold = 0,
  categoryOrder?: Record<string, string[]>
): WrangledTable {
  const op = spec.aggregation;
  const filtered = applyFilter(data, spec.filter);
  const total = filtered.length;

  // `groupby.rows` may be a single column or a list; normalize to an array.
  const rowFields = spec.groupby.rows
    ? Array.isArray(spec.groupby.rows)
      ? spec.groupby.rows
      : [spec.groupby.rows]
    : [];
  const colField = spec.groupby.cols;
  // Omitting `groupby.rows` collapses every row into one synthetic "total" bucket.
  const totalLabel = t("agg.rowLabel.total");

  const rows: string[] = [];
  const cols: string[] = [];
  // buckets[rowLabel][colLabel] — colLabel is "" for the synthetic single column.
  const buckets = new Map<string, Map<string, DataSet>>();

  for (const row of filtered) {
    let r: string;
    if (rowFields.length > 0) {
      const parts = rowFields.map((f) => String(row[f] ?? ""));
      // Skip incomplete tuples (any missing component), matching the
      // single-column "empty key is skipped" rule.
      if (parts.some((p) => p === "")) continue;
      r = parts.join(COMPOSITE_KEY_SEPARATOR);
    } else {
      r = totalLabel;
    }
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

  // Categories (the row/category axis) sort naturally by default — text
  // alphabetically, embedded numbers by value ("E8" < "E10") — so
  // chart category axes and table rows have a stable, predictable order
  // independent of first-appearance in the source data — unless a fixed
  // order was configured for this column (composite/tuple rows always keep
  // the default, since a per-tuple order isn't well-defined).
  const rowOrder = rowFields.length === 1 ? categoryOrder?.[rowFields[0]] : undefined;
  if (rowOrder) {
    applyCategoryOrder(rows, rowOrder);
  } else {
    rows.sort(naturalCompare);
  }

  const colOrder = colField ? categoryOrder?.[colField] : undefined;
  if (colOrder) applyCategoryOrder(cols, colOrder);

  const valueLabel = spec.value ?? t(`agg.valueLabel.${op}`);
  const colLabels = colField ? cols : [valueLabel];
  const colKeys = colField ? cols : [""];

  const cells = rows.map((r) =>
    colKeys.map((c): WrangledCell => {
      const bucket = buckets.get(r)!.get(c) ?? [];
      const value = aggregateField(bucket, spec.value, op, total);
      return {
        value,
        n: bucket.length,
        // Masked on the **group size**, not on the value. What identifies a
        // person is how few rows stand behind a number; the value only proxies
        // for that in `count` (where n === value, so this is unchanged). For a
        // mean the value is unrelated to group size — thresholding it used to
        // mask a Beurteilung average of 3.2 as "<5" while leaving a 4200 €
        // average over two people fully exposed.
        protected: threshold > 0 && bucket.length > 0 && bucket.length < threshold,
      };
    })
  );

  return {
    rowHeader: rowFields.join(COMPOSITE_KEY_SEPARATOR),
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

