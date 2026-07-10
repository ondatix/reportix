/**
 * Chart renderer — renders a ChartSpec into a <figure> with an accessible
 * Chart.js canvas, alt text, and optional caption.
 *
 * The data shaping is NOT done here: the spec's embedded `table:` is turned
 * into a shared `WrangledTable` (filter → groupby → aggregate, with per-cell
 * data-protection flags) by the aggregation module, and this renderer only
 * maps that crosstab onto Chart.js datasets — rows become the category axis,
 * cols become the series. Protected cells are clamped to the threshold so a
 * small bar is still visible; tooltips relabel them as `<threshold`.
 *
 * Applies ChartDefaults from the bundled config for consistent styling.
 * Usable independently in other projects.
 */
import { Chart, registerables } from "chart.js";
import type { ChartOptions, TooltipItem } from "chart.js";
import type { ChartSpec, DataSet, ChartDefaults, DataProtectionConfig } from "../types";
import { generateAltText } from "../alt-text";
import { getPalette } from "../palettes";
import { t } from "../i18n";
import { wrangleTable, type WrangledTable } from "../aggregation";

Chart.register(...registerables);

/** Per-Chart.js-dataset-index → set of data indices whose values were privacy-suppressed. */
type ProtectionMap = Map<number, Set<number>>;

/** Clamped values + protected indices for one crosstab column. */
function columnSeries(w: WrangledTable, col: number): { values: number[]; protectedIdx: Set<number> } {
  const protectedIdx = new Set<number>();
  const values = w.rows.map((_, i) => {
    const cell = w.cells[i][col];
    if (cell.protected) protectedIdx.add(i);
    return cell.protected ? w.threshold : cell.value;
  });
  return { values, protectedIdx };
}

/** Pyramid/distance need the column axis to hold exactly two distinct values. */
function requireBinaryCols(spec: ChartSpec, w: WrangledTable): void {
  const field = spec.table.groupby.cols;
  if (!field || w.cols.length !== 2) {
    throw new Error(
      t("chart.needsBinaryCols", {
        type: spec.type,
        field: field ?? "groupby.cols",
        count: field ? w.cols.length : 0,
      })
    );
  }
}

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
  const wrangled = wrangleTable(spec.table, data, threshold);

  const figure = document.createElement("figure");

  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", generateAltText(spec, wrangled));
  figure.appendChild(canvas);

  if (spec.caption || spec.title) {
    const figcaption = document.createElement("figcaption");
    figcaption.textContent = spec.caption ?? spec.title!;
    figure.appendChild(figcaption);
  }

  container.appendChild(figure);

  switch (spec.type) {
    case "pyramid":
      renderPyramid(canvas, spec, wrangled, colors, defaults);
      break;
    case "distance":
      renderDistance(canvas, spec, wrangled, colors, defaults);
      break;
    case "pie":
    case "doughnut":
      renderPie(canvas, spec, wrangled, colors, defaults);
      break;
    default:
      renderBarLine(canvas, spec, wrangled, colors, defaults);
  }

  return figure;
}

/**
 * bar / line — rows are the category axis, one dataset per crosstab column.
 * A single synthetic column (no `groupby.cols`) renders as one dataset with
 * per-category palette colors and no legend.
 */
function renderBarLine(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  w: WrangledTable,
  colors: string[],
  defaults?: ChartDefaults
): void {
  const protectionMap: ProtectionMap = new Map();
  let datasets: object[];

  if (w.colHeader) {
    datasets = w.cols.map((name, j) => {
      const series = columnSeries(w, j);
      protectionMap.set(j, series.protectedIdx);
      return {
        label: name,
        data: series.values,
        backgroundColor: colors[j % colors.length],
        borderColor: colors[j % colors.length],
      };
    });
  } else {
    const series = columnSeries(w, 0);
    protectionMap.set(0, series.protectedIdx);
    const perBar = w.rows.map((_, i) => colors[i % colors.length]);
    datasets = [
      {
        label: w.valueLabel,
        data: series.values,
        backgroundColor: spec.type === "line" ? colors[0] : perBar,
        borderColor: spec.type === "line" ? colors[0] : perBar,
      },
    ];
  }

  new Chart(canvas, {
    type: spec.type as "bar" | "line",
    data: { labels: w.rows, datasets: datasets as never },
    options: buildOptions(spec, Boolean(w.colHeader), defaults, w.threshold, protectionMap),
  });
}

/** pie / doughnut — one slice per row; a column axis is not supported. */
function renderPie(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  w: WrangledTable,
  colors: string[],
  defaults?: ChartDefaults
): void {
  if (spec.table.groupby.cols) {
    throw new Error(t("chart.pieNoCols", { type: spec.type }));
  }
  const series = columnSeries(w, 0);
  const protectionMap: ProtectionMap = new Map([[0, series.protectedIdx]]);
  const slice = w.rows.map((_, i) => colors[i % colors.length]);

  new Chart(canvas, {
    type: spec.type as "pie" | "doughnut",
    data: {
      labels: w.rows,
      datasets: [
        {
          label: w.valueLabel,
          data: series.values,
          backgroundColor: slice,
          borderColor: slice,
        },
      ],
    },
    options: buildOptions(spec, true, defaults, w.threshold, protectionMap),
  });
}

