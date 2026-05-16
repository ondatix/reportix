/**
 * Regenerate both alt-text golden files from the current template + the
 * alt-text module output. Run after intentional changes to the alt-text
 * generator or the dummy fixture, and review the diff before committing.
 *
 *   npm run test:bootstrap-alt-text
 *
 * Produces:
 *   - stmas_template.expected.json           (spec-only, no data)
 *   - stmas_template.with-data.expected.json (with dummy.xlsx)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { parseTemplate } from "../../src/modules/template";
import { generateAltText } from "../../src/modules/alt-text";
import type { ChartBlock, DataStore } from "../../src/modules/types";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(here, "../../templates/stmas_template.md");
const FIXTURE_PATH = resolve(here, "dummy.xlsx");
const GOLDEN_SPEC_PATH = resolve(here, "stmas_template.expected.json");
const GOLDEN_DATA_PATH = resolve(here, "stmas_template.with-data.expected.json");

const templateText = readFileSync(TEMPLATE_PATH, "utf8");
const specs = parseTemplate(templateText)
  .filter((b): b is ChartBlock => b.type === "chart")
  .map((b) => b.spec);

// Spec-only golden.
const specGolden = specs.map((spec, i) => ({
  index: i,
  title: spec.title,
  alt: generateAltText(spec),
}));
writeFileSync(GOLDEN_SPEC_PATH, JSON.stringify(specGolden, null, 2) + "\n", "utf8");
console.log(`Wrote ${specGolden.length} entries to ${GOLDEN_SPEC_PATH}`);

// With-data golden.
const wb = XLSX.read(readFileSync(FIXTURE_PATH), { type: "buffer" });
const dataStore: DataStore = {};
for (const name of wb.SheetNames) {
  dataStore[name] = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]);
}
const dataGolden = specs.map((spec, i) => ({
  index: i,
  title: spec.title,
  alt: generateAltText(spec, dataStore[spec.data]),
}));
writeFileSync(GOLDEN_DATA_PATH, JSON.stringify(dataGolden, null, 2) + "\n", "utf8");
console.log(`Wrote ${dataGolden.length} entries to ${GOLDEN_DATA_PATH}`);
