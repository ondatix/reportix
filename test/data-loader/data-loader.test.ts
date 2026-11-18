/**
 * Data-loader tests — parsing (XLSX workbook + single CSV/XLSX table) and
 * assembling a DataStore from a sheet/column mapping (rename to config names,
 * keep only mapped columns, warn on unmapped sheets/columns).
 */
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  parseWorkbook,
  parseTable,
  sheetToTable,
  assembleStore,
  matchName,
  normalizeName,
  validateUpload,
  SheetTooLargeError,
  NotAWorkbookError,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_COLS,
  WORKBOOK_EXTENSIONS,
  TABLE_EXTENSIONS,
  type DataMapping,
  type SourceTable,
} from "../../src/modules/data-loader";
import type { DataSourceDef } from "../../src/modules/types";

/** Build an in-memory .xlsx ArrayBuffer from {sheetName: aoa}. */
function xlsxBuffer(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer | Uint8Array;
  if (out instanceof ArrayBuffer) return out;
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

function csvBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

describe("validateUpload", () => {
  const ok = { name: "daten.xlsx", size: 1024 };

  it("accepts a file with an allowed extension and a sane size", () => {
    expect(validateUpload(ok, WORKBOOK_EXTENSIONS)).toBeUndefined();
  });

  it("matches the extension case-insensitively", () => {
    expect(validateUpload({ name: "DATEN.XLSX", size: 10 }, WORKBOOK_EXTENSIONS)).toBeUndefined();
  });

  it("rejects an extension the mode does not accept", () => {
    // The `accept` attribute is only a UI hint — the picker still allows any file.
    expect(validateUpload({ name: "notes.txt", size: 10 }, WORKBOOK_EXTENSIONS)).toMatch(/notes\.txt/);
    expect(validateUpload({ name: "daten.csv", size: 10 }, WORKBOOK_EXTENSIONS)).toBeDefined();
    expect(validateUpload({ name: "daten.csv", size: 10 }, TABLE_EXTENSIONS)).toBeUndefined();
  });

  it("rejects a file with no extension at all", () => {
    expect(validateUpload({ name: "daten", size: 10 }, TABLE_EXTENSIONS)).toBeDefined();
  });

  it("rejects an empty file", () => {
    expect(validateUpload({ ...ok, size: 0 }, WORKBOOK_EXTENSIONS)).toBeDefined();
  });

  it("rejects a file above the size cap but accepts one at the cap", () => {
    expect(validateUpload({ ...ok, size: MAX_UPLOAD_BYTES + 1 }, WORKBOOK_EXTENSIONS)).toBeDefined();
    expect(validateUpload({ ...ok, size: MAX_UPLOAD_BYTES }, WORKBOOK_EXTENSIONS)).toBeUndefined();
  });
});

describe("parseWorkbook", () => {
  it("returns a SourceTable per sheet with columns + rows", () => {
    const buf = xlsxBuffer({
      Stichtag: [
        ["PersNr", "Geschlecht"],
        [1, "m"],
        [2, "w"],
      ],
      Other: [["A", "B"], [10, 20]],
    });
    const tables = parseWorkbook(buf);
    expect(Object.keys(tables).sort()).toEqual(["Other", "Stichtag"]);
    expect(tables.Stichtag.columns).toEqual(["PersNr", "Geschlecht"]);
    expect(tables.Stichtag.rows).toEqual([
      { PersNr: 1, Geschlecht: "m" },
      { PersNr: 2, Geschlecht: "w" },
    ]);
  });
});

describe("workbook container check", () => {
  const text = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

  // Regression: SheetJS reads bytes it does not recognise as plain text, so a
  // corrupt or renamed .xlsx "parsed" into a junk one-column Sheet1 and the
  // user saw no error — only a mapping in which nothing matched.
  it("rejects a .xlsx that is not a zip/OLE container", () => {
    expect(() => parseWorkbook(text("kein Excel\nwirklich nicht"), "daten.xlsx")).toThrow(
      NotAWorkbookError
    );
    expect(() => parseTable(text("a,b\n1,2"), "daten.XLSX")).toThrow(NotAWorkbookError);
  });

  it("names the file in the localized message", () => {
    expect(() => parseWorkbook(text("x"), "kaputt.xlsx")).toThrow(/kaputt\.xlsx/);
  });

  it("accepts a real workbook", () => {
    const buf = xlsxBuffer({ S: [["A"], [1]] });
    expect(Object.keys(parseWorkbook(buf, "ok.xlsx"))).toEqual(["S"]);
    expect(parseTable(buf, "ok.xlsx").columns).toEqual(["A"]);
  });

  it("lets an OLE2 container through to SheetJS (password-protected .xlsx)", () => {
    const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    // Not a NotAWorkbookError: whatever SheetJS makes of it is its own verdict.
    try {
      parseWorkbook(cfb.buffer, "geschuetzt.xlsx");
    } catch (err) {
      expect(err).not.toBeInstanceOf(NotAWorkbookError);
    }
  });

  it("leaves .xls and .csv to the text fallback, which legacy exports rely on", () => {
    expect(() => parseWorkbook(text("A\tB\n1\t2"), "export.xls")).not.toThrow();
    expect(parseTable(text("A,B\n1,2"), "export.csv").columns).toEqual(["A", "B"]);
  });

  it("skips the check when no filename is given (backwards-compatible API)", () => {
    expect(() => parseWorkbook(text("A,B\n1,2"))).not.toThrow();
  });
});

describe("sheet size caps", () => {
  it("rejects a sheet whose used range has too many columns", () => {
    const header = Array.from({ length: MAX_UPLOAD_COLS + 1 }, (_, i) => `c${i}`);
    const buf = xlsxBuffer({ Big: [header, header.map(() => 1)] });
    expect(() => parseWorkbook(buf)).toThrow(SheetTooLargeError);
  });

  it("accepts a sheet at the column cap", () => {
    const header = Array.from({ length: MAX_UPLOAD_COLS }, (_, i) => `c${i}`);
    const buf = xlsxBuffer({ Ok: [header, header.map(() => 1)] });
    expect(() => parseWorkbook(buf)).not.toThrow();
  });

  it("measures the real cell extent, not the file-supplied !ref", () => {
    // A hostile workbook can understate its used range: build a wide sheet, then
    // lie about `!ref`. The cap must still fire off the actual cells.
    const header = Array.from({ length: MAX_UPLOAD_COLS + 5 }, (_, i) => `c${i}`);
    const sheet = XLSX.utils.aoa_to_sheet([header, header.map(() => 1)]);
    sheet["!ref"] = "A1:B2";
    expect(() => sheetToTable(sheet)).toThrow(SheetTooLargeError);
  });

  it("keys rows by the trimmed header, so a padded header cell still resolves", () => {
    // Regression: the header list was trimmed while the row keys were not, so
    // " amount " became the column "amount" that matched no key in any row —
    // the column read as empty everywhere and a mean over it aggregated to 0.
    const sheet = XLSX.utils.aoa_to_sheet([
      ["id", " amount "],
      [1, 100],
      [2, 200],
    ]);
    const table = sheetToTable(sheet);
    expect(table.columns).toEqual(["id", "amount"]);
    expect(table.rows).toEqual([
      { id: 1, amount: 100 },
      { id: 2, amount: 200 },
    ]);
  });

  it("omits empty cells rather than storing them as undefined", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["a", "b"],
      [1, null],
    ]);
    expect(sheetToTable(sheet).rows).toEqual([{ a: 1 }]);
  });

  it("hands sheet_to_json a trustworthy range even when !ref lies small", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["a", "b"],
      [1, 2],
      [3, 4],
    ]);
    sheet["!ref"] = "A1:A1"; // would drop every row but the header if trusted
    expect(sheetToTable(sheet).rows).toEqual([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]);
  });
});

