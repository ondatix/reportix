/**
 * Alt-text module — generates descriptive alt texts for charts purely from
 * the YAML spec and (optionally) the already-wrangled crosstab. Fully offline.
 *
 * If an explicit `alt` field is set in the spec, it is returned verbatim.
 * Otherwise the auto-generated text covers four facets:
 *   1. Optional `altIntro` — an introductory sentence supplied by the
 *      template author, e.g. to describe the chart's role in the document.
 *   2. What is being measured (chart type, aggregation op, value column).
 *   3. How it is broken down (groupby rows/cols, filter).
 *   4. When a wrangled table is provided, an explicit enumeration of every
 *      cell shown in the chart. Privacy-protected cells enumerate as
 *      `<threshold`, matching what tables and tooltips display.
 *
 * The enumeration consumes the same `WrangledTable` the renderers draw
 * from (see the aggregation module), so alt text can never disagree with
 * the visible chart. Usable independently in other projects.
 */
import type { ChartSpec } from "../types";
import type { AggregationOp, WrangledTable } from "../aggregation";
import { showsGroupCount } from "../aggregation";
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
  /** Shown in place of a value the data-protection threshold suppressed. Kept
   *  short: it can repeat once per cell in a single alt text. */
  suppressed: string;
  placeholder: string;
  /** Fallback "what is measured" term when neither `value` nor `groupby.rows` is set. */
  total: string;
  /** Prefix for one part of a chart split into several partial plots. */
  part: (index: number, count: number) => string;
}

const PHRASES: Record<Locale, AltPhrases> = {
  de: {
    chartTypes: {
      bar: "Balkendiagramm",
      line: "Liniendiagramm",
      pie: "Kreisdiagramm",
      doughnut: "Ringdiagramm",
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
    suppressed: "nicht ausgewiesen",
    placeholder: "[Hier sollte die Grafik/die Tabelle in 1-2 Sätzen interpretiert werden.]",
    total: "Gesamtzahl",
    part: (i, k) => `Teil ${i} von ${k}`,
  },
  en: {
    chartTypes: {
      bar: "Bar chart",
      line: "Line chart",
      pie: "Pie chart",
      doughnut: "Doughnut chart",
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
    suppressed: "not disclosed",
    placeholder: "[The chart/table should be interpreted here in 1-2 sentences.]",
    total: "the total",
    part: (i, k) => `Part ${i} of ${k}`,
  },
};

/**
 * Generate an alt text string for a chart.
 *
 * @param spec - The chart YAML spec (with its embedded `table:` sub-spec).
 * @param wrangled - The wrangled crosstab (used to enumerate the shown cells).
 * @param locale - Language for the generated text. Defaults to the active locale.
 * @returns A plain-text alt string.
 */
export function generateAltText(
  spec: ChartSpec,
  wrangled?: WrangledTable,
  locale: Locale = getLocale(),
  part?: { index: number; count: number }
): string {
  const p = PHRASES[locale] ?? PHRASES.de;
  // A chart split into partial plots gets one alt text per part (`wrangled`
  // is then that part's slice), each led by "Part i of k".
  const prefix = part && part.count > 1 ? `${p.part(part.index, part.count)}: ` : "";
  if (spec.alt) return `${prefix}${spec.alt} ${p.placeholder}`;
  const table = spec.table;

  const sentences: string[] = [];

  // Sentence 1 — what is shown: the measured field (the aggregated value
  // column, or the named breakdown axis for plain counts/shares — `rows` if
  // set, else `cols` when `rows` was omitted, else a generic "total" term),
  // broken down by the remaining groupby axis.
  const rowDimension = Array.isArray(table.groupby.rows)
    ? table.groupby.rows.join(" · ")
    : table.groupby.rows;
  const dimension = rowDimension ?? table.groupby.cols;
  const measured = table.value ?? dimension ?? p.total;
  let s1 = `${chartTypeLabel(spec.type, p)} ${comparingPhrase(table.aggregation, p)} ${measured}`;
  if (table.value && dimension) s1 += ` ${p.by} ${dimension}`;
  if (table.groupby.cols && rowDimension) {
    const phrase = spec.type === "pyramid" || spec.type === "distance" ? p.splitBy : p.groupedBy;
    s1 += `, ${phrase} ${table.groupby.cols}`;
  }
  if (hasFilter(spec)) s1 += ` ${p.filteredTo(table.filter!)}`;
  sentences.push(s1);

  // Sentence 2 — cell enumeration (only when the wrangled table is available).
  if (wrangled && wrangled.rows.length > 0) {
    sentences.push(`${p.dataPoints}: ${enumerateCells(wrangled, p)}`);
  }

  return prefix + assemble(spec, sentences, p);
}

// ── Assembly helpers ───────────────────────────────────────────────

function assemble(spec: ChartSpec, sentences: string[], p: AltPhrases): string {
  let text = sentences.join(". ") + ".";
  if (spec.title) text = `${spec.title}. ${text}`;
  if (spec.altIntro) text = `${spec.altIntro} ${text}`;
  return `${text} ${p.placeholder}`;
}

function hasFilter(spec: ChartSpec): boolean {
  const filter = spec.table.filter;
  return Boolean(filter && filter !== "Alle" && filter !== "-");
}

function comparingPhrase(op: AggregationOp | undefined, p: AltPhrases): string {
  return (op && p.comparing[op]) || p.comparing.default;
}

function chartTypeLabel(type: ChartSpec["type"], p: AltPhrases): string {
  return p.chartTypes[type] ?? p.chartTypes.bar;
}

// ── Cell enumeration ───────────────────────────────────────────────

/**
 * Enumerate every crosstab cell as a single readable string, e.g.
 * `QE 3, w: 12; QE 3, m: <5; …`. Values match the rendered chart/table:
 * a protected cell reads `<threshold` where the number is the group count,
 * and is spelled out as suppressed for every other op — a screen-reader
 * listener gets the same caveat a sighted reader gets from the placeholder.
 */
function enumerateCells(w: WrangledTable, p: AltPhrases): string {
  const parts: string[] = [];
  w.rows.forEach((rowLabel, i) => {
    w.cells[i].forEach((cell, j) => {
      const value = cell.protected
        ? showsGroupCount(w.aggregation)
          ? `<${w.threshold}`
          : p.suppressed
        : fmt(cell.value, w.isShare);
      const rowText = w.rowHeader ? `${w.rowHeader} ${rowLabel}` : rowLabel;
      const label = w.colHeader ? `${rowText}, ${w.cols[j]}` : rowText;
      parts.push(`${label}: ${value}`);
    });
  });
  return parts.join("; ");
}

/** Format a numeric data point. Shares get a percent sign; whole numbers
 *  print without decimals; everything else gets two decimal places. */
function fmt(n: number, isShare: boolean): string {
  if (isShare) return `${n.toFixed(1)}%`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}
