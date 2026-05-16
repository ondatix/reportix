/**
 * Alt-text golden test (with-data mode).
 *
 * Loads `dummy.xlsx` into a DataStore keyed by sheet name, parses
 * `templates/stmas_template.md`, then asks the alt-text module to
 * generate the full alt text — including the per-point enumeration —
 * for every chart whose data source is present in the fixture.
 * Each result is compared to the string stored in
 * `stmas_template.with-data.expected.json`.
 *
 * The golden file is hand-maintained: when alt-text output or the
 * fixture changes intentionally, regenerate via
 * `npm run test:bootstrap-alt-text` and verify the diff before committing.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { parseTemplate } from "../../src/modules/template";
import { generateAltText } from "../../src/modules/alt-text";
import type { ChartBlock, DataStore } from "../../src/modules/types";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(here, "../../templates/stmas_template.md");
const FIXTURE_PATH = resolve(here, "dummy.xlsx");
const GOLDEN_PATH = resolve(here, "stmas_template.with-data.expected.json");

interface GoldenEntry {
  index: number;
  title?: string;
  alt: string;
}

const templateText = readFileSync(TEMPLATE_PATH, "utf8");
const chartSpecs = parseTemplate(templateText)
  .filter((b): b is ChartBlock => b.type === "chart")
  .map((b) => b.spec);

const wb = XLSX.read(readFileSync(FIXTURE_PATH), { type: "buffer" });
const dataStore: DataStore = {};
for (const name of wb.SheetNames) {
  dataStore[name] = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]);
}

const golden: GoldenEntry[] = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));

describe("alt-text — stmas_template.md with dummy.xlsx", () => {
  it("template has the expected number of charts", () => {
    expect(chartSpecs.length).toBe(golden.length);
  });

  chartSpecs.forEach((spec, i) => {
    const label = spec.title ?? `(untitled #${i})`;
    it(`chart ${i}: ${label}`, () => {
      const data = dataStore[spec.data];
      const actual = generateAltText(spec, data);
      expect(actual).toBe(golden[i]?.alt);
    });
  });
});
