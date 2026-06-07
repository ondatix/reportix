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
import { t } from "../i18n";
import type { TemplateBlock, DataStore, ParameterValues, ChartDefaults, DataProtectionConfig } from "../types";

export function renderBlocks(
  blocks: TemplateBlock[],
  dataStore: DataStore,
  parameters: ParameterValues,
  container: HTMLElement,
  chartDefaults?: ChartDefaults,
  palette?: string[],
  dataProtection?: DataProtectionConfig
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
        safeRender(container, t("render.kind.chart"), block.spec.title, () => {
          const data = dataStore[block.spec.data];
          if (!data) throw new Error(t("render.dataSourceNotFound", { name: block.spec.data }));
          renderChart(block.spec, data, container, chartDefaults, palette, dataProtection);
        });
        break;
      }

      case "table": {
        safeRender(container, t("render.kind.table"), block.spec.caption, () => {
          const data = dataStore[block.spec.data];
          if (!data) throw new Error(t("render.dataSourceNotFound", { name: block.spec.data }));
          renderTable(block.spec, data, container, dataProtection);
        });
        break;
      }
    }
  }
}

/**
 * Run a render function that may append DOM children to `container`. If it
 * throws, remove any children added during the failed attempt and replace
 * them with a red TBD note carrying the error message so the rest of the
 * report can still render.
 */
function safeRender(
  container: HTMLElement,
  kind: string,
  label: string | undefined,
  fn: () => void
): void {
  const beforeCount = container.childNodes.length;
  try {
    fn();
  } catch (err) {
    while (container.childNodes.length > beforeCount) {
      container.removeChild(container.lastChild!);
    }
    const note = document.createElement("p");
    note.className = "tbd-note";
    note.setAttribute("role", "note");
    const heading = label ? t("render.headingWithLabel", { kind, label }) : kind;
    note.textContent = t("render.tbd", { heading, message: (err as Error).message });
    container.appendChild(note);
  }
}
