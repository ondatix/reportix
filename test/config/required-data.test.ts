/**
 * requiredDataForBlocks tests — the data-loading step prompts only the
 * sheets/columns the selected template's blocks reference, resolved through
 * the preprocessing pipeline (mutations → source column, join outputs →
 * right-sheet columns + join keys). Plus a real-config check that the
 * mandatory template requests a strict subset of the full one.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import { parseConfigObject, requiredDataForBlocks } from "../../src/modules/config";
import { parseTemplate } from "../../src/modules/template";
import type { DataSourceDef, PreprocessingConfig, TemplateBlock } from "../../src/modules/types";

const ROOT = resolve(__dirname, "../..");

const col = (name: string) => ({ name });
const data: Record<string, DataSourceDef> = {
  Quelle: {
    sheets: [
      {
        sheet: "Stichtag",
        columns: [col("PersNr"), col("Geschlecht"), col("EG"), col("Org"), col("Unbenutzt")],
      },
      { sheet: "Ereignis", columns: [col("PersNr"), col("Art"), col("Extra")] },
    ],
  },
};
const preprocessing: PreprocessingConfig = {
  mutations: [
    { dataset: "Stichtag", column: "Beamte", from: "EG", then: "Ja", else: "Nein" },
    { dataset: "Ereignis", column: "Flag", from: "Art", then: "Ja", else: "Nein" },
  ],
  joins: [
    { name: "Ereignis", left: "Ereignis", right: "Stichtag", on: "PersNr", type: "left" },
  ],
};

const tableBlock = (spec: object): TemplateBlock =>
  ({ type: "table", spec }) as unknown as TemplateBlock;
const chartBlock = (table: object): TemplateBlock =>
  ({ type: "chart", spec: { type: "bar", table } }) as unknown as TemplateBlock;

const requiredCols = (out: Record<string, DataSourceDef>, sheet: string) =>
  Object.values(out)
    .flatMap((s) => s.sheets)
    .find((s) => s.sheet === sheet)
    ?.columns.map((c) => c.name);

describe("requiredDataForBlocks", () => {
  it("keeps only directly referenced physical columns and drops unused sheets", () => {
    const out = requiredDataForBlocks(
      [tableBlock({ data: "Stichtag", groupby: { rows: "Org", cols: "Geschlecht" }, aggregation: "count" })],
      data,
      preprocessing
    );
    expect(requiredCols(out, "Stichtag")).toEqual(["Geschlecht", "Org"]);
    expect(requiredCols(out, "Ereignis")).toBeUndefined();
  });

  it("resolves mutation-derived columns to their source column", () => {
    const out = requiredDataForBlocks(
      [chartBlock({ data: "Stichtag", filter: "Beamte", groupby: { rows: "Org" }, aggregation: "count" })],
      data,
      preprocessing
    );
    expect(requiredCols(out, "Stichtag")).toEqual(["EG", "Org"]);
  });

  it("resolves join-supplied columns to the right sheet and requires the keys", () => {
    const out = requiredDataForBlocks(
      [tableBlock({ data: "Ereignis", groupby: { rows: "Art", cols: "Geschlecht" }, aggregation: "count" })],
      data,
      preprocessing
    );
    // Geschlecht comes from Stichtag via the join → keys on both sides.
    expect(requiredCols(out, "Ereignis")).toEqual(["PersNr", "Art"]);
    expect(requiredCols(out, "Stichtag")).toEqual(["PersNr", "Geschlecht"]);
  });

  it("resolves mutations behind a join (derived on the right sheet)", () => {
    const out = requiredDataForBlocks(
      [tableBlock({ data: "Ereignis", filter: "Beamte", groupby: { rows: "Art" }, aggregation: "count" })],
      data,
      preprocessing
    );
    expect(requiredCols(out, "Stichtag")).toEqual(["PersNr", "EG"]);
  });

  it("ignores unresolvable columns and the Alle/- pseudo-filters", () => {
    const out = requiredDataForBlocks(
      [
        tableBlock({ data: "Stichtag", filter: "Alle", groupby: { rows: "GibtEsNicht" }, aggregation: "count" }),
        tableBlock({ data: "Nirgends", groupby: { rows: "Org" }, aggregation: "count" }),
      ],
      data,
      preprocessing
    );
    expect(out).toEqual({});
  });

  it("requires the value column of value-ops", () => {
    const out = requiredDataForBlocks(
      [chartBlock({ data: "Ereignis", groupby: { rows: "Art" }, aggregation: "share_group", value: "Flag" })],
      data,
      preprocessing
    );
    // Flag is mutation-derived from Art on the event sheet itself — no join needed.
    expect(requiredCols(out, "Ereignis")).toEqual(["Art"]);
    expect(requiredCols(out, "Stichtag")).toBeUndefined();
  });
});

/**
 * A join that builds a *new* dataset (`name` ≠ `left`) rather than enriching
 * its source in place. Here the output is named after the right sheet, so a
 * block's columns can resolve on the left sheet, or on a mutation declared on
 * the same-named source sheet, without ever touching the right-sheet branch —
 * and the join keys must still be requested, or the join matches nothing and
 * every copied column arrives empty.
 */
