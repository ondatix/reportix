/**
 * Alt-text golden test (with-data mode).
 *
 * Loads `dummy.xlsx`, runs the real config preprocessing (mutations +
 * joins) on it, parses `templates/template_full.md`, then asks the
 * alt-text module to generate the full alt text — including the per-cell
 * enumeration of the wrangled crosstab, with data-protection masking —
 * for every chart whose data source is present. Each result is compared
 * to the string stored in `template_full.with-data.expected.json`.
 *
 * The golden file is hand-maintained: when alt-text output, the catalog,
 * or the fixture changes intentionally, regenerate via
 * `npm run test:bootstrap-alt-text` and verify the diff before committing.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { generateAltText } from "../../src/modules/alt-text";
import { wrangleTable } from "../../src/modules/aggregation";
import {
  GOLDEN_DATA_PATH,
  loadChartSpecs,
  loadDataStore,
  type GoldenEntry,
} from "./helpers";

const chartSpecs = loadChartSpecs();
const { store, threshold } = loadDataStore();
const golden: GoldenEntry[] = JSON.parse(readFileSync(GOLDEN_DATA_PATH, "utf8"));

describe("alt-text — template_full.md with dummy.xlsx", () => {
  it("template has the expected number of charts", () => {
    expect(chartSpecs.length).toBe(golden.length);
  });

  chartSpecs.forEach((spec, i) => {
    const label = spec.title ?? `(untitled #${i})`;
    it(`chart ${i}: ${label}`, () => {
      const data = store[spec.table.data];
      const wrangled = data ? wrangleTable(spec.table, data, threshold) : undefined;
      const actual = generateAltText(spec, wrangled);
      expect(actual).toBe(golden[i]?.alt);
    });
  });
});
