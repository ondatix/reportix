/**
 * Join preprocessing tests — synthetic data covering left/inner joins,
 * enrichment (default select), explicit select + rename, prefix, indicator,
 * key aliases (left_on/right_on), in-place overwrite, and warnings.
 */
import { describe, it, expect } from "vitest";
import { applyPreprocessing, preprocessingForStore } from "../../src/modules/preprocessing";
import type { DataStore } from "../../src/modules/types";

function store(): DataStore {
  return {
    Stichtag: [
      { PersNr: 1, Geschlecht: "w", Beamte: "Ja", Org: "A" },
      { PersNr: 2, Geschlecht: "m", Beamte: "Nein", Org: "B" },
      { PersNr: 3, Geschlecht: "w", Beamte: "Ja", Org: "C" },
    ],
    Befoerderung: [
      { PersNr: 1, Maßnahme: "Höhergruppierung" },
      { PersNr: 2, Maßnahme: "Beförderung" },
      { PersNr: 99, Maßnahme: "Beförderung" }, // no match in Stichtag
    ],
  };
}

describe("applyPreprocessing — joins", () => {
  it("left join enriches with all non-key, non-overlapping right columns by default", () => {
    const { store: out, warnings } = applyPreprocessing(store(), {
      joins: [{ name: "Bef", left: "Befoerderung", right: "Stichtag", on: "PersNr", type: "left" }],
    });
    expect(warnings).toEqual([]);
    expect(out.Bef).toHaveLength(3); // all left rows kept
    expect(out.Bef[0]).toMatchObject({ PersNr: 1, Maßnahme: "Höhergruppierung", Beamte: "Ja", Org: "A" });
    // existing left column (Geschlecht is NOT on left) is added; PersNr (key) not duplicated as a copy
    expect(out.Bef[0]).toHaveProperty("Geschlecht", "w");
    // unmatched left row keeps its data; copied columns blank
    expect(out.Bef[2]).toMatchObject({ PersNr: 99, Maßnahme: "Beförderung", Beamte: "", Org: "", Geschlecht: "" });
  });

  it("inner join drops unmatched left rows", () => {
    const { store: out } = applyPreprocessing(store(), {
      joins: [{ name: "Bef", left: "Befoerderung", right: "Stichtag", on: "PersNr", type: "inner" }],
    });
    expect(out.Bef.map((r) => r.PersNr)).toEqual([1, 2]);
  });

  it("explicit select with rename + prefix", () => {
    const { store: out } = applyPreprocessing(store(), {
      joins: [
        {
          name: "Bef",
          left: "Befoerderung",
          right: "Stichtag",
          on: "PersNr",
          prefix: "ST_",
          select: [{ column: "Beamte", as: "Status" }, "Org"],
        },
      ],
    });
    expect(out.Bef[0]).toMatchObject({ ST_Status: "Ja", ST_Org: "A" });
    expect(out.Bef[0]).not.toHaveProperty("Geschlecht"); // not selected
  });

  it("indicator column reflects whether the left row matched", () => {
    const { store: out } = applyPreprocessing(store(), {
      joins: [
        { name: "Bef", left: "Befoerderung", right: "Stichtag", on: "PersNr", select: [], indicator: "matched" },
      ],
    });
    expect(out.Bef.map((r) => r.matched)).toEqual([true, true, false]);
  });

  it("supports distinct left_on / right_on keys", () => {
    const s = store();
    s.Befoerderung = [{ pid: 1, Maßnahme: "x" }];
    const { store: out, warnings } = applyPreprocessing(s, {
      joins: [{ name: "Bef", left: "Befoerderung", right: "Stichtag", leftOn: "pid", rightOn: "PersNr" }],
    });
    expect(warnings).toEqual([]);
    expect(out.Bef[0]).toMatchObject({ pid: 1, Beamte: "Ja" });
  });

  it("first match wins — left rows are never multiplied", () => {
    const s = store();
    s.Stichtag.push({ PersNr: 1, Geschlecht: "x", Beamte: "Nein", Org: "Z" }); // duplicate key
    const { store: out } = applyPreprocessing(s, {
      joins: [{ name: "Bef", left: "Befoerderung", right: "Stichtag", on: "PersNr" }],
    });
    expect(out.Bef).toHaveLength(3);
    expect(out.Bef[0]).toMatchObject({ Beamte: "Ja", Org: "A" }); // first Stichtag row
  });

  it("overwrites the source in place when name === left", () => {
    const { store: out } = applyPreprocessing(store(), {
      joins: [{ name: "Befoerderung", left: "Befoerderung", right: "Stichtag", on: "PersNr" }],
    });
    expect(out.Befoerderung[0]).toMatchObject({ Maßnahme: "Höhergruppierung", Beamte: "Ja" });
  });

  it("warns and skips when a source sheet, key, or column is missing", () => {
    const missingSheet = applyPreprocessing(store(), {
      joins: [{ name: "X", left: "Nope", right: "Stichtag", on: "PersNr" }],
    });
    expect(missingSheet.warnings).toHaveLength(1);
    expect(missingSheet.store.X).toBeUndefined();

    const missingKey = applyPreprocessing(store(), {
      joins: [{ name: "X", left: "Befoerderung", right: "Stichtag" }],
    });
    expect(missingKey.warnings).toHaveLength(1);

    const missingCol = applyPreprocessing(store(), {
      joins: [{ name: "X", left: "Befoerderung", right: "Stichtag", on: "PersNr", select: ["Nope"] }],
    });
    expect(missingCol.warnings.some((w) => /Nope/.test(w.message))).toBe(true);
  });

  it("does not mutate the input store", () => {
    const s = store();
    const before = JSON.stringify(s);
    applyPreprocessing(s, { joins: [{ name: "Bef", left: "Befoerderung", right: "Stichtag", on: "PersNr" }] });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("preprocessingForStore", () => {
  it("drops mutations and joins whose datasets were not loaded, keeping chained joins", () => {
    const filtered = preprocessingForStore(
      { Stichtag: [], Befoerderung: [] },
      {
        mutations: [
          { dataset: "Stichtag", column: "A", from: "Org", then: "x" },
          { dataset: "NichtGeladen", column: "B", from: "Org", then: "x" },
        ],
        joins: [
          { name: "Bef", left: "Befoerderung", right: "Stichtag", on: "PersNr", type: "left" },
          // right is the previous join's output → stays
          { name: "Zweit", left: "Stichtag", right: "Bef", on: "PersNr", type: "left" },
          // left sheet missing → dropped
          { name: "Weg", left: "NichtGeladen", right: "Stichtag", on: "PersNr", type: "left" },
        ],
      }
    )!;
    expect(filtered.mutations!.map((m) => m.dataset)).toEqual(["Stichtag"]);
    expect(filtered.joins!.map((j) => j.name)).toEqual(["Bef", "Zweit"]);
  });

  it("passes undefined through", () => {
    expect(preprocessingForStore({}, undefined)).toBeUndefined();
  });
});
