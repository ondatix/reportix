/**
 * Data validation tests — row-level `check:` rules against a DataStore,
 * covering the leaf operators (shared with mutations), the `and`/`or`/`not`
 * combinators, missing dataset/column, and the one-warning-per-rule shape.
 */
import { describe, it, expect } from "vitest";
import { runValidation, checkFilterColumns, validationForStore } from "../../src/modules/validation";
import type { DataStore, ValidationConfig } from "../../src/modules/types";

function store(): DataStore {
  return {
    Stichtag: [
      { PersNr: 1, Gruppe: "A11" },
      { PersNr: 2, Gruppe: "E10" },
      { PersNr: 3, Gruppe: "" },
      { PersNr: 4, Gruppe: "Z9" },
      { PersNr: 5, Gruppe: "A" }, // starts_with A but no trailing digit
    ],
  };
}

describe("runValidation", () => {
  it("no warning when every row satisfies the check", () => {
    const config: ValidationConfig = {
      rules: [{ dataset: "Stichtag", column: "Gruppe", check: { or: [{ empty: true }, { startsWith: "A" }] } }],
    };
    // Only Gruppe values that are empty or start with A pass here.
    const s: DataStore = { Stichtag: [{ Gruppe: "A11" }, { Gruppe: "" }, { Gruppe: "A2" }] };
    expect(runValidation(s, config)).toEqual([]);
  });

  it("the StMAS-style rule: (starts_with A/B/E/R/W AND ends_with digit) OR empty", () => {
    const config: ValidationConfig = {
      rules: [
        {
          dataset: "Stichtag",
          column: "Gruppe",
          definition: "Gruppe muss mit A/B/E/R/W beginnen und mit einer Ziffer enden, oder leer sein.",
          check: {
            or: [
              { and: [{ startsWith: ["A", "B", "R", "W", "E"] }, { endsWith: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] }] },
              { empty: true },
            ],
          },
        },
      ],
    };
    // Row 1 (A11) and row 3 ("") pass; row 2 (E10) passes; row 4 (Z9) and row 5 (A) fail.
    const { warnings } = withMessage(runValidation(store(), config));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("2");
    expect(warnings[0]).toContain("Gruppe muss mit A/B/E/R/W beginnen");
  });

  it("not: negates a nested condition", () => {
    const config: ValidationConfig = {
      rules: [{ dataset: "Stichtag", column: "Gruppe", check: { not: { equals: "Z9" } } }],
    };
    const warnings = runValidation(store(), config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("1"); // only "Z9" fails
  });

  it("a leaf object combines its own keys with AND, same as a mutation's `when`", () => {
    const config: ValidationConfig = {
      rules: [{ dataset: "Stichtag", column: "Gruppe", check: { startsWith: "A", endsWith: "1" } }],
    };
    // Passes: "A11" (starts A, ends 1). Fails: "E10", "", "Z9", "A" (starts A but doesn't end in 1).
    const warnings = runValidation(store(), config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("4");
  });

  it("validationForStore drops rules for datasets the template never requested", () => {
    const cfg: ValidationConfig = {
      rules: [
        { dataset: "Stichtag", column: "Gruppe", check: { empty: true } },
        { dataset: "Zeitraum_Beurlaubung", column: "Beurlaubungsdauer", check: { gt: 0 } },
      ],
    };
    const kept = validationForStore(store(), cfg);
    expect(kept?.rules.map((r) => r.dataset)).toEqual(["Stichtag"]);
    expect(runValidation(store(), kept).some((w) => w.source.startsWith("Zeitraum_Beurlaubung"))).toBe(false);
  });

  it("warns on missing dataset / missing column", () => {
    const missingDs = runValidation(store(), { rules: [{ dataset: "Nope", column: "Gruppe", check: { empty: true } }] });
    expect(missingDs).toHaveLength(1);
    expect(missingDs[0].message).toContain("Nope");

    const missingCol = runValidation(store(), { rules: [{ dataset: "Stichtag", column: "Nope", check: { empty: true } }] });
    expect(missingCol).toHaveLength(1);
    expect(missingCol[0].message).toContain("Nope");
  });

  it("no rules / undefined config → no warnings", () => {
    expect(runValidation(store(), undefined)).toEqual([]);
    expect(runValidation(store(), { rules: [] })).toEqual([]);
  });
});

function withMessage(warnings: { source: string; message: string }[]) {
  return { warnings: warnings.map((w) => w.message) };
}

describe("checkFilterColumns", () => {
  const data: DataStore = {
    Stichtag: [
      { PersNr: 1, Auszubildende: "Ja" },
      { PersNr: 2, Auszubildende: "Nein" },
    ],
    Leer: [],
  };

  it("warns when a filter names a column the dataset does not carry", () => {
    const w = checkFilterColumns([{ data: "Stichtag", filter: "Beurlaubung" }], data);
    expect(w).toHaveLength(1);
    expect(w[0].source).toBe("Stichtag.Beurlaubung");
    expect(w[0].message).toContain("Beurlaubung");
  });

  it("stays silent for a filter column that exists", () => {
    expect(checkFilterColumns([{ data: "Stichtag", filter: "Auszubildende" }], data)).toEqual([]);
  });

  it("ignores the no-op filter values and blocks without a filter", () => {
    const specs = [
      { data: "Stichtag", filter: "Alle" },
      { data: "Stichtag", filter: "-" },
      { data: "Stichtag", filter: "" },
      { data: "Stichtag" },
    ];
    expect(checkFilterColumns(specs, data)).toEqual([]);
  });

  it("reports one warning per dataset/column pair, not per block", () => {
    const specs = [
      { data: "Stichtag", filter: "Beurlaubung" },
      { data: "Stichtag", filter: "Beurlaubung" },
      { data: "Stichtag", filter: "Beurlaubung" },
    ];
    expect(checkFilterColumns(specs, data)).toHaveLength(1);
  });

  it("does not flag a filter on a dataset that never loaded", () => {
    // The mapping step already reports the missing sheet; a second warning
    // about its filter column would just be noise.
    expect(checkFilterColumns([{ data: "Fehlt", filter: "X" }], data)).toEqual([]);
    expect(checkFilterColumns([{ data: "Leer", filter: "X" }], data)).toEqual([]);
  });

  it("finds a column that only later rows carry (sheets are sparse)", () => {
    const sparse: DataStore = { S: [{ a: 1 }, { a: 2, b: "Ja" }] };
    expect(checkFilterColumns([{ data: "S", filter: "b" }], sparse)).toEqual([]);
  });
});
