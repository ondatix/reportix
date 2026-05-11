/**
 * Alt-text module — generates descriptive alt texts for charts
 * purely from the YAML spec and resolved data. Fully offline.
 *
 * If an explicit `alt` field is set in the spec, it is returned as-is.
 *
 * The auto-generated prose covers four facets:
 *   1. What is being measured (the y-axis field)
 *   2. How it is broken down (x-axis, color grouping)
 *   3. Which subset of rows is included (filter / "Personenkreis")
 *   4. How values are combined (aggregation op) plus a data summary
 *      (point count, min/max range, overall trend)
 *
 * Inspired by the R `generate_text` helper, but adds the data-summary
 * facets so screen-reader users get both the question and the answer.
 *
 * Usable independently in other projects.
 */
import type { ChartSpec, DataSet } from "../types";
import type { AggregationOp } from "../aggregation";

/**
 * Generate an alt text string for a chart.
 *
 * @param spec - The chart YAML spec.
 * @param data - The resolved dataset (used to summarise key values).
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
  if (spec.filter && spec.filter !== "Alle" && spec.filter !== "-") {
    s1 += ` (filtered to ${spec.filter})`;
  }
  sentences.push(s1);

  // Sentence 2 — data summary.
  if (data && data.length > 0) {
    let s2 = `${data.length} data points`;
    const yKey = Array.isArray(spec.y) ? spec.y[0] : spec.y;
    const numericValues = data
      .map((row) => Number(row[yKey]))
      .filter((v) => !Number.isNaN(v));

    if (numericValues.length > 0) {
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      s2 += `, ranging from ${min.toLocaleString()} to ${max.toLocaleString()}`;
      if (numericValues.length >= 2) {
        const first = numericValues[0];
        const last = numericValues[numericValues.length - 1];
        if (last > first) s2 += `, with an overall increasing trend`;
        else if (last < first) s2 += `, with an overall decreasing trend`;
        else s2 += `, remaining stable overall`;
      }
    }
    sentences.push(s2);
  }

  let text = sentences.join(". ") + ".";
  if (spec.title) text = `${spec.title}. ${text}`;
  return text;
}

function derivePyramidAltText(spec: ChartSpec, data?: DataSet): string {
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  const splitField = spec.split ?? spec.color;
  const op = spec.aggregation?.y;

  let text = `Pyramid chart ${comparingPhrase(op)} ${yField}`;
  if (splitField) text += ` split by ${splitField}`;
  if (spec.filter && spec.filter !== "Alle" && spec.filter !== "-") {
    text += ` (filtered to ${spec.filter})`;
  }

  if (data && data.length > 0 && splitField) {
    const counts = new Map<string, number>();
    for (const row of data) {
      const key = String(row[splitField] ?? "");
      if (key === "") continue;
      const v = spec.value ? Number(row[spec.value] ?? 0) : 1;
      counts.set(key, (counts.get(key) ?? 0) + v);
    }
    const parts = [...counts.entries()].map(([k, v]) => `${k}: ${v.toLocaleString()}`);
    if (parts.length > 0) text += `. Totals — ${parts.join(", ")}`;
  }

  text = text + ".";
  if (spec.title) text = `${spec.title}. ${text}`;
  return text;
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
