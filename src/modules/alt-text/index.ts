/**
 * Alt-text module — generates descriptive alt texts for charts purely from
 * the YAML spec and (optionally) the resolved data. Fully offline.
 *
 * If an explicit `alt` field is set in the spec, it is returned verbatim.
 * Otherwise the auto-generated text covers four facets:
 *   1. Optional `altIntro` — an introductory sentence supplied by the
 *      template author, e.g. to describe the chart's role in the document.
 *   2. What is being measured (chart type, y-axis field, aggregation op).
 *   3. How it is broken down (x-axis, color grouping, filter).
 *   4. When data is provided, an explicit enumeration of every aggregated
 *      data point shown in the chart (per category, per series).
 *
 * Usable independently in other projects.
 */
import type { ChartSpec, DataSet } from "../types";
import {
  aggregateField,
  applyFilter,
  pivotByGroup,
  aggregateByGroup,
  aggregatePyramid,
  groupRowsBy,
  type AggregationOp,
} from "../aggregation";

/**
 * Generate an alt text string for a chart.
 *
 * @param spec - The chart YAML spec.
 * @param data - The resolved dataset (used to enumerate aggregated points).
 * @returns A plain-text alt string.
 */
export function generateAltText(spec: ChartSpec, data?: DataSet): string {
  if (spec.alt) return spec.alt;
  if (spec.type === "pyramid") return derivePyramidAltText(spec, data);
  return deriveAltTextFromSpec(spec, data);
}

// ── Spec-derived generation ─────────────────────────────────────────

function deriveAltTextFromSpec(spec: ChartSpec, data?: DataSet): string {
  const chartLabel = chartTypeLabel(spec.type);
  const yFields = Array.isArray(spec.y) ? spec.y.join(", ") : spec.y;
  const op = spec.aggregation?.y;

  const sentences: string[] = [];

  // Sentence 1 — what is shown.
  let s1 = `${chartLabel} ${comparingPhrase(op)} ${yFields}`;
  if (spec.x) s1 += ` by ${spec.x}`;
  if (spec.color) s1 += `, grouped by ${spec.color}`;
  if (hasFilter(spec)) s1 += ` (filtered to ${spec.filter})`;
  sentences.push(s1);

  // Sentence 2 — data point enumeration (only when data is available).
  if (data && data.length > 0) {
    const enumeration = enumeratePoints(spec, data);
    if (enumeration) sentences.push(`Data points: ${enumeration}`);
  }

  return assemble(spec, sentences);
}

function derivePyramidAltText(spec: ChartSpec, data?: DataSet): string {
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  const splitField = spec.split ?? spec.color;
  const op = spec.aggregation?.y;

  const sentences: string[] = [];

  let s1 = `Pyramid chart ${comparingPhrase(op)} ${yField}`;
  if (splitField) s1 += ` split by ${splitField}`;
  if (hasFilter(spec)) s1 += ` (filtered to ${spec.filter})`;
  sentences.push(s1);

  if (data && data.length > 0) {
    const enumeration = enumeratePoints(spec, data);
    if (enumeration) sentences.push(`Data points: ${enumeration}`);
  }

  return assemble(spec, sentences);
}

// ── Assembly helpers ───────────────────────────────────────────────

function assemble(spec: ChartSpec, sentences: string[]): string {
  let text = sentences.join(". ") + ".";
  if (spec.title) text = `${spec.title}. ${text}`;
  if (spec.altIntro) text = `${spec.altIntro} ${text}`;
  return text;
}

function hasFilter(spec: ChartSpec): boolean {
  return Boolean(spec.filter && spec.filter !== "Alle" && spec.filter !== "-");
}

function comparingPhrase(op?: AggregationOp): string {
  switch (op) {
    case "count": return "comparing the count of";
    case "sum": return "comparing the sum of";
    case "mean": return "comparing the mean of";
    case "median": return "comparing the median of";
    case "min": return "comparing the minimum of";
    case "max": return "comparing the maximum of";
    case "share_total": return "comparing the share (% of total) of";
    case "share_group": return "comparing the share within group of";
    default: return "showing";
  }
}

