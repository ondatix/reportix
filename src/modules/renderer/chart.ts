/**
 * Chart renderer — renders a ChartSpec into a <figure> with an accessible
 * Chart.js canvas, alt text, and optional caption.
 * Applies ChartDefaults from the bundled config for consistent styling.
 * Usable independently in other projects.
 */
import { Chart, registerables } from "chart.js";
import type { ChartOptions } from "chart.js";
import type { ChartSpec, DataSet, ChartDefaults } from "../types";
import { generateAltText } from "../alt-text";
import { getPalette } from "../palettes";
import { aggregateField, type AggregationOp } from "../aggregation";

Chart.register(...registerables);

export function renderChart(
  spec: ChartSpec,
  data: DataSet,
  container: HTMLElement,
  defaults?: ChartDefaults,
  palette?: string[]
): HTMLElement {
  const colors = palette ?? getPalette();
  const figure = document.createElement("figure");

  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");

  const altText = generateAltText(spec, data);
  canvas.setAttribute("aria-label", altText);

  figure.appendChild(canvas);

  if (spec.caption || spec.title) {
    const figcaption = document.createElement("figcaption");
    figcaption.textContent = spec.caption ?? spec.title!;
    figure.appendChild(figcaption);
  }

  container.appendChild(figure);

  if (spec.type === "pyramid") {
    renderPyramid(canvas, spec, data, colors, defaults);
    return figure;
  }

  if (spec.color) {
    renderGrouped(canvas, spec, data, colors, defaults);
    return figure;
  }

  if (!spec.x) {
    throw new Error(`Chart type "${spec.type}" requires an "x" field.`);
  }

  const yFields = Array.isArray(spec.y) ? spec.y : [spec.y];
  const yOp = spec.aggregation?.y;

  // If aggregation.y is set (non-identity), implicitly group by x.
  // Otherwise treat each row as a data point (existing behaviour).
  let labels: string[];
  let datasets: { label: string; data: number[]; backgroundColor: string; borderColor: string }[];
  if (yOp && yOp !== "identity") {
    const groups = groupRowsBy(data, spec.x);
    labels = [...groups.keys()];
    datasets = yFields.map((yKey, i) => ({
      label: yKey,
      data: labels.map((x) => aggregateField(groups.get(x)!, yKey, yOp)),
      backgroundColor: colors[i % colors.length],
      borderColor: colors[i % colors.length],
    }));
  } else {
    labels = data.map((row) => String(row[spec.x!] ?? ""));
    datasets = yFields.map((yKey, i) => ({
      label: yKey,
      data: data.map((row) => Number(row[yKey] ?? 0)),
      backgroundColor: colors[i % colors.length],
      borderColor: colors[i % colors.length],
    }));
  }

  new Chart(canvas, {
    type: spec.type === "scatter" ? "scatter" : spec.type,
    data: { labels, datasets },
    options: buildOptions(spec, yFields, defaults),
  });

  return figure;
}

/** Bucket rows by the string value of `field`, preserving first-seen order. */
function groupRowsBy(data: DataSet, field: string): Map<string, DataSet> {
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
 * Pyramid chart — horizontal stacked bar with two datasets that extend in
 * opposite directions from the y-axis. Aggregates raw rows by `spec.y` (the
 * category axis) split by `spec.split` or `spec.color` (a binary column).
 * Each cell's value is either the sum of `spec.value` or, if omitted, the
 * row count.
 */
function renderPyramid(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  data: DataSet,
  colors: string[],
  defaults?: ChartDefaults
): void {
  const splitField = spec.split ?? spec.color;
  if (!splitField) {
    throw new Error('Pyramid chart requires a "color" (or "split") field — the binary column to split on.');
  }
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  if (!yField) {
    throw new Error('Pyramid chart requires a "y" field (the category axis).');
  }

  const op: AggregationOp = spec.aggregation?.y ?? (spec.value ? "sum" : "count");
  const agg = aggregatePyramid(data, yField, splitField, spec.value, op);
  const maxAbs = Math.max(0, ...agg.left, ...agg.right);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: agg.categories,
      datasets: [
        {
          label: agg.leftKey,
          data: agg.left.map((v) => -v),
          backgroundColor: colors[0],
          borderColor: colors[0],
        },
        {
          label: agg.rightKey,
          data: agg.right,
          backgroundColor: colors[1 % colors.length],
          borderColor: colors[1 % colors.length],
        },
      ],
    },
    options: buildPyramidOptions(spec, maxAbs, defaults),
  });
}

