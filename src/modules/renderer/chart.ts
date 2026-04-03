/**
 * Chart renderer — renders a ChartSpec into a <figure> with an accessible
 * Chart.js canvas, alt text, and optional caption.
 * Usable independently in other projects.
 */
import { Chart, registerables } from "chart.js";
import type { ChartSpec, DataSet } from "../types";
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
  container: HTMLElement
): HTMLElement {
  const figure = document.createElement("figure");

  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");

  const altText = generateAltText(spec, data);
  canvas.setAttribute("aria-label", altText);

  figure.appendChild(canvas);

  // Optional visible caption.
  if (spec.caption || spec.title) {
    const figcaption = document.createElement("figcaption");
    figcaption.textContent = spec.caption ?? spec.title!;
    figure.appendChild(figcaption);
  }

  container.appendChild(figure);

  // Resolve chart data.
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
    options: {
      responsive: true,
      plugins: {
        title: spec.title
          ? { display: true, text: spec.title }
          : { display: false },
        legend: { display: yFields.length > 1 },
      },
    },
  });

  return figure;
}