function chartTypeLabel(type: ChartSpec["type"]): string {
  const labels: Record<ChartSpec["type"], string> = {
    bar: "Bar chart",
    line: "Line chart",
    pie: "Pie chart",
    doughnut: "Doughnut chart",
    scatter: "Scatter plot",
    pyramid: "Pyramid chart",
    distance: "Distance plot",
  };
  return labels[type] ?? "Chart";
}

// ── Data-point enumeration ─────────────────────────────────────────

/**
 * Compute the aggregated data points shown by the chart and render them
 * as a single readable string. Returns "" for chart types/configurations
 * where per-point enumeration would be impractical (e.g. unaggregated raw
 * rows, scatter with hundreds of points).
 */
function enumeratePoints(spec: ChartSpec, data: DataSet): string {
  const filtered = applyFilter(data, spec.filter);
  if (filtered.length === 0) return "";

  try {
    if (spec.type === "pyramid") return enumeratePyramid(spec, filtered);
    if (spec.type === "pie" || spec.type === "doughnut") return enumeratePie(spec, filtered);
    if (spec.type === "scatter") return enumerateScatter(spec, filtered);
    if (spec.color) return enumerateGrouped(spec, filtered);
    return enumerateUngrouped(spec, filtered);
  } catch {
    // Pyramid validation can throw if the split field has != 2 values.
    // Don't break alt text — fall back to a summary count.
    return "";
  }
}

function enumeratePyramid(spec: ChartSpec, data: DataSet): string {
  const splitField = spec.split ?? spec.color;
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  if (!splitField || !yField) return "";
  const op: AggregationOp = spec.aggregation?.y ?? (spec.value ? "sum" : "count");

  const agg = aggregatePyramid(data, yField, splitField, spec.value, op, data.length);
  const isShare = op === "share_total" || op === "share_group";
  return agg.categories
    .map(
      (cat, i) =>
        `${yField} ${cat}: ${agg.leftKey} ${fmt(agg.left[i], isShare)}, ${agg.rightKey} ${fmt(agg.right[i], isShare)}`
    )
    .join("; ");
}

function enumeratePie(spec: ChartSpec, data: DataSet): string {
  if (!spec.color) return "";
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  const op: AggregationOp = spec.aggregation?.y ?? "sum";
  const agg = aggregateByGroup(data, yField, spec.color, op, data.length);
  const isShare = op === "share_total" || op === "share_group";
  return agg.labels.map((label, i) => `${label}: ${fmt(agg.values[i], isShare)}`).join("; ");
}

function enumerateScatter(_spec: ChartSpec, data: DataSet): string {
  // Per-point enumeration is impractical for scatter; fall back to count.
  return `${data.length} points`;
}

function enumerateGrouped(spec: ChartSpec, data: DataSet): string {
  if (!spec.x || !spec.color) return "";
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  if (!yField) return "";
  const op: AggregationOp = spec.aggregation?.y ?? "sum";

  const pivot = pivotByGroup(data, spec.x, yField, spec.color, op, data.length);
  const isShare = op === "share_total" || op === "share_group";
  const parts: string[] = [];
  for (let i = 0; i < pivot.labels.length; i++) {
    for (const s of pivot.series) {
      parts.push(`${spec.x} ${pivot.labels[i]}, ${s.name}: ${fmt(s.data[i], isShare)}`);
    }
  }
  return parts.join("; ");
}

function enumerateUngrouped(spec: ChartSpec, data: DataSet): string {
  const op = spec.aggregation?.y;
  // Without aggregation rows ARE the data points — too many to enumerate.
  if (!op || op === "identity") return "";
  if (!spec.x) return "";
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  if (!yField) return "";

  const groups = groupRowsBy(data, spec.x);
  const isShare = op === "share_total" || op === "share_group";
  return [...groups.entries()]
    .map(
      ([label, rows]) =>
        `${spec.x} ${label}: ${fmt(aggregateField(rows, yField, op, data.length), isShare)}`
    )
    .join("; ");
}

/** Format a numeric data point. Shares get a percent sign; whole numbers
 *  print without decimals; everything else gets two decimal places. */
function fmt(n: number, isShare: boolean): string {
  if (isShare) return `${n.toFixed(1)}%`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}
