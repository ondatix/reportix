/**
 * Chart renderer — renders a ChartSpec into a <figure> with an accessible
 * Chart.js canvas, alt text, and optional caption.
 * Applies ChartDefaults from the bundled config for consistent styling.
 * Supports row filtering, grouping, aggregation, and a privacy threshold
 * (data protection) that suppresses small group values.
 * Usable independently in other projects.
 */
import { Chart, registerables } from "chart.js";
import type { ChartOptions, TooltipItem } from "chart.js";
import type { ChartSpec, DataSet, ChartDefaults, DataProtectionConfig } from "../types";
import { generateAltText } from "../alt-text";
import { getPalette } from "../palettes";
import {
  aggregateField,
  applyFilter,
  applyDataProtection,
  shouldProtect,
  groupRowsBy,
  pivotByGroup,
  groupScatter,
  aggregateByGroup,
  aggregatePyramid,
  type AggregationOp,
} from "../aggregation";

Chart.register(...registerables);

/** Per-Chart.js-dataset-index → set of data indices whose values were privacy-suppressed. */
type ProtectionMap = Map<number, Set<number>>;

export function renderChart(
  spec: ChartSpec,
  data: DataSet,
  container: HTMLElement,
  defaults?: ChartDefaults,
  palette?: string[],
  dataProtection?: DataProtectionConfig
): HTMLElement {
  const colors = palette ?? getPalette();
  const threshold = dataProtection?.smallestGroup ?? 0; // 0 = disabled
  const filtered = applyFilter(data, spec.filter);

  const figure = document.createElement("figure");

  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", generateAltText(spec, filtered));
  figure.appendChild(canvas);

  if (spec.caption || spec.title) {
    const figcaption = document.createElement("figcaption");
    figcaption.textContent = spec.caption ?? spec.title!;
    figure.appendChild(figcaption);
  }

  container.appendChild(figure);

  if (spec.type === "pyramid") {
    renderPyramid(canvas, spec, filtered, colors, defaults, threshold);
    return figure;
  }

  if (spec.type === "distance") {
    renderDistance(canvas, spec, filtered, colors, defaults, threshold);
    return figure;
  }

  if (spec.color) {
    renderGrouped(canvas, spec, filtered, colors, defaults, threshold);
    return figure;
  }

  if (!spec.x) {
    throw new Error(`Chart type "${spec.type}" requires an "x" field.`);
  }

  const yFields = Array.isArray(spec.y) ? spec.y : [spec.y];
  const yOp = spec.aggregation?.y;
  const total = filtered.length;
  const protectionMap: ProtectionMap = new Map();

  let labels: string[];
  let datasets: { label: string; data: number[]; backgroundColor: string; borderColor: string }[];
  if (yOp && yOp !== "identity") {
    // Implicit grouping by x.
    const groups = groupRowsBy(filtered, spec.x);
    labels = [...groups.keys()];
    datasets = yFields.map((yKey, i) => {
      const raw = labels.map((x) => aggregateField(groups.get(x)!, yKey, yOp, total));
      const protect = shouldProtect(yOp)
        ? applyDataProtection(raw, threshold)
        : { values: raw, protectedIdx: new Set<number>() };
      protectionMap.set(i, protect.protectedIdx);
      return {
        label: yKey,
        data: protect.values,
        backgroundColor: colors[i % colors.length],
        borderColor: colors[i % colors.length],
      };
    });
  } else {
    // No aggregation: rows ARE data points; data protection doesn't apply.
    labels = filtered.map((row) => String(row[spec.x!] ?? ""));
    datasets = yFields.map((yKey, i) => ({
      label: yKey,
      data: filtered.map((row) => Number(row[yKey] ?? 0)),
      backgroundColor: colors[i % colors.length],
      borderColor: colors[i % colors.length],
    }));
  }

  new Chart(canvas, {
    type: spec.type === "scatter" ? "scatter" : spec.type,
    data: { labels, datasets },
    options: buildOptions(spec, yFields, defaults, threshold, protectionMap),
  });

  return figure;
}

/**
 * Pyramid chart — horizontal stacked bar with two datasets that extend in
 * opposite directions from the y-axis. Aggregates raw rows by `spec.y` (the
 * category axis) split by `spec.split` or `spec.color` (a binary column).
 */
function renderPyramid(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  data: DataSet,
  colors: string[],
  defaults?: ChartDefaults,
  threshold: number = 0
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
  const agg = aggregatePyramid(data, yField, splitField, spec.value, op, data.length);

  const protect = shouldProtect(op);
  const left = protect
    ? applyDataProtection(agg.left, threshold)
    : { values: agg.left, protectedIdx: new Set<number>() };
  const right = protect
    ? applyDataProtection(agg.right, threshold)
    : { values: agg.right, protectedIdx: new Set<number>() };
  const protectionMap: ProtectionMap = new Map([
    [0, left.protectedIdx],
    [1, right.protectedIdx],
  ]);

  const maxAbs = Math.max(0, ...left.values, ...right.values);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: agg.categories,
      datasets: [
        {
          label: agg.leftKey,
          data: left.values.map((v) => -v),
          backgroundColor: colors[0],
          borderColor: colors[0],
        },
        {
          label: agg.rightKey,
          data: right.values,
          backgroundColor: colors[1 % colors.length],
          borderColor: colors[1 % colors.length],
        },
      ],
    },
    options: buildPyramidOptions(spec, maxAbs, defaults, threshold, protectionMap),
  });
}

