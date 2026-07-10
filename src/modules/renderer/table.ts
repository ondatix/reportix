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
import type { TableSpec, DataSet, DataProtectionConfig } from "../types";
import { wrangleTable, type WrangledCell, type WrangledTable } from "../aggregation";

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
  dataProtection?: DataProtectionConfig
): HTMLTableElement {
  const threshold = dataProtection?.smallestGroup ?? 0;
  const wrangled = wrangleTable(spec, data, threshold);

  const table = document.createElement("table");

  if (spec.caption) {
    const caption = document.createElement("caption");
    caption.textContent = spec.caption;
    table.appendChild(caption);
  }

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const col of [wrangled.rowHeader, ...wrangled.cols]) {
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
 * Render a wrangled cell as display text. Privacy-protected cells mask as
 * `<{threshold}`. An explicit `format` wins; otherwise share ops render as
 * percentages, whole numbers plainly, and other values with two decimals.
 */
export function formatWrangledCell(
  cell: WrangledCell,
  wrangled: Pick<WrangledTable, "threshold" | "isShare">,
  format?: TableSpec["format"]
): string {
  if (cell.protected) return `<${wrangled.threshold}`;
  if (format && FORMATTERS[format]) return FORMATTERS[format](cell.value);
  if (wrangled.isShare) return FORMATTERS.percent(cell.value);
  if (Number.isInteger(cell.value)) return FORMATTERS.integer(cell.value);
  return FORMATTERS.decimal(cell.value);
}
