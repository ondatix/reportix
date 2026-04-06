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

Chart.register(...registerables);

/** Colorblind-safe palette (Wong, 2011). */
const ACCESSIBLE_PALETTE = [
  "#0072B2", // blue
  "#E69F00", // orange
  "#009E73", // green
  "#CC79A7", // pink
  "#56B4E9", // sky blue
  "#D55E00", // vermillion
  "#F0E442", // yellow
  "#000000", // black
];

export function renderChart(
  spec: ChartSpec,
  data: DataSet,
  container: HTMLElement,
  defaults?: ChartDefaults
): HTMLElement {
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

  const labels = data.map((row) => String(row[spec.x] ?? ""));
  const yFields = Array.isArray(spec.y) ? spec.y : [spec.y];

  const datasets = yFields.map((yKey, i) => ({
    label: yKey,
    data: data.map((row) => Number(row[yKey] ?? 0)),
    backgroundColor: ACCESSIBLE_PALETTE[i % ACCESSIBLE_PALETTE.length],
    borderColor: ACCESSIBLE_PALETTE[i % ACCESSIBLE_PALETTE.length],
  }));

  new Chart(canvas, {
    type: spec.type === "scatter" ? "scatter" : spec.type,
    data: { labels, datasets },
    options: buildOptions(spec, yFields, defaults),
  });

  return figure;
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
        ticks: { color: d?.scales?.x?.tickColor ? `#${d.scales.x.tickColor}` : fontColor, font: fontSpec },
        grid: {
          display: d?.scales?.x?.gridDisplay ?? true,
          color: d?.scales?.x?.gridColor ?? "rgba(0,0,0,0.08)",
        },
      },
      y: {
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