/**
 * Distance plot — for each category on the y-axis, draws two markers
 * (one per `color` value, with distinct shapes) and a thin connecting
 * line between them. The line is coloured according to the winning
 * class (the group with the higher value at that category).
 *
 * Implemented as a mixed Chart.js chart: a floating bar dataset (thin)
 * provides the connecting line, and two line datasets with
 * `showLine: false` and custom `pointStyle` provide the markers.
 */
function renderDistance(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  data: DataSet,
  colors: string[],
  defaults?: ChartDefaults,
  threshold: number = 0
): void {
  if (!spec.color) {
    throw new Error('Distance chart requires a "color" field (the binary column to compare).');
  }
  if (!spec.x) {
    throw new Error('Distance chart requires an "x" field (the category axis).');
  }
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  if (!yField) {
    throw new Error('Distance chart requires a "y" field (the numeric value).');
  }

  const yOp: AggregationOp = spec.aggregation?.y ?? "count";
  const total = data.length;
  const pivot = pivotByGroup(data, spec.x, yField, spec.color, yOp, total);

  if (pivot.series.length !== 2) {
    throw new Error(
      `Distance chart needs exactly 2 distinct values in "${spec.color}", found ${pivot.series.length}.`
    );
  }

  const [seriesA, seriesB] = pivot.series;
  const labels = pivot.labels;
  const protect = shouldProtect(yOp);
  const protA = protect
    ? applyDataProtection(seriesA.data, threshold)
    : { values: seriesA.data, protectedIdx: new Set<number>() };
  const protB = protect
    ? applyDataProtection(seriesB.data, threshold)
    : { values: seriesB.data, protectedIdx: new Set<number>() };

  const colorA = colors[0];
  const colorB = colors[1 % colors.length];

  // Floating-bar "line": [min, max] per category, coloured by who's winning.
  const ranges = labels.map((_, i) => [
    Math.min(protA.values[i], protB.values[i]),
    Math.max(protA.values[i], protB.values[i]),
  ]);
  const winners = labels.map((_, i) =>
    protA.values[i] >= protB.values[i] ? colorA : colorB
  );

  // Chart.js dataset index → protected set, used by the tooltip callback.
  // 0 = bar (range, hidden), 1 = seriesA markers, 2 = seriesB markers.
  const protectionMap: ProtectionMap = new Map([
    [1, protA.protectedIdx],
    [2, protB.protectedIdx],
  ]);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "",
          data: ranges as unknown as number[],
          backgroundColor: winners,
          borderColor: winners,
          barThickness: 3,
        },
        {
          type: "line",
          label: seriesA.name,
          data: protA.values,
          showLine: false,
          pointRadius: 7,
          pointHoverRadius: 8,
          pointStyle: "circle",
          backgroundColor: colorA,
          borderColor: colorA,
        },
        {
          type: "line",
          label: seriesB.name,
          data: protB.values,
          showLine: false,
          pointRadius: 7,
          pointHoverRadius: 8,
          pointStyle: "rect",
          backgroundColor: colorB,
          borderColor: colorB,
        },
      ],
    },
    options: buildDistanceOptions(spec, defaults, threshold, protectionMap),
  });
}

/**
 * Render a grouped chart (color-pivoted). Behaviour by chart type:
 *   - bar / line: long-form data → wide-form, aggregated per (x, group)
 *   - scatter:    one dataset of {x, y} points per group, no aggregation
 *   - pie / doughnut: one slice per group, value aggregated (count by default)
 */
