/**
 * Template-generator library — pure functions shared by the CLI
 * (`scripts/gen-templates.ts`) and its tests.
 *
 * Two mechanisms compose a generated template:
 *
 * 1. **Include markers** in `templates/master.md` scope prose to specific
 *    template ids (`<!-- include: full -->` … `<!-- /include -->`; unmarked
 *    content lands in every template).
 * 2. **The question catalog** (`config/template.yaml`, `template.questions`)
 *    is rendered into the master's `{{questions}}` placeholder (one `####`
 *    subsection with a `chart` block per question, grouped by `section`
 *    entries) and into `{{tables}}` (one `table` block per question, for the
 *    appendix). Both blocks share the question's `table:` spec and caption.
 *
 * `{{questions}}`/`{{tables}}` are resolved at **generation time** and must
 * not survive into `templates/*.md`; `{{title}}`/`{{office}}` etc. are
 * **runtime** parameter placeholders and pass through untouched.
 */
import { stringify } from "yaml";

// ── Constants ───────────────────────────────────────────────────────

/** Freetext placeholder emitted when a question has no `text:` of its own. */
export const DEFAULT_FREETEXT =
  "_[Freitext für Beschreibungen und dienststellenspezifische Erläuterungen.]_";

/** Fazit callout appended automatically after each section's last question. */
export const FAZIT_CALLOUT = [
  "::: {.callout-tip title='Fazit'}",
  "_[Hier ist Platz für ein Kapitelfazit.]_",
  ":::",
].join("\n");

const AGGREGATIONS_WITHOUT_VALUE = new Set(["count", "share_total"]);
const AGGREGATIONS_WITH_VALUE = new Set([
  "sum",
  "mean",
  "min",
  "max",
  "median",
  "share_group",
]);

// ── Catalog types ───────────────────────────────────────────────────

/** The wrangled-crosstab spec shared by the question's chart and appendix table. */
export interface RawTableSpec {
  data: string;
  filter?: string;
  groupby: { rows: string; cols?: string };
  aggregation?: string;
  value?: string;
  format?: string;
}

export interface SectionEntry {
  section: string;
  /** Markdown body of the section's Definitionen callout. */
  definitions?: string;
}

export interface QuestionEntry {
  title: string;
  /** Template id(s) the question belongs to; omit ⇒ every template. */
  include?: string | string[];
  /** Italic status line under the heading (e.g. "Optional"). */
  comment?: string;
  datenquelle?: string;
  personenkreis?: string;
  /** Figure caption for the chart and caption of the appendix table. */
  caption?: string;
  /** Freetext paragraph; omit/null ⇒ `DEFAULT_FREETEXT`. */
  text?: string | null;
  table: RawTableSpec;
  chart?: {
    type: string;
    stacked?: boolean;
    title?: string;
    alt?: string;
    "alt-intro"?: string;
    caption?: string;
  };
}

export type CatalogEntry = SectionEntry | QuestionEntry;

export function isSectionEntry(e: CatalogEntry): e is SectionEntry {
  return "section" in e;
}

export function isIncluded(include: string | string[] | undefined, id: string): boolean {
  if (include === undefined || include === null) return true;
  return Array.isArray(include) ? include.includes(id) : include === id;
}

// ── Catalog validation ──────────────────────────────────────────────

/**
 * Validate the catalog. Structural defects (an entry that is neither
 * section nor question, a question without `table.data`/`groupby.rows`,
 * a value-op without `value:`) throw; soft issues (unknown include ids,
 * a superfluous `value:`) are returned as warnings.
 */
