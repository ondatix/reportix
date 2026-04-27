/**
 * Data-loader module — reads an .xlsx file and validates its structure
 * against the expected sheets and columns from the config.
 * Usable independently in other projects.
 */
import * as XLSX from "xlsx";
import type { DataSourceDef, DataStore, SheetDef } from "../types";

export interface ValidationError {
  source: string;
  message: string;
}

/**
 * Validate and load data from uploaded files against config definitions.
 * Each data source definition declares expected sheets and their columns.
 * Returns the loaded DataStore, or throws with validation details.
 */
export function loadDataSources(
  files: Map<string, ArrayBuffer>,
  definitions: Record<string, DataSourceDef>
): DataStore {
  const store: DataStore = {};
  const errors: ValidationError[] = [];

  for (const [name, def] of Object.entries(definitions)) {
    const buffer = files.get(name);
    if (!buffer) {
      errors.push({ source: name, message: `No file provided for "${name}".` });
      continue;
    }

    const workbook = XLSX.read(buffer, { type: "array" });

    for (const sheetDef of def.sheets) {
      const sheetErrors = validateSheet(workbook, name, sheetDef);
      if (sheetErrors.length > 0) {
        errors.push(...sheetErrors);
        continue;
      }

      const sheet = workbook.Sheets[sheetDef.sheet];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      store[sheetDef.sheet] = rows;
    }
  }

  if (errors.length > 0) {
    const msg = errors.map((e) => `[${e.source}] ${e.message}`).join("\n");
    throw new Error(`Data validation failed:\n${msg}`);
  }

  return store;
}

function validateSheet(
  workbook: XLSX.WorkBook,
  sourceName: string,
  sheetDef: SheetDef
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!workbook.SheetNames.includes(sheetDef.sheet)) {
    errors.push({
      source: sourceName,
      message: `Missing sheet "${sheetDef.sheet}". Found: ${workbook.SheetNames.join(", ")}.`,
    });
    return errors;
  }

  const sheet = workbook.Sheets[sheetDef.sheet];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });

  if (aoa.length === 0) {
    errors.push({
      source: sourceName,
      message: `Sheet "${sheetDef.sheet}" is empty.`,
    });
    return errors;
  }

  const headerRow = aoa[0] ?? [];
  const actualColumns = headerRow.map((h) => normalizeHeader(h));
  const expectedColumns = sheetDef.columns.map(normalizeHeader);
  const missing = sheetDef.columns.filter(
    (_col, i) => !actualColumns.includes(expectedColumns[i])
  );
  if (missing.length > 0) {
    errors.push({
      source: sourceName,
      message: `Sheet "${sheetDef.sheet}" is missing columns: ${missing.join(", ")}. Found: ${actualColumns.join(", ")}.`,
    });
  }

  return errors;
}

/** Normalize a column header for comparison: NFC, trimmed, collapse internal whitespace. */
function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Standalone validation without loading — useful for giving user feedback
 * before proceeding.
 */
export function validateFile(
  buffer: ArrayBuffer,
  sourceName: string,
  def: DataSourceDef
): ValidationError[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const errors: ValidationError[] = [];
  for (const sheetDef of def.sheets) {
    errors.push(...validateSheet(workbook, sourceName, sheetDef));
  }
  return errors;
}