describe("parseTable", () => {
  it("parses a CSV file into one table", () => {
    const t = parseTable(csvBuffer("a,b\n1,x\n2,y\n"), "data.csv");
    expect(t.columns).toEqual(["a", "b"]);
    expect(t.rows).toEqual([
      { a: 1, b: "x" },
      { a: 2, b: "y" },
    ]);
  });

  it("parses an .xlsx file, preferring the named sheet", () => {
    const buf = xlsxBuffer({
      First: [["x"], [1]],
      Stichtag: [["PersNr"], [42]],
    });
    expect(parseTable(buf, "f.xlsx", "Stichtag").rows).toEqual([{ PersNr: 42 }]);
    // No preferred sheet → first sheet.
    expect(parseTable(buf, "f.xlsx").columns).toEqual(["x"]);
  });
});

describe("normalizeName / matchName", () => {
  it("matches case- and whitespace-insensitively", () => {
    expect(normalizeName("  Entgeltgruppe /  Besoldungsgruppe ")).toBe("entgeltgruppe / besoldungsgruppe");
    expect(matchName("persnr", ["Foo", "PersNr", "Bar"])).toBe("PersNr");
    expect(matchName("nope", ["Foo", "Bar"])).toBeUndefined();
  });
});

const DEFS: Record<string, DataSourceDef> = {
  Quelle: {
    sheets: [{ sheet: "Stichtag", columns: [{ name: "PersNr" }, { name: "Geschlecht" }] }],
  },
};