/**
 * Render a chart whose rows are pivoted into one series per distinct value
 * of `spec.color`. Each series gets a sequential palette colour. Behaviour
 * by chart type:
 *   - bar / line: long-form data → wide-form, aggregated (sum) per (x, group)
 *   - scatter:    one dataset of {x, y} points per group, no aggregation
 *   - pie / doughnut: one slice per group, value summed (or counted if no y)
 */
function renderGrouped(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  data: DataSet,
  colors: string[],
  defaults?: ChartDefaults
): void {
  const colorField = spec.color!;
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;

  const yOp: AggregationOp = spec.aggregation?.y ?? "sum";

  if (spec.type === "pie" || spec.type === "doughnut") {
    const agg = aggregateByGroup(data, yField, colorField, yOp);
    const slice = agg.labels.map((_, i) => colors[i % colors.length]);
    new Chart(canvas, {
      type: spec.type,
      data: {
        labels: agg.labels,
        datasets: [
          {
            label: yField || colorField,
            data: agg.values,
            backgroundColor: slice,
            borderColor: slice,
          },
        ],
      },
      options: buildOptions(spec, [yField || colorField], defaults),
    });
    return;
  }

  if (!spec.x) {
    throw new Error(`Chart type "${spec.type}" with "color" grouping requires an "x" field.`);
  }
  if (!yField) {
    throw new Error(`Chart type "${spec.type}" with "color" grouping requires a "y" field.`);
  }

  if (spec.type === "scatter") {
    const groups = groupScatter(data, spec.x, yField, colorField);
    const datasets = groups.map((g, i) => ({
      label: g.name,
      data: g.points,
      backgroundColor: colors[i % colors.length],
      borderColor: colors[i % colors.length],
    }));
    new Chart(canvas, {
      type: "scatter",
      data: { datasets },
      options: buildOptions(spec, [yField], defaults),
    });
    return;
  }

  // bar / line — pivot long-form rows to wide-form (one series per group).
  const pivot = pivotByGroup(data, spec.x, yField, colorField, yOp);
  const datasets = pivot.series.map((s, i) => ({
    label: s.name,
    data: s.data,
    backgroundColor: colors[i % colors.length],
    borderColor: colors[i % colors.length],
  }));
  new Chart(canvas, {
    type: spec.type as "bar" | "line",
    data: { labels: pivot.labels, datasets },
    options: buildOptions(spec, [yField], defaults),
  });
}

/** Pivot long-form rows to wide-form: labels = unique x values (insertion order),
 *  one series per distinct color value, y aggregated per (x, group) using `op`. */
function pivotByGroup(
  data: DataSet,
  xField: string,
  yField: string,
  colorField: string,
  op: AggregationOp
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
    data: labels.map((x) => aggregateField(m.get(x) ?? [], yField, op)),
  }));
  return { labels, series };
}

/** Group raw rows into one {x, y} dataset per distinct color value. */
function groupScatter(
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
function aggregateByGroup(
  data: DataSet,
  yField: string | undefined,
  colorField: string,
  op: AggregationOp
): { labels: string[]; values: number[] } {
  const groups = new Map<string, DataSet>();
  for (const row of data) {
    const c = String(row[colorField] ?? "");
    if (c === "") continue;
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(row);
  }
  const labels = [...groups.keys()];
  const values = labels.map((k) => aggregateField(groups.get(k)!, yField, op));
  return { labels, values };
}

function aggregatePyramid(
  data: DataSet,
  yField: string,
  splitField: string,
  valueField: string | undefined,
  op: AggregationOp
): { categories: string[]; leftKey: string; rightKey: string; left: number[]; right: number[] } {
  // Bucket raw rows per (category, side) so any aggregation op can be applied.
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
    left: categories.map((c) => aggregateField(buckets.get(c)![0], valueField, op)),
    right: categories.map((c) => aggregateField(buckets.get(c)![1], valueField, op)),
  };
}