/**
 * Pyramid chart — horizontal stacked bar with two datasets that extend in
 * opposite directions from the y-axis: rows are the category axis, the two
 * crosstab columns the left/right sides (first-seen order).
 */
function renderPyramid(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  w: WrangledTable,
  colors: string[],
  defaults?: ChartDefaults
): void {
  requireBinaryCols(spec, w);
  const left = columnSeries(w, 0);
  const right = columnSeries(w, 1);
  const protectionMap: ProtectionMap = new Map([
    [0, left.protectedIdx],
    [1, right.protectedIdx],
  ]);

  const maxAbs = Math.max(0, ...left.values, ...right.values);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: w.rows,
      datasets: [
        {
          label: w.cols[0],
          data: left.values.map((v) => -v),
          backgroundColor: colors[0],
          borderColor: colors[0],
        },
        {
          label: w.cols[1],
          data: right.values,
          backgroundColor: colors[1 % colors.length],
          borderColor: colors[1 % colors.length],
        },
      ],
    },
    options: buildPyramidOptions(spec, maxAbs, defaults, w.threshold, protectionMap),
  });
}

/**
 * Distance plot — for each category (row) on the y-axis, draws two markers
 * (one per crosstab column, with distinct shapes) and a thin connecting
 * line between them. The line is coloured according to the winning
 * class (the column with the higher value at that category).
 *
 * Implemented as a mixed Chart.js chart: a floating bar dataset (thin)
 * provides the connecting line, and two line datasets with
 * `showLine: false` and custom `pointStyle` provide the markers.
 */
function renderDistance(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  w: WrangledTable,
  colors: string[],
  defaults?: ChartDefaults
): void {
  requireBinaryCols(spec, w);
  const seriesA = columnSeries(w, 0);
  const seriesB = columnSeries(w, 1);

  const colorA = colors[0];
  const colorB = colors[1 % colors.length];

  // Floating-bar "line": [min, max] per category, coloured by who's winning.
  const ranges = w.rows.map((_, i) => [
    Math.min(seriesA.values[i], seriesB.values[i]),
    Math.max(seriesA.values[i], seriesB.values[i]),
  ]);
  const winners = w.rows.map((_, i) =>
    seriesA.values[i] >= seriesB.values[i] ? colorA : colorB
  );

  // Chart.js dataset index → protected set, used by the tooltip callback.
  // 0 = bar (range, hidden), 1 = seriesA markers, 2 = seriesB markers.
  const protectionMap: ProtectionMap = new Map([
    [1, seriesA.protectedIdx],
    [2, seriesB.protectedIdx],
  ]);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: w.rows,
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
          label: w.cols[0],
          data: seriesA.values,
          showLine: false,
          pointRadius: 7,
          pointHoverRadius: 8,
          pointStyle: "circle",
          backgroundColor: colorA,
          borderColor: colorA,
        },
        {
          type: "line",
          label: w.cols[1],
          data: seriesB.values,
          showLine: false,
          pointRadius: 7,
          pointHoverRadius: 8,
          pointStyle: "rect",
          backgroundColor: colorB,
          borderColor: colorB,
        },
      ],
    },
    options: buildDistanceOptions(spec, defaults, w.threshold, protectionMap),
  });
}

// ── Tooltip helpers ──────────────────────────────────────────────────

/**
 * Build the `plugins.title` block from a ChartSpec + ChartDefaults.
 * Returns `{ display: false }` when the spec has no title, so the caller
 * can splat the result into every option builder without a conditional.
 * Centralising this keeps title styling consistent across chart types.
 */
function buildTitlePlugin(
  spec: ChartSpec,
  d?: ChartDefaults
): NonNullable<NonNullable<ChartOptions["plugins"]>["title"]> {
  if (!spec.title) return { display: false };
  const fontColor = d?.font?.color ? `#${d.font.color}` : undefined;
  const fontSpec = d?.font ? { family: d.font.family, size: d.font.size } : undefined;
  return {
    display: true,
    text: spec.title,
    position: (d?.title?.position ?? "top") as "top" | "bottom" | "left" | "right",
    align: (d?.title?.align ?? "center") as "start" | "center" | "end",
    color: d?.title?.color ? `#${d.title.color}` : fontColor,
    font: fontSpec,
  };
}

/** Build a tooltip label callback that masks privacy-suppressed values as `<{threshold}`. */
function tooltipLabel(threshold: number, protection: ProtectionMap, abs = false) {
  return (ctx: TooltipItem<"bar" | "line" | "pie" | "doughnut">) => {
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
      title: buildTitlePlugin(spec, d),

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
      title: buildTitlePlugin(spec, d),

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
  multiSeries: boolean,
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
      title: buildTitlePlugin(spec, d),

      legend: {
        display: d?.legend?.display ?? multiSeries,
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
