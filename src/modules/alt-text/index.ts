/**
 * Alt-text module — generates descriptive alt texts for charts
 * purely from the YAML spec and resolved data. Fully offline.
 *
 * If an explicit `alt` field is set in the spec, it is returned as-is.
 *
 * Usable independently in other projects.
 */
import type { ChartSpec, DataSet } from "../types";

/**
 * Generate an alt text string for a chart.
 *
 * @param spec - The chart YAML spec.
 * @param data - The resolved dataset (used to summarise key values).
 * @returns A plain-text alt string.
 */
export function generateAltText(spec: ChartSpec, data?: DataSet): string {
  // Explicit alt always wins.
  if (spec.alt) return spec.alt;

  return deriveAltTextFromSpec(spec, data);
}

// ── Spec-derived generation ─────────────────────────────────────────

function deriveAltTextFromSpec(spec: ChartSpec, data?: DataSet): string {
  if (spec.type === "pyramid") {
    return derivePyramidAltText(spec, data);
  }

  const chartLabel = chartTypeLabel(spec.type);
  const yFields = Array.isArray(spec.y) ? spec.y.join(", ") : spec.y;
  let text = `${chartLabel} showing ${yFields} by ${spec.x}`;
  if (spec.color) text += `, grouped by ${spec.color}`;

  if (spec.title) {
    text = `${spec.title}. ${text}`;
  }

  if (data && data.length > 0) {
    text += `. ${data.length} data points`;

    // Summarise range for the primary y-axis if numeric.
    const yKey = Array.isArray(spec.y) ? spec.y[0] : spec.y;
    const numericValues = data
      .map((row) => Number(row[yKey]))
      .filter((v) => !Number.isNaN(v));

    if (numericValues.length > 0) {
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      text += `, ranging from ${min} to ${max}`;

      // Describe overall trend if there are at least 2 points.
      if (numericValues.length >= 2) {
        const first = numericValues[0];
        const last = numericValues[numericValues.length - 1];
        if (last > first) {
          text += `, with an overall increasing trend`;
        } else if (last < first) {
          text += `, with an overall decreasing trend`;
        } else {
          text += `, remaining stable overall`;
        }
      }
    }
  }

  return text + ".";
}

function derivePyramidAltText(spec: ChartSpec, data?: DataSet): string {
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  let text = `Pyramid chart showing distribution of ${yField}`;
  if (spec.split) text += ` split by ${spec.split}`;

  if (spec.title) text = `${spec.title}. ${text}`;

  if (data && data.length > 0 && spec.split) {
    const counts = new Map<string, number>();
    for (const row of data) {
      const key = String(row[spec.split] ?? "");
      if (key === "") continue;
      const v = spec.value ? Number(row[spec.value] ?? 0) : 1;
      counts.set(key, (counts.get(key) ?? 0) + v);
    }
    const parts = [...counts.entries()].map(([k, v]) => `${k}: ${v.toLocaleString()}`);
    if (parts.length > 0) text += `. Totals — ${parts.join(", ")}`;
  }

  return text + ".";
}

function chartTypeLabel(type: ChartSpec["type"]): string {
  const labels: Record<ChartSpec["type"], string> = {
    bar: "Bar chart",
    line: "Line chart",
    pie: "Pie chart",
    doughnut: "Doughnut chart",
    scatter: "Scatter plot",
    pyramid: "Pyramid chart",
  };
  return labels[type] ?? "Chart";
}