describe("assembleStore", () => {
  const table: SourceTable = {
    columns: ["id", "sex", "extra"],
    rows: [
      { id: 1, sex: "m", extra: "drop" },
      { id: 2, sex: "w", extra: "drop" },
    ],
  };

  it("renames mapped columns to config names and drops unmapped/extra columns", () => {
    const mapping: DataMapping = {
      Stichtag: { table, columns: { PersNr: "id", Geschlecht: "sex" } },
    };
    const { store, warnings } = assembleStore(DEFS, mapping);
    expect(warnings).toEqual([]);
    expect(store.Stichtag).toEqual([
      { PersNr: 1, Geschlecht: "m" },
      { PersNr: 2, Geschlecht: "w" },
    ]);
  });

  it("warns when a sheet has no chosen table", () => {
    const { store, warnings } = assembleStore(DEFS, { Stichtag: { columns: {} } });
    expect(store.Stichtag).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("Stichtag");
  });

  it("warns once per unmapped column and omits it from the rows", () => {
    const mapping: DataMapping = {
      Stichtag: { table, columns: { PersNr: "id" } }, // Geschlecht unmapped
    };
    const { store, warnings } = assembleStore(DEFS, mapping);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("Geschlecht");
    expect(store.Stichtag).toEqual([{ PersNr: 1 }, { PersNr: 2 }]);
  });

  it("appends a column's custom `warning` text to the generic message", () => {
    const defs: Record<string, DataSourceDef> = {
      Quelle: {
        sheets: [
          {
            sheet: "Stichtag",
            columns: [{ name: "PersNr" }, { name: "Geschlecht", warning: "Ohne Geschlecht bleibt Abschnitt X leer." }],
          },
        ],
      },
    };
    const mapping: DataMapping = { Stichtag: { table, columns: { PersNr: "id" } } };
    const { warnings } = assembleStore(defs, mapping);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("Geschlecht");
    expect(warnings[0].message).toContain("Ohne Geschlecht bleibt Abschnitt X leer.");
  });

  it("appends a sheet's custom `warning` text when the sheet itself is unmapped", () => {
    const defs: Record<string, DataSourceDef> = {
      Quelle: {
        sheets: [{ sheet: "Stichtag", columns: [{ name: "PersNr" }], warning: "Ohne dieses Blatt entfällt der ganze Abschnitt." }],
      },
    };
    const { warnings } = assembleStore(defs, { Stichtag: { columns: {} } });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("Stichtag");
    expect(warnings[0].message).toContain("Ohne dieses Blatt entfällt der ganze Abschnitt.");
  });
});
