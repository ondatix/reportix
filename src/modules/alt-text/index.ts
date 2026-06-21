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
import { getLocale, type Locale } from "../i18n";

/**
 * Localized phrase tables. The alt-text module keeps its own strings (rather
 * than going through the shared `t()` dictionary) so it stays self-contained
 * and reusable, while still honouring the selected language.
 */
interface AltPhrases {
  chartTypes: Record<ChartSpec["type"], string>;
  /** Aggregation op → "comparing the …" phrase; `default` covers the rest. */
  comparing: Record<string, string>;
  by: string;
  groupedBy: string;
  splitBy: string;
  filteredTo: (field: string) => string;
  dataPoints: string;
  points: (n: number) => string;
}

const PHRASES: Record<Locale, AltPhrases> = {
  de: {
    chartTypes: {
      bar: "Balkendiagramm",
      line: "Liniendiagramm",
      pie: "Kreisdiagramm",
      doughnut: "Ringdiagramm",
      scatter: "Streudiagramm",
      pyramid: "Bevölkerungspyramide",
      distance: "Distanzdiagramm",
    },
    comparing: {
      identity: "zeigt",
      count: "vergleicht die Anzahl von",
      sum: "vergleicht die Summe von",
      mean: "vergleicht den Mittelwert von",
      median: "vergleicht den Median von",
      min: "vergleicht das Minimum von",
      max: "vergleicht das Maximum von",
      share_total: "vergleicht den Anteil (% des Gesamtwerts) von",
      share_group: "vergleicht den Anteil innerhalb der Gruppe von",
      share: "vergleicht den Anteil von",
      default: "zeigt",
    },
    by: "nach",
    groupedBy: "gruppiert nach",
    splitBy: "aufgeteilt nach",
    filteredTo: (field) => `(gefiltert auf ${field})`,
    dataPoints: "Datenpunkte",
    points: (n) => `${n} Punkte`,
  },
  en: {
    chartTypes: {
      bar: "Bar chart",
      line: "Line chart",
      pie: "Pie chart",
      doughnut: "Doughnut chart",
      scatter: "Scatter plot",
      pyramid: "Pyramid chart",
      distance: "Distance plot",
    },
    comparing: {
      identity: "showing",
      count: "comparing the count of",
      sum: "comparing the sum of",
      mean: "comparing the mean of",
      median: "comparing the median of",
      min: "comparing the minimum of",
      max: "comparing the maximum of",
      share_total: "comparing the share (% of total) of",
      share_group: "comparing the share within group of",
      share: "comparing the share of",
      default: "showing",
    },
    by: "by",
    groupedBy: "grouped by",
    splitBy: "split by",
    filteredTo: (field) => `(filtered to ${field})`,
    dataPoints: "Data points",
    points: (n) => `${n} points`,
  },
};

/**
 * Generate an alt text string for a chart.
 *
 * @param spec - The chart YAML spec.
 * @param data - The resolved dataset (used to enumerate aggregated points).
 * @param locale - Language for the generated text. Defaults to the active locale.
 * @returns A plain-text alt string.
 */
export function generateAltText(
  spec: ChartSpec,
  data?: DataSet,
  locale: Locale = getLocale()
): string {
  if (spec.alt) return spec.alt;
  const p = PHRASES[locale] ?? PHRASES.de;
  if (spec.type === "pyramid") return derivePyramidAltText(spec, data, p);
  return deriveAltTextFromSpec(spec, data, p);
}

// ── Spec-derived generation ─────────────────────────────────────────

function deriveAltTextFromSpec(spec: ChartSpec, data: DataSet | undefined, p: AltPhrases): string {
  const chartLabel = chartTypeLabel(spec.type, p);
  const yFields = Array.isArray(spec.y) ? spec.y.join(", ") : spec.y;
  const op = spec.aggregation?.y;

  const sentences: string[] = [];

  // Sentence 1 — what is shown.
  let s1 = `${chartLabel} ${comparingPhrase(op, p)} ${yFields}`;
  if (spec.x) s1 += ` ${p.by} ${spec.x}`;
  if (spec.color) s1 += `, ${p.groupedBy} ${spec.color}`;
  if (hasFilter(spec)) s1 += ` ${p.filteredTo(spec.filter!)}`;
  sentences.push(s1);

  // Sentence 2 — data point enumeration (only when data is available).
  if (data && data.length > 0) {
    const enumeration = enumeratePoints(spec, data, p);
    if (enumeration) sentences.push(`${p.dataPoints}: ${enumeration}`);
  }

  return assemble(spec, sentences);
}

function derivePyramidAltText(spec: ChartSpec, data: DataSet | undefined, p: AltPhrases): string {
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  const splitField = spec.split ?? spec.color;
  const op = spec.aggregation?.y;

  const sentences: string[] = [];

  let s1 = `${p.chartTypes.pyramid} ${comparingPhrase(op, p)} ${yField}`;
  if (splitField) s1 += ` ${p.splitBy} ${splitField}`;
  if (hasFilter(spec)) s1 += ` ${p.filteredTo(spec.filter!)}`;
  sentences.push(s1);

  if (data && data.length > 0) {
    const enumeration = enumeratePoints(spec, data, p);
    if (enumeration) sentences.push(`${p.dataPoints}: ${enumeration}`);
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

function comparingPhrase(op: AggregationOp | undefined, p: AltPhrases): string {
  return (op && p.comparing[op]) || p.comparing.default;
}

function chartTypeLabel(type: ChartSpec["type"], p: AltPhrases): string {
  return p.chartTypes[type] ?? p.chartTypes.bar;
}

// ── Data-point enumeration ─────────────────────────────────────────

/**
 * Compute the aggregated data points shown by the chart and render them
 * as a single readable string. Returns "" for chart types/configurations
 * where per-point enumeration would be impractical (e.g. unaggregated raw
 * rows, scatter with hundreds of points).
 */
function enumeratePoints(spec: ChartSpec, data: DataSet, p: AltPhrases): string {
  const filtered = applyFilter(data, spec.filter);
  if (filtered.length === 0) return "";

  try {
    if (spec.type === "pyramid") return enumeratePyramid(spec, filtered);
    if (spec.type === "pie" || spec.type === "doughnut") return enumeratePie(spec, filtered);
    if (spec.type === "scatter") return enumerateScatter(spec, filtered, p);
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

function enumerateScatter(_spec: ChartSpec, data: DataSet, p: AltPhrases): string {
  // Per-point enumeration is impractical for scatter; fall back to count.
  return p.points(data.length);
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
