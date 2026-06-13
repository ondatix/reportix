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
  assembleStore,
  matchName,
  normalizeName,
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
});