export function validateCatalog(entries: CatalogEntry[], knownIds: Set<string>): string[] {
  const warnings: string[] = [];
  entries.forEach((entry, i) => {
    const at = `template.questions[${i}]`;
    const hasSection = "section" in entry;
    const hasTitle = "title" in entry;
    if (hasSection === hasTitle) {
      throw new Error(`${at}: entry must have exactly one of \`section:\` or \`title:\`.`);
    }
    if (hasSection) return;

    const q = entry as QuestionEntry;
    if (!q.table || typeof q.table !== "object") {
      throw new Error(`${at} ("${q.title}"): missing \`table:\` spec.`);
    }
    if (!q.table.data) throw new Error(`${at} ("${q.title}"): \`table.data\` is required.`);
    if (!q.table.groupby?.rows) {
      throw new Error(`${at} ("${q.title}"): \`table.groupby.rows\` is required.`);
    }
    const op = q.table.aggregation ?? "count";
    if (AGGREGATIONS_WITH_VALUE.has(op) && !q.table.value) {
      throw new Error(`${at} ("${q.title}"): aggregation \`${op}\` requires \`table.value\`.`);
    }
    if (AGGREGATIONS_WITHOUT_VALUE.has(op) && q.table.value) {
      warnings.push(`${at} ("${q.title}"): aggregation \`${op}\` ignores \`table.value\`.`);
    }
    const ids = Array.isArray(q.include) ? q.include : q.include ? [q.include] : [];
    for (const id of ids) {
      if (!knownIds.has(id)) {
        warnings.push(`${at} ("${q.title}"): include references unknown template id "${id}".`);
      }
    }
  });
  return warnings;
}

// ── Rendering ───────────────────────────────────────────────────────

/** YAML-stringify a spec object, preserving key order and trimming to fence-body form. */
function toYamlBody(obj: Record<string, unknown>): string {
  return stringify(obj).trimEnd();
}

/** Build the (ordered) table spec object emitted into both block types. */
function tableSpecObject(q: QuestionEntry): Record<string, unknown> {
  const t = q.table;
  const spec: Record<string, unknown> = { data: t.data };
  if (t.filter) spec.filter = t.filter;
  spec.groupby = t.groupby.cols ? { rows: t.groupby.rows, cols: t.groupby.cols } : { rows: t.groupby.rows };
  spec.aggregation = t.aggregation ?? "count";
  if (t.value) spec.value = t.value;
  if (t.format) spec.format = t.format;
  return spec;
}

/** Render one question as its in-document subsection (heading … chart … freetext). */
export function renderQuestionBlock(q: QuestionEntry): string {
  // The status line sits directly under the heading (no blank line), as in
  // the historical master layout.
  const heading = q.comment ? `#### ${q.title}\n_${q.comment}_` : `#### ${q.title}`;
  const parts: string[] = [heading];

  const source: string[] = [];
  if (q.datenquelle) source.push(`Datenquelle: ${q.datenquelle}`);
  if (q.personenkreis) source.push(`Personenkreis: ${q.personenkreis}`);
  source.push(`Datensatz: ${q.table.data}`);
  parts.push(`> ${source.join(" · ")}`);

  const chart: Record<string, unknown> = { type: q.chart?.type ?? "bar" };
  if (q.chart?.stacked !== undefined) chart.stacked = q.chart.stacked;
  if (q.chart?.title) chart.title = q.chart.title;
  if (q.chart?.alt) chart.alt = q.chart.alt;
  if (q.chart?.["alt-intro"]) chart["alt-intro"] = q.chart["alt-intro"];
  const caption = q.chart?.caption ?? q.caption;
  if (caption) chart.caption = caption;
  chart.table = tableSpecObject(q);
  parts.push("```chart\n" + toYamlBody(chart) + "\n```");

  parts.push(q.text ?? DEFAULT_FREETEXT);
  return parts.join("\n\n");
}

/** Render one question's appendix table block (`#### title` + ```table```). */
export function renderAppendixTable(q: QuestionEntry): string {
  const spec = tableSpecObject(q);
  const caption = q.caption ?? q.chart?.title;
  if (caption) spec.caption = caption;
  return `#### ${q.title}\n\n` + "```table\n" + toYamlBody(spec) + "\n```";
}