function renderGrouped(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  data: DataSet,
  colors: string[],
  defaults?: ChartDefaults,
  threshold: number = 0
): void {
  const colorField = spec.color;
  const yField = Array.isArray(spec.y) ? spec.y[0] : spec.y;
  const yOp: AggregationOp = spec.aggregation?.y ?? "sum";
  const total = data.length;

  if (spec.type === "pie" || spec.type === "doughnut") {
    if (!colorField) throw new Error(`"${spec.type}" chart requires a "color" field.`);
    const agg = aggregateByGroup(data, yField, colorField, yOp, total);
    const protect = shouldProtect(yOp)
      ? applyDataProtection(agg.values, threshold)
      : { values: agg.values, protectedIdx: new Set<number>() };
    const protectionMap: ProtectionMap = new Map([[0, protect.protectedIdx]]);
    const slice = agg.labels.map((_, i) => colors[i % colors.length]);
    new Chart(canvas, {
      type: spec.type,
      data: {
        labels: agg.labels,
        datasets: [
          {
            label: yField || colorField,
            data: protect.values,
            backgroundColor: slice,
            borderColor: slice,
          },
        ],
      },
      options: buildOptions(spec, [yField || colorField], defaults, threshold, protectionMap),
    });
    return;
  }

  if (!spec.x) {
    throw new Error(`Chart type "${spec.type}" with grouping requires an "x" field.`);
  }
  if (!yField) {
    throw new Error(`Chart type "${spec.type}" with grouping requires a "y" field.`);
  }

  if (spec.type === "scatter") {
    if (!colorField) throw new Error(`Grouped scatter requires a "color" field.`);
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
      options: buildOptions(spec, [yField], defaults, threshold, new Map()),
    });
    return;
  }

  // bar / line — pivot long-form rows to wide-form.
  const pivot = pivotByGroup(data, spec.x, yField, colorField!, yOp, total);
  const protectionMap: ProtectionMap = new Map();
  const protectGroup = shouldProtect(yOp);
  const datasets = pivot.series.map((s, i) => {
    const protect = protectGroup
      ? applyDataProtection(s.data, threshold)
      : { values: s.data, protectedIdx: new Set<number>() };
    protectionMap.set(i, protect.protectedIdx);
    return {
      label: s.name,
      data: protect.values,
      backgroundColor: colors[i % colors.length],
      borderColor: colors[i % colors.length],
    };
  });

  new Chart(canvas, {
    type: spec.type as "bar" | "line",
    data: { labels: pivot.labels, datasets },
    options: buildOptions(spec, [yField], defaults, threshold, protectionMap),
  });
}

// ── Tooltip helpers ──────────────────────────────────────────────────

/** Build a tooltip label callback that masks privacy-suppressed values as `<{threshold}`. */
function tooltipLabel(threshold: number, protection: ProtectionMap, abs = false) {
  return (ctx: TooltipItem<"bar" | "line" | "pie" | "doughnut" | "scatter">) => {
    const set = protection.get(ctx.datasetIndex);
    const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : "";
    if (set?.has(ctx.dataIndex)) return `${label}<${threshold}`;
    const raw = (ctx.parsed as { x?: number; y?: number }).y ?? (ctx.parsed as { x?: number }).x ?? ctx.parsed;
    const num = Number(raw);
    const display = abs ? Math.abs(num) : num;
    return `${label}${display.toLocaleString()}`;
  };
}

// ── Pyramid options ─────────────────────────────────────────────────

function buildPyramidOptions(
  spec: ChartSpec,
  maxAbs: number,
  d?: ChartDefaults,
  threshold: number = 0,
  protection: ProtectionMap = new Map()
): ChartOptions {
  const fontColor = d?.font?.color ? `#${d.font.color}` : undefined;
  const fontSpec = d?.font ? { family: d.font.family, size: d.font.size } : undefined;

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
        callbacks: { label: tooltipLabel(threshold, protection, true) },
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

// ── Distance plot options ──────────────────────────────────────────

function buildDistanceOptions(
  spec: ChartSpec,
  d?: ChartDefaults,
  threshold: number = 0,
  protection: ProtectionMap = new Map()
): ChartOptions {
  const fontColor = d?.font?.color ? `#${d.font.color}` : undefined;
  const fontSpec = d?.font ? { family: d.font.family, size: d.font.size } : undefined;

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
        labels: {
          color: fontColor,
          font: fontSpec,
          // Hide the unlabelled connecting-bar dataset.
          filter: (item) => item.text !== "",
          usePointStyle: true,
        },
      },

      tooltip: {
        enabled: d?.tooltip?.enabled ?? true,
        // Suppress the floating-bar dataset (datasetIndex 0); the two
        // marker datasets carry the information instead.
        filter: (ctx) => ctx.datasetIndex !== 0,
        callbacks: { label: tooltipLabel(threshold, protection) },
      },
    },

    scales: {
      x: {
        ticks: {
          color: d?.scales?.x?.tickColor ? `#${d.scales.x.tickColor}` : fontColor,
          font: fontSpec,
        },
        grid: {
          display: d?.scales?.x?.gridDisplay ?? true,
          color: d?.scales?.x?.gridColor ?? "rgba(0,0,0,0.08)",
        },
      },
      y: {
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
  };
}

// ── Standard options ────────────────────────────────────────────────

function buildOptions(
  spec: ChartSpec,
  yFields: string[],
  d?: ChartDefaults,
  threshold: number = 0,
  protection: ProtectionMap = new Map()
): ChartOptions {
  const fontColor = d?.font?.color ? `#${d.font.color}` : undefined;
  const fontSpec = d?.font ? { family: d.font.family, size: d.font.size } : undefined;

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
        callbacks: { label: tooltipLabel(threshold, protection) },
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
