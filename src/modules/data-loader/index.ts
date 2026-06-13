/**
 * Data-loader module — parses uploaded files (XLSX workbooks or CSV/single-sheet
 * files) into tables, and assembles a DataStore by mapping the user's actual
 * sheets/columns onto the config-defined sheet and column names.
 *
 * The DataStore is keyed by **config sheet name**, and downstream consumers
 * (renderer, preprocessing) reference config sheet/column names — so a mapping
 * renames each chosen source column to its config column name. Names that the
 * user leaves unmapped surface as non-blocking warnings.
 *
 * Usable independently in other projects.
 */
import * as XLSX from "xlsx";
import { t } from "../i18n";
import type { DataSourceDef, DataStore } from "../types";

export interface ValidationError {
  source: string;
  message: string;
}

/** A single parsed table: its header columns and its rows (keyed by header). */
export interface SourceTable {
  columns: string[];
  rows: Record<string, unknown>[];
}

/** User's mapping for one config sheet: which source table + per-column choice. */
export interface SheetMapping {
  /** The chosen source table (a workbook sheet or an uploaded file). */
  table?: SourceTable;
  /** config column name → chosen source column name ("" / absent = unmapped). */
  columns: Record<string, string>;
}

/** Mapping for every config sheet, keyed by **config sheet name**. */
export type DataMapping = Record<string, SheetMapping>;

export interface AssembleResult {
  store: DataStore;
  /**
   * Non-fatal issues: a config sheet with no chosen source table, or a config
   * column left unmapped. The pipeline proceeds with whatever did map — the
   * renderer surfaces per-block "TBD" notes for blocks referencing missing data.
   */
  warnings: ValidationError[];
}

// ── Parsing ──────────────────────────────────────────────────────────

/** Parse every sheet of an `.xlsx` workbook into a `SourceTable` keyed by sheet name. */
export function parseWorkbook(buffer: ArrayBuffer): Record<string, SourceTable> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const out: Record<string, SourceTable> = {};
  for (const name of workbook.SheetNames) {
    out[name] = sheetToTable(workbook.Sheets[name]);
  }
  return out;
}

/**
 * Parse a single-table file (CSV or single-sheet XLSX) into one `SourceTable`.
 * CSV is decoded as text; an `.xlsx`/`.xls` uses the sheet named `preferSheet`
 * (the config sheet name) if present, otherwise the first sheet.
 */
export function parseTable(
  buffer: ArrayBuffer,
  filename: string,
  preferSheet?: string
): SourceTable {
  const isCsv = /\.csv$/i.test(filename);
  const workbook = isCsv
    ? XLSX.read(new TextDecoder().decode(buffer), { type: "string" })
    : XLSX.read(buffer, { type: "array" });

  const sheetName =
    preferSheet && workbook.SheetNames.includes(preferSheet)
      ? preferSheet
      : workbook.SheetNames[0];

  if (!sheetName) return { columns: [], rows: [] };
  return sheetToTable(workbook.Sheets[sheetName]);
}

function sheetToTable(sheet: XLSX.WorkSheet): SourceTable {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  const header = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })[0] ?? [];
  const columns = header
    .map((h) => String(h ?? "").trim())
    .filter((h) => h.length > 0);
  return { columns, rows };
}

// ── Assembly ─────────────────────────────────────────────────────────

/**
 * Build the DataStore from the user's mapping. For each config sheet, copies
 * the mapped source rows, renaming each chosen source column to its config
 * column name (and keeping only the config columns). Never throws.
 */
export function assembleStore(
  definitions: Record<string, DataSourceDef>,
  mapping: DataMapping
): AssembleResult {
  const store: DataStore = {};
  const warnings: ValidationError[] = [];

  for (const [source, def] of Object.entries(definitions)) {
    for (const sheetDef of def.sheets) {
      const map = mapping[sheetDef.sheet];

      if (!map?.table) {
        warnings.push({ source, message: t("data.unmappedSheet", { sheet: sheetDef.sheet }) });
        continue;
      }

      // Per config column, resolve the chosen source column (if any).
      const pairs: Array<[string, string]> = [];
      for (const col of sheetDef.columns) {
        const actual = map.columns[col.name];
        if (actual) pairs.push([col.name, actual]);
        else warnings.push({ source, message: t("data.unmappedColumn", { sheet: sheetDef.sheet, column: col.name }) });
      }

      store[sheetDef.sheet] = map.table.rows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const [configCol, actualCol] of pairs) out[configCol] = row[actualCol];
        return out;
      });
    }
  }

  return { store, warnings };
}

// ── Name matching (for mapping pre-selection) ────────────────────────

/**
 * Normalize a sheet/column name for forgiving match: NFC, collapse internal
 * whitespace, trim, lower-case. Used to pre-select the source name that
 * matches a config name.
 */
export function normalizeName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Return the entry of `candidates` whose normalized name matches `target`, if any. */
export function matchName(target: string, candidates: string[]): string | undefined {
  const want = normalizeName(target);
  return candidates.find((c) => normalizeName(c) === want);
}