function buildPyramidOptions(
  spec: ChartSpec,
  maxAbs: number,
  d?: ChartDefaults
): ChartOptions {
  const fontColor = d?.font?.color ? `#${d.font.color}` : undefined;
  const fontSpec = d?.font
    ? { family: d.font.family, size: d.font.size }
    : undefined;

  return {
    indexAxis: "y",
    animation: d?.animation === false ? false : undefined,
    aspectRatio: d?.aspectRatio ?? 2,
    responsive: true,
    maintainAspectRatio: true,

    plugins: {
      title: spec.title
        ? {
            display: true,
            text: spec.title,
            position: (d?.title?.position ?? "top") as "top" | "bottom" | "left" | "right",
            align: (d?.title?.align ?? "center") as "start" | "center" | "end",
            color: d?.title?.color ? `#${d.title.color}` : fontColor,
            font: fontSpec,
          }
        : { display: false },

      legend: {
        display: d?.legend?.display ?? true,
        position: (d?.legend?.position ?? "top") as "top" | "bottom" | "left" | "right",
        align: (d?.legend?.align ?? "center") as "start" | "center" | "end",
        labels: { color: fontColor, font: fontSpec },
      },

      tooltip: {
        enabled: d?.tooltip?.enabled ?? true,
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${Math.abs(Number(ctx.parsed.x)).toLocaleString()}`,
        },
      },
    },

    scales: {
      x: {
        stacked: true,
        suggestedMin: -maxAbs,
        suggestedMax: maxAbs,
        ticks: {
          color: d?.scales?.x?.tickColor ? `#${d.scales.x.tickColor}` : fontColor,
          font: fontSpec,
          callback: (val) => Math.abs(Number(val)).toLocaleString(),
        },
        grid: {
          display: d?.scales?.x?.gridDisplay ?? true,
          color: d?.scales?.x?.gridColor ?? "rgba(0,0,0,0.08)",
        },
      },
      y: {
        stacked: true,
        ticks: {
          color: d?.scales?.y?.tickColor ? `#${d.scales.y.tickColor}` : fontColor,
          font: fontSpec,
        },
        grid: {
          display: d?.scales?.y?.gridDisplay ?? true,
          color: d?.scales?.y?.gridColor ?? "rgba(0,0,0,0.08)",
        },
      },
    },

    elements: {
      bar: {
        borderRadius: d?.elements?.bar?.borderRadius ?? 0,
        borderWidth: 0,
      },
    },
  };
}

function buildOptions(
  spec: ChartSpec,
  yFields: string[],
  d?: ChartDefaults
): ChartOptions {
  const fontColor = d?.font?.color ? `#${d.font.color}` : undefined;
  const fontSpec = d?.font
    ? { family: d.font.family, size: d.font.size }
    : undefined;

  return {
    animation: d?.animation === false ? false : undefined,
    aspectRatio: d?.aspectRatio ?? 2,
    responsive: true,
    maintainAspectRatio: true,

    plugins: {
      title: spec.title
        ? {
            display: true,
            text: spec.title,
            position: (d?.title?.position ?? "top") as "top" | "bottom" | "left" | "right",
            align: (d?.title?.align ?? "center") as "start" | "center" | "end",
            color: d?.title?.color ? `#${d.title.color}` : fontColor,
            font: fontSpec,
          }
        : { display: false },

      legend: {
        display: d?.legend?.display ?? yFields.length > 1,
        position: (d?.legend?.position ?? "top") as "top" | "bottom" | "left" | "right",
        align: (d?.legend?.align ?? "center") as "start" | "center" | "end",
        labels: { color: fontColor, font: fontSpec },
      },

      tooltip: {
        enabled: d?.tooltip?.enabled ?? true,
      },
    },

    scales: {
      x: {
        stacked: spec.stacked === true,
        ticks: { color: d?.scales?.x?.tickColor ? `#${d.scales.x.tickColor}` : fontColor, font: fontSpec },
        grid: {
          display: d?.scales?.x?.gridDisplay ?? true,
          color: d?.scales?.x?.gridColor ?? "rgba(0,0,0,0.08)",
        },
      },
      y: {
        stacked: spec.stacked === true,
        beginAtZero: d?.scales?.y?.beginAtZero ?? true,
        ticks: { color: d?.scales?.y?.tickColor ? `#${d.scales.y.tickColor}` : fontColor, font: fontSpec },
        grid: {
          display: d?.scales?.y?.gridDisplay ?? true,
          color: d?.scales?.y?.gridColor ?? "rgba(0,0,0,0.08)",
        },
      },
    },

    elements: {
      line: {
        tension: d?.elements?.line?.tension ?? 0,
        borderWidth: 2,
      },
      point: {
        radius: d?.elements?.line?.pointRadius ?? 3,
      },
      bar: {
        borderRadius: d?.elements?.bar?.borderRadius ?? 0,
        borderWidth: 0,
      },
    },

    datasets: {
      bar: {
        barPercentage: d?.elements?.bar?.barPercentage ?? 0.9,
      },
    },
  };
}
