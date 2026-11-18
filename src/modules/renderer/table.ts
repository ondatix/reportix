/**
 * Table renderer — renders a TableSpec into an accessible HTML crosstab
 * with proper <th scope>, <caption>, and value formatting.
 *
 * The data shaping is shared with the chart renderer: the spec is turned
 * into a `WrangledTable` (filter → groupby rows × cols → aggregate, with
 * per-cell data-protection flags) by the aggregation module; this renderer
 * only lays that crosstab out as HTML. Protected cells render as
 * `<{threshold}` instead of their value.
 *
 * Usable independently in other projects.
 */
import type { TableSpec, DataSet, DataParametersConfig } from "../types";
import { wrangleTable, showsGroupCount, type WrangledCell, type WrangledTable } from "../aggregation";
import { t } from "../i18n";

const FORMATTERS: Record<string, (v: number) => string> = {
  currency: (v) =>
    v.toLocaleString(undefined, {
      style: "currency",
      currency: "EUR",
    }),
  percent: (v) => `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} %`,
  integer: (v) =>
    v.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    }),
  decimal: (v) =>
    v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
};

export function renderTable(
  spec: TableSpec,
  data: DataSet,
  container: HTMLElement,
  dataParameters?: DataParametersConfig
): HTMLTableElement {
  const threshold = dataParameters?.smallestGroup ?? 0;
  const wrangled = wrangleTable(spec, data, threshold, dataParameters?.categoryOrder);

  const table = document.createElement("table");

  if (spec.caption) {
    const caption = document.createElement("caption");
    caption.textContent = spec.caption;
    table.appendChild(caption);
  }

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  // `rowHeader` is empty when the spec omits `groupby.rows` (every row
  // collapses into one "Gesamt" row). An empty <th> leaves the row-label
  // column unnamed for screen readers, so fall back to a generic label.
  const rowHeader = wrangled.rowHeader || t("table.rowHeaderFallback");
  for (const col of [rowHeader, ...wrangled.cols]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = col;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  wrangled.rows.forEach((rowLabel, i) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = rowLabel;
    tr.appendChild(th);
    wrangled.cells[i].forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = formatWrangledCell(cell, wrangled, spec.format);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);
  return table;
}

/**
 * Render a wrangled cell as display text. A privacy-protected cell shows
 * `<{threshold}` only where the number *is* the group count; for every other
 * op that label would be untrue, so it shows a neutral placeholder instead.
 * An explicit `format` wins; otherwise share ops render as percentages, whole
 * numbers plainly, and other values with two decimals.
 */
export function formatWrangledCell(
  cell: WrangledCell,
  wrangled: Pick<WrangledTable, "threshold" | "isShare" | "aggregation">,
  format?: TableSpec["format"]
): string {
  if (cell.protected) {
    return showsGroupCount(wrangled.aggregation)
      ? `<${wrangled.threshold}`
      : t("agg.suppressed");
  }
  if (format && FORMATTERS[format]) return FORMATTERS[format](cell.value);
  if (wrangled.isShare) return FORMATTERS.percent(cell.value);
  if (Number.isInteger(cell.value)) return FORMATTERS.integer(cell.value);
  return FORMATTERS.decimal(cell.value);
}
