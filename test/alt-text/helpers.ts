/**
 * Shared harness for the alt-text golden tests and their regenerator.
 *
 * Mirrors the app's data pipeline on the dummy fixture: load every sheet of
 * `dummy.xlsx`, merge the real `config/*.yaml` sections, run the configured
 * preprocessing (mutations + joins), and expose the data-protection
 * threshold — so the goldens reflect exactly what the app would render.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import YAML from "yaml";
import { parseTemplate } from "../../src/modules/template";
import { sheetToTable } from "../../src/modules/data-loader";
import { parseConfigObject, parametersForStep } from "../../src/modules/config";
import { applyParameterOverrides, dataParameterDefaults } from "../../src/modules/parameters";
import { applyPreprocessing } from "../../src/modules/preprocessing";
import { loadTransforms } from "../../src/modules/transforms";
import { normalizePieSpec } from "../../src/modules/renderer/chart";
import type { ChartBlock, ChartSpec, DataStore } from "../../src/modules/types";

const here = dirname(fileURLToPath(import.meta.url));
export const TEMPLATE_PATH = resolve(here, "../../templates/template_full.md");
export const FIXTURE_PATH = resolve(here, "dummy.xlsx");
export const GOLDEN_SPEC_PATH = resolve(here, "template_full.expected.json");
export const GOLDEN_DATA_PATH = resolve(here, "template_full.with-data.expected.json");

export interface GoldenEntry {
  index: number;
  title?: string;
  alt: string;
}

/**
 * Every chart spec of the generated full template, in document order —
 * normalized exactly like `renderChart` does (pie/doughnut with `rows`
 * omitted and `cols` present use `cols` as the sole slice axis), so the
 * goldens reflect what the app actually renders.
 */
export function loadChartSpecs(): ChartSpec[] {
  return parseTemplate(readFileSync(TEMPLATE_PATH, "utf8"))
    .filter((b): b is ChartBlock => b.type === "chart")
    .map((b) => normalizePieSpec(b.spec));
}

/** dummy.xlsx + real config preprocessing → the DataStore charts read from. */
export function loadDataStore(): { store: DataStore; threshold: number } {
  const wb = XLSX.read(readFileSync(FIXTURE_PATH), { type: "buffer" });
  const raw: DataStore = {};
  for (const name of wb.SheetNames) {
    // `sheetToTable`, not `XLSX.utils.sheet_to_json`: the latter keys rows by
    // the raw header cell, so a header carrying stray whitespace (the
    // fixture's LK amount column does) matches no config column name here,
    // and the column silently reads as empty in every golden.
    raw[name] = sheetToTable(wb.Sheets[name]).rows;
  }

  const configDir = resolve(here, "../../config");
  const merged: Record<string, unknown> = {};
  for (const file of readdirSync(configDir).filter((f) => f.endsWith(".yaml"))) {
    Object.assign(merged, YAML.parse(readFileSync(resolve(configDir, file), "utf8")));
  }
  const config = parseConfigObject(merged);

  // Emulate the app's mapping step (assembleStore): each config sheet keeps
  // only its declared columns, so joins supply the rest — exactly as when a
  // user maps the fixture in the browser.
  const mapped: DataStore = {};
  for (const source of Object.values(config.data)) {
    for (const sheetDef of source.sheets) {
      const rows = raw[sheetDef.sheet];
      if (!rows) continue;
      const cols = sheetDef.columns.map((c) => c.name);
      mapped[sheetDef.sheet] = rows.map((row) =>
        Object.fromEntries(cols.filter((c) => c in row).map((c) => [c, row[c]]))
      );
    }
  }

  // The data-validation step's checklists, left at their pre-selection (e.g.
  // which profiles count as STEM) — mutations read them via `from_config`.
  const settings = applyParameterOverrides(
    config,
    dataParameterDefaults(parametersForStep(config.parameters, "data"), mapped)
  ) as unknown as Record<string, unknown>;
  // The `fn:` transforms from config/functions/*.ts, as the app passes them —
  // without them a computed column (e.g. a date difference) is never created.
  const { registry } = loadTransforms();
  const { store } = applyPreprocessing(mapped, config.preprocessing ?? {}, registry, settings);
  return { store, threshold: config.dataParameters?.smallestGroup ?? 0 };
}
