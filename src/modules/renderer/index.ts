/**
 * Renderer — orchestrates text, chart, and table rendering for
 * a parsed template. Produces a complete HTML preview.
 */
export { renderText } from "./text";
export { renderChart } from "./chart";
export { renderTable } from "./table";

import { renderText } from "./text";
import { renderChart } from "./chart";
import { renderTable } from "./table";
import type { TemplateBlock, DataStore, ParameterValues, ChartDefaults } from "../types";

export function renderBlocks(
  blocks: TemplateBlock[],
  dataStore: DataStore,
  parameters: ParameterValues,
  container: HTMLElement,
  chartDefaults?: ChartDefaults
): void {
  for (const block of blocks) {
    switch (block.type) {
      case "text": {
        const section = document.createElement("section");
        section.innerHTML = renderText(block.markdown, parameters);
        container.appendChild(section);
        break;
      }

      case "chart": {
        const data = dataStore[block.spec.data];
        if (!data) {
          const err = document.createElement("p");
          err.className = "error";
          err.textContent = `Data source "${block.spec.data}" not found.`;
          container.appendChild(err);
          break;
        }
        renderChart(block.spec, data, container, chartDefaults);
        break;
      }

      case "table": {
        const data = dataStore[block.spec.data];
        if (!data) {
          const err = document.createElement("p");
          err.className = "error";
          err.textContent = `Data source "${block.spec.data}" not found.`;
          container.appendChild(err);
          break;
        }
        renderTable(block.spec, data, container);
        break;
      }
    }
  }
}
