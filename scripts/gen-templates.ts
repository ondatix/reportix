/**
 * Template generator — emits the bundled report templates from a single master.
 *
 * Run via `npm run gen:templates` (also wired as a pre-hook for dev/build/test).
 * Reads `templates/master.md` and `config/template.yaml`, then for every entry
 * in `template.files` with an `id` + `file`, writes the assembled template to
 * `templates/<file>`. The `templates/` directory is git-ignored — its contents
 * are build artifacts.
 *
 * Assembly per template id (see scripts/gen-templates-lib.ts for the details):
 *   1. `<!-- include: <ids> -->` … `<!-- /include -->` markers scope prose to
 *      specific ids; unmarked content lands in every template.
 *   2. The `{{questions}}` placeholder receives the rendered question catalog
 *      (`template.questions`), the `{{tables}}` placeholder the matching
 *      appendix table blocks. Both are generation-time placeholders and never
 *      reach the output; runtime parameter placeholders like `{{title}}` pass
 *      through untouched.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYAML } from "yaml";
import {
  type CatalogEntry,
  markerIds,
  renderTemplate,
  segmentMaster,
  validateCatalog,
} from "./gen-templates-lib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER_PATH = resolve(ROOT, "templates/master.md");
const TEMPLATE_CONFIG_PATH = resolve(ROOT, "config/template.yaml");
const OUT_DIR = resolve(ROOT, "templates");

function main(): void {
  const master = readFileSync(MASTER_PATH, "utf8");
  const segments = segmentMaster(master);

  const config = parseYAML(readFileSync(TEMPLATE_CONFIG_PATH, "utf8")) as {
    template?: {
      files?: Array<{ id?: string; file?: string }>;
      questions?: CatalogEntry[];
    };
  };
  const files = config.template?.files ?? [];
  const questions = config.template?.questions ?? [];

  const knownIds = new Set(files.map((f) => f.id).filter(Boolean) as string[]);

  // Warn if a marker references an id no template declares (likely a typo).
  for (const id of markerIds(segments)) {
    if (!knownIds.has(id)) console.warn(`⚠ marker references unknown template id "${id}" (not in config/template.yaml).`);
  }
  for (const warning of validateCatalog(questions, knownIds)) console.warn(`⚠ ${warning}`);

  mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const f of files) {
    if (!f.id || !f.file) {
      console.warn(`⚠ skipping template entry without id+file: ${JSON.stringify(f)}`);
      continue;
    }
    const outPath = resolve(OUT_DIR, f.file);
    writeFileSync(outPath, renderTemplate(segments, questions, f.id) + "\n", "utf8");
    console.log(`  ✓ ${f.file}  (id: ${f.id})`);
    written++;
  }
  console.log(`Generated ${written} template(s) from templates/master.md + config/template.yaml → templates/.`);
}

main();
