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
 * Apply document-level structure to an already-rendered preview:
 *   • section numbering — toggles a CSS-counter class so headings render
 *     "1.", "1.1.", … (sections start at <h2>; the <h1> title is excluded).
 *   • table of contents — builds a `<nav class="report-toc">` listing the
 *     section headings and inserts it just before the first <h2> (so it sits
 *     after the title/subtitle front matter, matching the .docx layout).
 *
 * Section numbers are computed in JS for the TOC entries so they match the
 * CSS-counter numbers shown on the headings. Idempotent per render — the app
 * rebuilds the preview from scratch each time.
 */
export function applyDocumentStructure(
  container: HTMLElement,
  opts: { sectionNumbering?: boolean; toc?: boolean }
): void {
  container.classList.toggle("section-numbered", Boolean(opts.sectionNumbering));
  if (opts.toc) buildTableOfContents(container, Boolean(opts.sectionNumbering));
}

function buildTableOfContents(container: HTMLElement, numbered: boolean): void {
  const headings = Array.from(
    container.querySelectorAll<HTMLElement>("h2, h3, h4")
  );
  if (headings.length === 0) return;

  const nav = document.createElement("nav");
  nav.className = "report-toc";
  nav.setAttribute("aria-label", t("export.toc"));

  const title = document.createElement("p");
  title.className = "report-toc-title";
  title.textContent = t("export.toc");
  nav.appendChild(title);

  const list = document.createElement("ul");
  const counters = [0, 0, 0]; // h2, h3, h4

  headings.forEach((h, i) => {
    const level = Number(h.tagName[1]) - 2; // h2 → 0, h3 → 1, h4 → 2
    if (!h.id) h.id = `sec-${i}`;

    let prefix = "";
    if (numbered) {
      counters[level]++;
      for (let k = level + 1; k < counters.length; k++) counters[k] = 0;
      prefix = counters.slice(0, level + 1).join(".") + ". ";
    }

    const li = document.createElement("li");
    li.className = `report-toc-l${level}`;
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.textContent = prefix + (h.textContent ?? "");
    li.appendChild(a);
    list.appendChild(li);
  });

  nav.appendChild(list);

  const firstH2 = container.querySelector("h2");
  if (firstH2?.parentElement) {
    firstH2.parentElement.insertBefore(nav, firstH2);
  } else {
    container.insertBefore(nav, container.firstChild);
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
