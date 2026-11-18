/**
 * Mutation preprocessing tests — derive a new column from an existing one via
 * a simple if-else rule, covering the supported condition operators, the
 * mutation→join ordering, and warnings.
 */
import { describe, it, expect } from "vitest";
import { applyPreprocessing } from "../../src/modules/preprocessing";
import type { DataStore } from "../../src/modules/types";
import type { ColumnTransform } from "../../src/modules/transforms";

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

  it("cases: evaluates an elif chain in order, first match wins", () => {
    const s = store();
    s.Stichtag = [{ Gruppe: "A11" }, { Gruppe: "E10" }, { Gruppe: "" }, { Gruppe: "Z9" }];
    const { store: out } = applyPreprocessing(s, {
      mutations: [
        {
          dataset: "Stichtag",
          column: "Status",
          from: "Gruppe",
          cases: [
            { when: { empty: true }, then: "" },
            { when: { startsWith: ["A", "B", "R", "W"] }, then: "Beamte" },
            { when: { startsWith: "E" }, then: "Tarif" },
          ],
          else: "Unbekannt",
        },
      ],
    });
    expect(out.Stichtag.map((r) => r.Status)).toEqual(["Beamte", "Tarif", "", "Unbekannt"]);
  });

  it("elseWarning: emits a warning once when the else branch fires, with the row count", () => {
    const s = store();
    s.Stichtag = [{ Gruppe: "A11" }, { Gruppe: "Z9" }, { Gruppe: "Z8" }];
    const { warnings } = applyPreprocessing(s, {
      mutations: [
        {
          dataset: "Stichtag",
          column: "Status",
          from: "Gruppe",
          cases: [{ when: { startsWith: "A" }, then: "Beamte" }],
          else: "Unbekannt",
          elseWarning: "Unerwartete Gruppe außerhalb der bekannten Präfixe.",
        },
      ],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("2");
    expect(warnings[0].message).toContain("Unerwartete Gruppe außerhalb der bekannten Präfixe.");
  });

  it("elseWarning: no warning when every row matches a case", () => {
    const { warnings } = applyPreprocessing(store(), {
      mutations: [
        {
          dataset: "Stichtag",
          column: "Status",
          from: "Gruppe",
          cases: [{ when: { startsWith: ["A", "E", "B"] }, then: "x" }], // matches every Gruppe in store()
          else: "Unbekannt",
          elseWarning: "sollte nie feuern",
        },
      ],
    });
    expect(warnings).toEqual([]);
  });

  it("without elseWarning, the else branch stays silent even when hit", () => {
    const { warnings } = applyPreprocessing(store(), {
      mutations: [{ dataset: "Stichtag", column: "Status", from: "Gruppe", when: { equals: "nope" }, then: "x", else: "y" }],
    });
    expect(warnings).toEqual([]);
  });

  it("top-level when/then acts as the first case, ahead of `cases`", () => {
    const { store: out } = applyPreprocessing(store(), {
      mutations: [
        {
          dataset: "Stichtag",
          column: "Status",
          from: "Gruppe",
          when: { empty: true },
          then: "leer",
          cases: [{ when: { startsWith: ["A", "B"] }, then: "Beamte" }],
          else: "Tarif",
        },
      ],
    });
    expect(out.Stichtag.map((r) => r.Status)).toEqual(["Beamte", "Tarif", "Beamte"]);
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

describe("mutations with a transform function (fn:)", () => {
  const rows: DataStore = {
    Urlaub: [
      { PersNr: 1, von: 1, bis: 11 },
      { PersNr: 2, von: 5, bis: 10 },
    ],
  };

  /** Difference of two numeric columns — stands in for a real transform. */
  const registry = {
    span: ((columns, ctx) =>
      Array.from({ length: ctx.rowCount }, (_, i) => {
        const end = Number(columns[0][i]);
        const start = Number(columns[1][i]);
        return end - start + (ctx.options.inclusive === true ? 1 : 0);
      })) as ColumnTransform,
    boom: (() => {
      throw new Error("kaputt");
    }) as ColumnTransform,
    short: (() => [1]) as ColumnTransform,
    notAnArray: (() => 5 as unknown as unknown[]) as ColumnTransform,
  };

  const mutation = (extra: Record<string, unknown> = {}) => ({
    mutations: [
      { dataset: "Urlaub", column: "Dauer", fn: "span", from: ["bis", "von"], ...extra },
    ],
  });

  it("derives the column from several source columns, in the order given", () => {
    const { store, warnings } = applyPreprocessing(rows, mutation() as never, registry);
    expect(warnings).toEqual([]);
    expect(store.Urlaub.map((r) => r.Dauer)).toEqual([10, 5]);
  });

  it("passes options through verbatim", () => {
    const { store } = applyPreprocessing(
      rows,
      mutation({ options: { inclusive: true } }) as never,
      registry
    );
    expect(store.Urlaub.map((r) => r.Dauer)).toEqual([11, 6]);
  });

  it("leaves the dataset untouched and warns when the function is unknown", () => {
    const cfg = { mutations: [{ dataset: "Urlaub", column: "Dauer", fn: "fehlt", from: ["bis"] }] };
    const { store, warnings } = applyPreprocessing(rows, cfg as never, registry);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("fehlt");
    expect(store.Urlaub[0].Dauer).toBeUndefined();
  });

  it("catches a throwing transform", () => {
    const { store, warnings } = applyPreprocessing(rows, mutation({ fn: "boom" }) as never, registry);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("kaputt");
    expect(store.Urlaub[0].Dauer).toBeUndefined();
  });

  it("rejects a result that is not an array of one entry per row", () => {
    for (const fn of ["short", "notAnArray"]) {
      const { store, warnings } = applyPreprocessing(rows, mutation({ fn }) as never, registry);
      expect(warnings).toHaveLength(1);
      expect(store.Urlaub[0].Dauer).toBeUndefined();
    }
  });

  it("does not run the transform when a source column is missing", () => {
    // A condition mutation falls through to `else`; an fn mutation must not
    // compute a column out of undefined values.
    const cfg = {
      mutations: [{ dataset: "Urlaub", column: "Dauer", fn: "span", from: ["bis", "fehlt"] }],
    };
    const { store, warnings } = applyPreprocessing(rows, cfg as never, registry);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("fehlt");
    expect(store.Urlaub[0].Dauer).toBeUndefined();
  });

  describe("options resolved from the config (`from_config`)", () => {
    const echo = {
      echoOption: ((_columns, ctx) =>
        Array.from({ length: ctx.rowCount }, () => ctx.options.limit)) as ColumnTransform,
    };
    const cfg = (limit: unknown) => ({
      mutations: [
        { dataset: "Urlaub", column: "L", fn: "echoOption", from: ["bis"], options: { limit } },
      ],
    });

    it("looks the value up in the settings passed to applyPreprocessing", () => {
      const { store } = applyPreprocessing(
        rows,
        cfg({ from_config: "dataParameters.periodEnd" }) as never,
        echo,
        { dataParameters: { periodEnd: "2025-12-31" } }
      );
      expect(store.Urlaub.map((r) => r.L)).toEqual(["2025-12-31", "2025-12-31"]);
    });

    it("reflects the user's answer, not the bundled default", () => {
      // The whole point: the same config yields a different column once the
      // user's parameter values have been merged into the settings.
      const userEdited = { dataParameters: { periodEnd: "2025-06-30" } };
      const { store } = applyPreprocessing(
        rows,
        cfg({ from_config: "dataParameters.periodEnd" }) as never,
        echo,
        userEdited
      );
      expect(store.Urlaub[0].L).toBe("2025-06-30");
    });

    it("passes a plain option through untouched", () => {
      const { store } = applyPreprocessing(rows, cfg(7) as never, echo, {});
      expect(store.Urlaub[0].L).toBe(7);
    });

    it("yields undefined for an unresolvable path, without warning", () => {
      const { store, warnings } = applyPreprocessing(
        rows,
        cfg({ from_config: "nope.missing" }) as never,
        echo,
        {}
      );
      expect(warnings).toEqual([]);
      expect(store.Urlaub[0].L).toBeUndefined();
    });
  });

  it("warns when no registry was supplied at all", () => {
    const { warnings } = applyPreprocessing(rows, mutation() as never);
    expect(warnings).toHaveLength(1);
  });
});
