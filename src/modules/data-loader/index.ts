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

/** Append a sheet's/column's optional custom `warning:` text to the generic unmapped message. */
function withCustomWarning(message: string, custom?: string): string {
  return custom ? `${message} ${custom}` : message;
}

// ── Upload validation ────────────────────────────────────────────────

/**
 * Largest upload the parser accepts (25 MB). The whole file is read into memory
 * and parsed synchronously on the main thread, so an oversized workbook freezes
 * the tab rather than failing usefully — reject it up front instead. Personnel
 * exports of the size these reports are built from stay far below this.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * A single parsed sheet may not exceed this many data rows or columns, nor
 * {@link MAX_UPLOAD_CELLS} populated cells overall. Like {@link MAX_UPLOAD_BYTES}
 * this guards the synchronous main-thread parse: the byte cap bounds a
 * compressed `.xlsx`, but a small file can still decode to a sheet with a
 * pathological size. The limits are checked against the sheet's **actual cell
 * entries**, never its self-declared `!ref` range — that string is written by
 * the file and a hostile upload can understate it while still carrying millions
 * of cells for `sheet_to_json` to walk (see {@link sheetToTable}). Personnel
 * exports stay far below these.
 */
export const MAX_UPLOAD_ROWS = 50_000;
export const MAX_UPLOAD_COLS = 256;
export const MAX_UPLOAD_CELLS = 2_000_000;

/**
 * Thrown by the parser when a sheet's used range exceeds
 * {@link MAX_UPLOAD_ROWS} / {@link MAX_UPLOAD_COLS}. Carries an already-localized
 * message so callers can surface it verbatim rather than wrapping it as a
 * generic parse failure.
 */
export class SheetTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetTooLargeError";
  }
}

/**
 * Thrown when a file named `.xlsx` is not an Excel workbook at all. Like
 * `SheetTooLargeError`, its message is already localized for the user.
 */
export class NotAWorkbookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotAWorkbookError";
  }
}

/** Zip local-file header — every .xlsx is a zip archive. */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
/** OLE2 compound file — what a password-protected .xlsx is wrapped in. */
const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b);
}

/**
 * Reject a `.xlsx` whose bytes are not a workbook container. SheetJS falls
 * back to reading anything it does not recognise as plain text, so a corrupt
 * or renamed file would otherwise "parse" into a junk one-column `Sheet1` —
 * no error, just a mapping where nothing matches.
 *
 * `.xls` is deliberately not checked: legacy systems commonly export HTML or
 * tab-separated text under that extension, Excel opens those, and that very
 * text fallback is what reads them here.
 */
function assertWorkbookContainer(buffer: ArrayBuffer, filename: string): void {
  if (!/\.xlsx$/i.test(filename)) return;
  const head = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, CFB_MAGIC.length));
  if (startsWith(head, ZIP_MAGIC) || startsWith(head, CFB_MAGIC)) return;
  throw new NotAWorkbookError(t("data.notWorkbook", { file: filename }));
}

/** Extensions accepted for a full workbook upload (XLSX mode). */
export const WORKBOOK_EXTENSIONS = [".xlsx", ".xls"] as const;
/** Extensions accepted for a single-table upload (CSV mode). */
export const TABLE_EXTENSIONS = [".csv", ".xlsx", ".xls"] as const;

/**
 * Check an upload before it is read. Returns a localized message describing the
 * problem, or `undefined` if the file may be parsed. The `accept` attribute on
 * the input is a UI hint only — the browser lets the user pick any file — so
 * type and size are re-checked here, in the module that does the parsing.
 */
export function validateUpload(
  file: { name: string; size: number },
  accepted: readonly string[]
): string | undefined {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!accepted.includes(ext)) {
    return t("data.uploadBadType", { file: file.name, accepted: accepted.join(", ") });
  }
  if (file.size === 0) return t("data.uploadEmpty", { file: file.name });
  if (file.size > MAX_UPLOAD_BYTES) {
    return t("data.uploadTooLarge", {
      file: file.name,
      size: formatMB(file.size),
      max: formatMB(MAX_UPLOAD_BYTES),
    });
  }
  return undefined;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

// ── Parsing ──────────────────────────────────────────────────────────

/**
 * Parse every sheet of an `.xlsx` workbook into a `SourceTable` keyed by sheet
 * name. Pass the upload's `filename` to have a `.xlsx` that is not a workbook
 * rejected with `NotAWorkbookError` instead of parsed as text.
 */
