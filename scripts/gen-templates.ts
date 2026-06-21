/**
 * Template generator — emits the bundled report templates from a single master.
 *
 * Run via `npm run gen:templates` (also wired as a pre-hook for dev/build/test).
 * Reads `templates/master.md`, then for every entry in `config/template.yaml`
 * that has an `id` + `file`, writes a filtered copy to `templates/<file>`.
 * The `templates/` directory is git-ignored — its contents are build artifacts.
 *
 * Section markers (HTML comments, so they never render) decide which templates
 * a block lands in, reusing the config `include:` vocabulary. Unmarked content
 * goes into EVERY template:
 *
 *     <!-- include: full -->
 *     …only in the template whose id is "full"…
 *     <!-- /include -->
 *
 * The id list is comma/space separated (`<!-- include: full, mandatory -->`).
 * Markers must not nest. Marker lines are stripped from the output.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYAML } from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER_PATH = resolve(ROOT, "templates/master.md");
const TEMPLATE_CONFIG_PATH = resolve(ROOT, "config/template.yaml");
const OUT_DIR = resolve(ROOT, "templates");

const OPEN_MARKER = /^[ \t]*<!--\s*include:\s*(.+?)\s*-->[ \t]*$/;
const CLOSE_MARKER = /^[ \t]*<!--\s*\/include\s*-->[ \t]*$/;

/** A run of lines that belongs either to every template (`ids === null`) or to a specific id set. */
interface Segment {
  ids: string[] | null;
  lines: string[];
}

function parseIds(list: string): string[] {
  return list.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

/** Split the master into segments, stripping the marker lines. Throws on unbalanced/nested markers. */
function segmentMaster(master: string): Segment[] {
  const segments: Segment[] = [];
  let current: string[] | null = null; // active include ids, or null at top level
  let buf: string[] = [];

  const flush = (ids: string[] | null) => {
    if (buf.length > 0) segments.push({ ids, lines: buf });
    buf = [];
  };

  master.split(/\r?\n/).forEach((line, i) => {
    const open = OPEN_MARKER.exec(line);
    if (open) {
      if (current) throw new Error(`Nested <!-- include --> marker at line ${i + 1} is not supported.`);
      flush(null);
      current = parseIds(open[1]);
      return; // strip marker line
    }
    if (CLOSE_MARKER.test(line)) {
      if (!current) throw new Error(`<!-- /include --> without a matching <!-- include --> at line ${i + 1}.`);
      flush(current);
      current = null;
      return; // strip marker line
    }
    buf.push(line);
  });

  if (current) throw new Error("Unclosed <!-- include --> marker at end of master template.");
  flush(null);
  return segments;
}

/** Render the master for one template id: keep always-segments + segments listing that id. */
function renderFor(segments: Segment[], id: string): string {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg.ids === null || seg.ids.includes(id)) out.push(...seg.lines);
  }
  // Collapse blank-line runs left by dropped blocks; trim leading blank lines.
  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
}

function main(): void {
  const master = readFileSync(MASTER_PATH, "utf8");
  const segments = segmentMaster(master);

  const config = parseYAML(readFileSync(TEMPLATE_CONFIG_PATH, "utf8")) as {
    template?: { files?: Array<{ id?: string; file?: string }> };
  };
  const files = config.template?.files ?? [];

  // Warn if a marker references an id no template declares (likely a typo).
  const knownIds = new Set(files.map((f) => f.id).filter(Boolean) as string[]);
  const markerIds = new Set(segments.flatMap((s) => s.ids ?? []));
  for (const id of markerIds) {
    if (!knownIds.has(id)) console.warn(`⚠ marker references unknown template id "${id}" (not in config/template.yaml).`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const f of files) {
    if (!f.id || !f.file) {
      console.warn(`⚠ skipping template entry without id+file: ${JSON.stringify(f)}`);
      continue;
    }
    const outPath = resolve(OUT_DIR, f.file);
    writeFileSync(outPath, renderFor(segments, f.id) + "\n", "utf8");
    console.log(`  ✓ ${f.file}  (id: ${f.id})`);
    written++;
  }
  console.log(`Generated ${written} template(s) from templates/master.md → templates/.`);
}

main();