describe("requiredDataForBlocks — join output that is not in-place", () => {
  const flipped: PreprocessingConfig = {
    mutations: [{ dataset: "Ereignis", column: "Flag", from: "Art", then: "Ja", else: "Nein" }],
    joins: [
      { name: "Ereignis", left: "Stichtag", right: "Ereignis", on: "PersNr", type: "left" },
    ],
  };

  it("requires both join keys for a column supplied by the left sheet", () => {
    const out = requiredDataForBlocks(
      [tableBlock({ data: "Ereignis", groupby: { cols: "Geschlecht" }, aggregation: "count" })],
      data,
      flipped
    );
    expect(requiredCols(out, "Stichtag")).toEqual(["PersNr", "Geschlecht"]);
    expect(requiredCols(out, "Ereignis")).toEqual(["PersNr"]);
  });

  it("requires both join keys for a mutation-derived column", () => {
    const out = requiredDataForBlocks(
      [chartBlock({ data: "Ereignis", groupby: { cols: "Geschlecht" }, aggregation: "share_group", value: "Flag" })],
      data,
      flipped
    );
    expect(requiredCols(out, "Ereignis")).toEqual(["PersNr", "Art"]);
    expect(requiredCols(out, "Stichtag")).toEqual(["PersNr", "Geschlecht"]);
  });

  it("requires both join keys for a column declared on the right sheet", () => {
    const out = requiredDataForBlocks(
      [tableBlock({ data: "Ereignis", groupby: { rows: "Extra" }, aggregation: "count" })],
      data,
      flipped
    );
    expect(requiredCols(out, "Ereignis")).toEqual(["PersNr", "Extra"]);
    expect(requiredCols(out, "Stichtag")).toEqual(["PersNr"]);
  });
});

describe("requiredDataForBlocks — real config + generated templates", () => {
  const configDir = resolve(ROOT, "config");
  const merged: Record<string, unknown> = {};
  for (const file of readdirSync(configDir).filter((f) => f.endsWith(".yaml"))) {
    Object.assign(merged, YAML.parse(readFileSync(resolve(configDir, file), "utf8")));
  }
  const config = parseConfigObject(merged);

  const requestFor = (file: string) => {
    const blocks = parseTemplate(readFileSync(resolve(ROOT, "templates", file), "utf8"));
    const out = requiredDataForBlocks(blocks, config.data, config.preprocessing);
    return Object.values(out).flatMap((s) => s.sheets.map((sh) => sh.sheet));
  };

  it("mandatory requests a strict subset of sheets (no Beurlaubung/Wettbewerb)", () => {
    const mandatory = requestFor("template_mandatory.md");
    expect(mandatory).toContain("Schueler");
    expect(mandatory).toContain("Zeitraum_Anmeldung");
    expect(mandatory).toContain("Zeitraum_Eintritt");
    expect(mandatory).toContain("Zeitraum_Foerdermassnahme");
    expect(mandatory).toContain("Zeitraum_Vorrueckung");
    expect(mandatory).not.toContain("Zeitraum_Beurlaubung");
    expect(mandatory).not.toContain("Zeitraum_Wettbewerb");

    const full = requestFor("template_full.md");
    for (const sheet of mandatory) expect(full).toContain(sheet);
    expect(full.length).toBeGreaterThan(mandatory.length);
  });
});