/**
 * Render the catalog for one template id: section headings + Definitionen
 * callouts, each included question, and an automatic Fazit callout after
 * each section's last question. Sections whose questions are all excluded
 * are skipped entirely.
 */
export function renderQuestions(entries: CatalogEntry[], id: string): string {
  const parts: string[] = [];
  let pendingSection: string | null = null;
  let sectionOpen = false;

  const closeSection = () => {
    if (sectionOpen) parts.push(FAZIT_CALLOUT);
    sectionOpen = false;
  };

  for (const entry of entries) {
    if (isSectionEntry(entry)) {
      closeSection();
      const header: string[] = [`### ${entry.section}`];
      if (entry.definitions) {
        header.push(
          `::: {.callout-note title='Definitionen'}\n${entry.definitions.trim()}\n:::`
        );
      }
      pendingSection = header.join("\n\n");
      continue;
    }
    if (!isIncluded(entry.include, id)) continue;
    if (pendingSection !== null) {
      parts.push(pendingSection);
      pendingSection = null;
      sectionOpen = true;
    }
    parts.push(renderQuestionBlock(entry));
  }
  closeSection();
  return parts.join("\n\n");
}

/** Render the appendix tables for one template id (same include filtering). */
export function renderAppendixTables(entries: CatalogEntry[], id: string): string {
  return entries
    .filter((e): e is QuestionEntry => !isSectionEntry(e) && isIncluded(e.include, id))
    .map(renderAppendixTable)
    .join("\n\n");
}

// ── Master segmentation (include markers) ───────────────────────────

const OPEN_MARKER = /^[ \t]*<!--\s*include:\s*(.+?)\s*-->[ \t]*$/;
const CLOSE_MARKER = /^[ \t]*<!--\s*\/include\s*-->[ \t]*$/;

/** A run of lines that belongs either to every template (`ids === null`) or to a specific id set. */
export interface Segment {
  ids: string[] | null;
  lines: string[];
}

function parseIds(list: string): string[] {
  return list.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

/** Split the master into segments, stripping the marker lines. Throws on unbalanced/nested markers. */
export function segmentMaster(master: string): Segment[] {
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

/** All ids referenced by markers (for the unknown-id warning). */
export function markerIds(segments: Segment[]): Set<string> {
  return new Set(segments.flatMap((s) => s.ids ?? []));
}

// ── Assembly ────────────────────────────────────────────────────────

/** Keep always-segments + segments listing `id`; no blank-line cleanup yet. */
function renderFor(segments: Segment[], id: string): string {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg.ids === null || seg.ids.includes(id)) out.push(...seg.lines);
  }
  return out.join("\n");
}

/** Replace the whole-line `{{name}}` placeholder; warns on duplicates, throws when absent. */
function substitutePlaceholder(text: string, name: string, content: string): string {
  const re = new RegExp(`^[ \\t]*\\{\\{${name}\\}\\}[ \\t]*$`, "gm");
  const matches = text.match(re) ?? [];
  if (matches.length === 0) {
    throw new Error(`templates/master.md is missing the {{${name}}} placeholder.`);
  }
  if (matches.length > 1) {
    console.warn(`⚠ {{${name}}} appears ${matches.length} times in master.md — substituting all.`);
  }
  return text.replace(re, () => content);
}

/**
 * Produce the final template text for one id: marker filtering, then
 * `{{questions}}`/`{{tables}}` substitution, then blank-line cleanup.
 */
export function renderTemplate(segments: Segment[], entries: CatalogEntry[], id: string): string {
  let text = renderFor(segments, id);
  text = substitutePlaceholder(text, "questions", renderQuestions(entries, id));
  text = substitutePlaceholder(text, "tables", renderAppendixTables(entries, id));
  // Collapse blank-line runs left by dropped blocks; trim leading blank lines.
  return text.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
}