export function parseWorkbook(buffer: ArrayBuffer, filename?: string): Record<string, SourceTable> {
  if (filename) assertWorkbookContainer(buffer, filename);
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
  if (!isCsv) assertWorkbookContainer(buffer, filename);
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

/** A1-style cell address: one or more letters followed by a 1-based row number. */
const CELL_ADDRESS = /^[A-Z]+[1-9][0-9]*$/;

/**
 * Measure a sheet's real extent from its own cell entries — ignoring `!ref`,
 * which the file controls — and enforce the size caps against that, so a hostile
 * workbook can't understate its range past the guard. Returns a trustworthy
 * `!ref` string rebuilt from what was actually found (empty ⇒ `undefined`).
 * Throws {@link SheetTooLargeError} if any cap is exceeded.
 */
function measureSheet(sheet: XLSX.WorkSheet): string | undefined {
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -Infinity;
  let maxC = -Infinity;
  let cells = 0;

  for (const key in sheet) {
    if (key.charCodeAt(0) === 33 /* "!" */ || !CELL_ADDRESS.test(key)) continue;
    const { r, c } = XLSX.utils.decode_cell(key);
    if (r < minR) minR = r;
    if (c < minC) minC = c;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
    if (++cells > MAX_UPLOAD_CELLS) {
      throw new SheetTooLargeError(
        t("data.sheetTooManyCells", { cells: `>${MAX_UPLOAD_CELLS}`, max: MAX_UPLOAD_CELLS })
      );
    }
  }

  if (cells === 0) return undefined;

  const nRows = maxR - minR; // exclusive of the header row
  const nCols = maxC - minC + 1;
  if (nRows > MAX_UPLOAD_ROWS) {
    throw new SheetTooLargeError(
      t("data.sheetTooManyRows", { rows: nRows, max: MAX_UPLOAD_ROWS })
    );
  }
  if (nCols > MAX_UPLOAD_COLS) {
    throw new SheetTooLargeError(
      t("data.sheetTooManyCols", { cols: nCols, max: MAX_UPLOAD_COLS })
    );
  }

  return XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
}

/** Exported for tests: turns one parsed worksheet into a `SourceTable`, enforcing the size caps. */
export function sheetToTable(sheet: XLSX.WorkSheet): SourceTable {
  // Enforce the size caps *before* the (expensive) full conversion, measuring
  // the sheet's real extent rather than trusting its file-supplied `!ref`, and
  // hand sheet_to_json the range we measured so it can't be steered either.
  const ref = measureSheet(sheet);
  if (!ref) return { columns: [], rows: [] };
  const safeSheet: XLSX.WorkSheet = { ...sheet, "!ref": ref };

  // Build header *and* rows from the same matrix. `sheet_to_json`'s object mode
  // would key each row by the raw header cell, while the header list below is
  // trimmed — a header cell with surrounding whitespace then yields a column
  // name that matches no key in any row, and the column silently reads as
  // empty everywhere downstream (a `mean` over it aggregates to 0, not "TBD").
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(safeSheet, { header: 1, blankrows: false });
  const kept = (matrix[0] ?? [])
    .map((h, index) => ({ name: String(h ?? "").trim(), index }))
    .filter((c) => c.name.length > 0);
  const columns = kept.map((c) => c.name);
  // Empty cells are omitted rather than stored as undefined, matching what
  // `sheet_to_json`'s object mode produced.
  const rows = matrix.slice(1).map((row) =>
    Object.fromEntries(
      kept
        .filter(({ index }) => row[index] !== undefined && row[index] !== null && row[index] !== "")
        .map(({ name, index }) => [name, row[index]])
    )
  );
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
        warnings.push({ source, message: withCustomWarning(t("data.unmappedSheet", { sheet: sheetDef.sheet }), sheetDef.warning) });
        continue;
      }

      // Per config column, resolve the chosen source column (if any).
      const pairs: Array<[string, string]> = [];
      for (const col of sheetDef.columns) {
        const actual = map.columns[col.name];
        if (actual) pairs.push([col.name, actual]);
        else
          warnings.push({
            source,
            message: withCustomWarning(t("data.unmappedColumn", { sheet: sheetDef.sheet, column: col.name }), col.warning),
          });
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
