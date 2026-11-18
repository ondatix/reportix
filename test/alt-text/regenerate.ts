/**
 * Regenerate both alt-text golden files from the current template + the
 * alt-text module output. Run after intentional changes to the alt-text
 * generator, the question catalog, or the dummy fixture, and review the
 * diff before committing.
 *
 *   npm run test:bootstrap-alt-text
 *
 * Produces:
 *   - template_full.expected.json           (spec-only, no data)
 *   - template_full.with-data.expected.json (with dummy.xlsx + preprocessing)
 */
import { writeFileSync } from "node:fs";
import { generateAltText } from "../../src/modules/alt-text";
import { wrangleTable } from "../../src/modules/aggregation";
import {
  GOLDEN_DATA_PATH,
  GOLDEN_SPEC_PATH,
  loadChartSpecs,
  loadDataStore,
} from "./helpers";

const specs = loadChartSpecs();

// Spec-only golden.
const specGolden = specs.map((spec, i) => ({
  index: i,
  title: spec.title,
  alt: generateAltText(spec),
}));
writeFileSync(GOLDEN_SPEC_PATH, JSON.stringify(specGolden, null, 2) + "\n", "utf8");
console.log(`Wrote ${specGolden.length} entries to ${GOLDEN_SPEC_PATH}`);

// With-data golden — wrangled with the configured data-protection threshold,
// so masked cells appear as "<5" exactly like in the rendered report.
const { store, threshold } = loadDataStore();
const dataGolden = specs.map((spec, i) => {
  const data = store[spec.table.data];
  const wrangled = data ? wrangleTable(spec.table, data, threshold) : undefined;
  return {
    index: i,
    title: spec.title,
    alt: generateAltText(spec, wrangled),
  };
});
writeFileSync(GOLDEN_DATA_PATH, JSON.stringify(dataGolden, null, 2) + "\n", "utf8");
console.log(`Wrote ${dataGolden.length} entries to ${GOLDEN_DATA_PATH}`);
