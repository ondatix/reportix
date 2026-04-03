/**
 * Table renderer — renders a TableSpec into an accessible HTML table
 * with proper <th scope>, <caption>, and value formatting.
 * Usable independently in other projects.
 */
import type { TableSpec, DataSet } from "../types";

const FORMATTERS: Record<string, (v: unknown) => string> = {
  currency: (v) =>
    Number(v).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    }),
  percent: (v) =>
    Number(v).toLocaleString(undefined, {
      style: "percent",
      minimumFractionDigits: 1,
    }),
  integer: (v) =>
    Number(v).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    }),
  decimal: (v) =>
    Number(v).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
};

export function renderTable(
  spec: TableSpec,
  data: DataSet,
  container: HTMLElement
): HTMLTableElement {
  const table = document.createElement("table");

  // Caption.
  if (spec.caption) {
    const caption = document.createElement("caption");
    caption.textContent = spec.caption;
    table.appendChild(caption);
  }

  // Header.
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const col of spec.columns) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = col;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body.
  const tbody = document.createElement("tbody");
  for (const row of data) {
    const tr = document.createElement("tr");
    for (const col of spec.columns) {
      const td = document.createElement("td");
      const raw = row[col];
      const fmt = spec.format?.[col];
      td.textContent =
        fmt && FORMATTERS[fmt] ? FORMATTERS[fmt](raw) : String(raw ?? "");
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  container.appendChild(table);
  return table;
}
