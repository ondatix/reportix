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
import { trustedReportHtml } from "../shared/trusted-html";
import type { TemplateBlock, DataStore, ParameterValues, ChartDefaults, DataParametersConfig } from "../types";

export function renderBlocks(
  blocks: TemplateBlock[],
  dataStore: DataStore,
  parameters: ParameterValues,
  container: HTMLElement,
  chartDefaults?: ChartDefaults,
  palette?: string[],
  dataParameters?: DataParametersConfig
): void {
  for (const block of blocks) {
    switch (block.type) {
      case "text": {
        const section = document.createElement("section");
        section.innerHTML = trustedReportHtml(renderText(block.markdown, parameters));
        container.appendChild(section);
        break;
      }

      case "chart": {
        safeRender(container, t("render.kind.chart"), block.spec.title, () => {
          const name = block.spec.table.data;
          const data = dataStore[name];
          if (!data) throw new Error(t("render.dataSourceNotFound", { name }));
          renderChart(block.spec, data, container, chartDefaults, palette, dataParameters);
        });
        break;
      }

      case "table": {
        safeRender(container, t("render.kind.table"), block.spec.caption, () => {
          const data = dataStore[block.spec.data];
          if (!data) throw new Error(t("render.dataSourceNotFound", { name: block.spec.data }));
          renderTable(block.spec, data, container, dataParameters);
        });
        break;
      }
    }
  }
}

/**
 * Apply document-level structure to an already-rendered preview:
 *   • section numbering — labels headings "1.", "1.1.", … (sections start
 *     at <h2>; the <h1> title is excluded).
 *   • table of contents — builds a `<nav class="report-toc">` listing the
 *     section headings and inserts it just before the first <h2> (so it sits
 *     after the title/subtitle front matter, matching the .docx layout).
 *
 * Numbers are computed once in JS (`numberHeadings`) and stored in a
 * `data-secnum` attribute, painted onto the heading via `content:
 * attr(data-secnum)` in CSS. Plain CSS counter-reset/increment can't do this:
 * each text block renders into its own <section> wrapper, and a counter's
 * scope ends at the end of its containing element — so a reset on one <h2>
 * doesn't reach an <h3> living in the *next* text block's <section>, even
 * though they're logically the same section. Computing in JS via
 * querySelectorAll (which flattens across that wrapper structure) sidesteps
 * that entirely, and lets the TOC reuse the exact same numbers. Idempotent
 * per render — the app rebuilds the preview from scratch each time.
 */
export function applyDocumentStructure(
  container: HTMLElement,
  opts: { sectionNumbering?: boolean; toc?: boolean }
): void {
  const numbered = Boolean(opts.sectionNumbering);
  container.classList.toggle("section-numbered", numbered);
  if (numbered) numberHeadings(container);
  if (opts.toc) buildTableOfContents(container);
}

function numberHeadings(container: HTMLElement): void {
  // h5 is numbered too (the appendix tables sit there), matching the DOCX
  // numbering's fourth level; the TOC stays at h2–h4.
  const headings = Array.from(container.querySelectorAll<HTMLElement>("h2, h3, h4, h5"));
  const counters = [0, 0, 0, 0]; // h2, h3, h4, h5

  for (const h of headings) {
    const level = Number(h.tagName[1]) - 2; // h2 → 0, h3 → 1, h4 → 2, h5 → 3
    counters[level]++;
    for (let k = level + 1; k < counters.length; k++) counters[k] = 0;
    h.dataset.secnum = counters.slice(0, level + 1).join(".") + ". ";
  }
}

function buildTableOfContents(container: HTMLElement): void {
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

  headings.forEach((h, i) => {
    const level = Number(h.tagName[1]) - 2; // h2 → 0, h3 → 1, h4 → 2
    if (!h.id) h.id = `sec-${i}`;

    const li = document.createElement("li");
    li.className = `report-toc-l${level}`;
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.textContent = (h.dataset.secnum ?? "") + (h.textContent ?? "");
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
