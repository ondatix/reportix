/**
 * Mutation preprocessing tests — derive a new column from an existing one via
 * a simple if-else rule, covering the supported condition operators, the
 * mutation→join ordering, and warnings.
 */
import { describe, it, expect } from "vitest";
import { applyPreprocessing } from "../../src/modules/preprocessing";
import type { DataStore } from "../../src/modules/types";

function store(): DataStore {
  return {
    Stichtag: [
      { PersNr: 1, Gruppe: "A11" },
      { PersNr: 2, Gruppe: "E10" },
      { PersNr: 3, Gruppe: "B2" },
    ],
    Events: [
      { PersNr: 1, Art: "Beförderung", Antrag: "Ja" },
      { PersNr: 2, Art: "Höhergruppierung", Antrag: "Nein" },
    ],
  };
}

describe("applyPreprocessing — mutations", () => {
  it("derives a column with starts_with (list) → then/else", () => {
    const { store: out, warnings } = applyPreprocessing(store(), {
      mutations: [
        { dataset: "Stichtag", column: "Beamte", from: "Gruppe", when: { startsWith: ["A", "B", "R", "W"] }, then: "Ja", else: "Nein" },
      ],
    });
    expect(warnings).toEqual([]);
    expect(out.Stichtag.map((r) => r.Beamte)).toEqual(["Ja", "Nein", "Ja"]);
  });

  it("equals condition", () => {
    const { store: out } = applyPreprocessing(store(), {
      mutations: [
        { dataset: "Events", column: "ist_Beförderung", from: "Art", when: { equals: "Beförderung" }, then: "Ja", else: "Nein" },
      ],
    });
    expect(out.Events.map((r) => r.ist_Beförderung)).toEqual(["Ja", "Nein"]);
  });

  it("else defaults to empty string", () => {
    const { store: out } = applyPreprocessing(store(), {
      mutations: [{ dataset: "Stichtag", column: "X", from: "Gruppe", when: { equals: "A11" }, then: "hit" }],
    });
    expect(out.Stichtag.map((r) => r.X)).toEqual(["hit", "", ""]);
  });

  it("no `when` means: source value is truthy", () => {
    const s = store();
    s.Stichtag = [{ Flag: "Ja" }, { Flag: "Nein" }, { Flag: 1 }, { Flag: "" }];
    const { store: out } = applyPreprocessing(s, {
      mutations: [{ dataset: "Stichtag", column: "Out", from: "Flag", then: "T", else: "F" }],
    });
    expect(out.Stichtag.map((r) => r.Out)).toEqual(["T", "F", "T", "F"]);
  });

  it("numeric gte and matches", () => {
    const s = store();
    s.Stichtag = [{ n: 3 }, { n: 7 }, { code: "" }];
    s.Stichtag[2] = { n: 10 };
    const { store: out } = applyPreprocessing(s, {
      mutations: [{ dataset: "Stichtag", column: "big", from: "n", when: { gte: 7 }, then: "Y", else: "N" }],
    });
    expect(out.Stichtag.map((r) => r.big)).toEqual(["N", "Y", "Y"]);

    const re = applyPreprocessing(store(), {
      mutations: [{ dataset: "Stichtag", column: "isE", from: "Gruppe", when: { matches: "^E\\d+$" }, then: "Y", else: "N" }],
    });
    expect(re.store.Stichtag.map((r) => r.isE)).toEqual(["N", "Y", "N"]);
  });

  it("AND-combines multiple predicates in one `when`", () => {
    const s = store();
    s.Events = [
      { Art: "Höhergruppierung", Antrag: "Ja" },
      { Art: "Höhergruppierung", Antrag: "Nein" },
      { Art: "Beförderung", Antrag: "Ja" },
    ];
    const { store: out } = applyPreprocessing(s, {
      mutations: [
        { dataset: "Events", column: "HG_beantragt", from: "Art", when: { equals: "Höhergruppierung", contains: "höher" }, then: "Ja", else: "Nein" },
      ],
    });
    // contains is case-sensitive on the NFC value → "höher" not in "Höhergruppierung"
    expect(out.Events.every((r) => r.HG_beantragt === "Nein")).toBe(true);
  });

  it("mutations run before joins so derived columns propagate", () => {
    const { store: out, warnings } = applyPreprocessing(store(), {
      mutations: [
        { dataset: "Stichtag", column: "Beamte", from: "Gruppe", when: { startsWith: ["A", "B"] }, then: "Ja", else: "Nein" },
      ],
      joins: [{ name: "Events", left: "Events", right: "Stichtag", on: "PersNr", type: "left" }],
    });
    expect(warnings).toEqual([]);
    // Events row for PersNr 1 (A11 → Beamte=Ja) gets the derived column via the join
    expect(out.Events[0]).toMatchObject({ Art: "Beförderung", Beamte: "Ja" });
    expect(out.Events[1]).toMatchObject({ Art: "Höhergruppierung", Beamte: "Nein" });
  });

  it("warns on missing dataset / missing source column", () => {
    const missingDs = applyPreprocessing(store(), {
      mutations: [{ dataset: "Nope", column: "X", from: "Gruppe", then: "a" }],
    });
    expect(missingDs.warnings).toHaveLength(1);

    const missingCol = applyPreprocessing(store(), {
      mutations: [{ dataset: "Stichtag", column: "X", from: "Nope", when: { equals: "A11" }, then: "a", else: "b" }],
    });
    expect(missingCol.warnings).toHaveLength(1);
    expect(missingCol.store.Stichtag.every((r) => r.X === "b")).toBe(true); // all else
  });

  it("does not mutate the input store", () => {
    const s = store();
    const before = JSON.stringify(s);
    applyPreprocessing(s, {
      mutations: [{ dataset: "Stichtag", column: "X", from: "Gruppe", when: { equals: "A11" }, then: "y" }],
    });
    expect(JSON.stringify(s)).toBe(before);
  });
});
