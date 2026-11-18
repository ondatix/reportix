/**
 * Preprocessing module — derives additional datasets from the loaded sheets
 * before rendering. The main operation is a **join**: enrich rows in one sheet
 * with columns looked up from another by a shared key (e.g. attach the
 * pupil's master-data attributes from `Schueler` onto each `Zeitraum_*`
 * event via `SchuelerID`).
 *
 * Semantics are **first-match lookup** (not a SQL cross-product): each left
 * row appears at most once in the output, even if several right rows share its
 * key — the first matching right row wins. This keeps counts and shares stable.
 *
 * Self-contained and reusable: depends only on the shared types and the i18n
 * layer (for localized warnings). Never throws — structural problems (missing
 * sheet, missing key, missing column) surface as non-blocking warnings.
 */
import type { DataSet, DataStore, JoinDef, MutationDef, MutationCase, MutationCondition, PreprocessingConfig } from "../types";
import { fromColumns } from "../types";
import type { TransformRegistry } from "../transforms";
import { getAtPath } from "../shared/path";
import { t } from "../i18n";
import { matchesLeafCondition, isConfigRef } from "../shared/condition";

export interface PreprocessingWarning {
  source: string;
  message: string;
}

export interface PreprocessingResult {
  store: DataStore;
  warnings: PreprocessingWarning[];
}

/**
 * Restrict a preprocessing config to the datasets actually present in the
 * store. When the data step only requests a template's required sheets (see
 * `requiredDataForBlocks` in the config module), mutations and joins for the
 * unrequested sheets are expected to be inapplicable — without this filter
 * they would surface as "dataset not found" warnings. Joins are checked
 * sequentially, so a join whose `right` is an earlier (kept) join output
 * stays.
 */
export function preprocessingForStore(
  store: DataStore,
  config?: PreprocessingConfig
): PreprocessingConfig | undefined {
  if (!config) return config;
  const available = new Set(Object.keys(store));
  const mutations = (config.mutations ?? []).filter((m) => available.has(m.dataset));
  const joins: JoinDef[] = [];
  for (const join of config.joins ?? []) {
    if (available.has(join.left) && available.has(join.right)) {
      joins.push(join);
      available.add(join.name);
    }
  }
  return { mutations, joins };
}

/**
 * Apply every configured join in order, returning a new store with the join
 * outputs added (or overwritten when a join's `name` equals an existing key).
 * The input store is not mutated. Joins run sequentially against the evolving
 * store, so a later join may reference an earlier join's output.
 */
export function applyPreprocessing(
  store: DataStore,
  config?: PreprocessingConfig,
  transforms?: TransformRegistry,
  settings?: Record<string, unknown>
): PreprocessingResult {
  const out: DataStore = { ...store };
  const warnings: PreprocessingWarning[] = [];

  // Mutations first (derive columns on raw sheets), then joins (which can
  // propagate the derived columns to other datasets).
  for (const mutation of config?.mutations ?? []) {
    const { dataset, warnings: w } = runMutation(out, mutation, transforms, settings);
    warnings.push(...w);
    if (dataset) out[mutation.dataset] = dataset;
  }

  for (const join of config?.joins ?? []) {
    const { dataset, warnings: w } = runJoin(out, join);
    warnings.push(...w);
    if (dataset) out[join.name] = dataset;
  }

  return { store: out, warnings };
}

// ── Mutations (derived columns) ──────────────────────────────────────

function runMutation(
  store: DataStore,
  m: MutationDef,
  transforms?: TransformRegistry,
  settings?: Record<string, unknown>
): { dataset?: DataSet; warnings: PreprocessingWarning[] } {
  const warnings: PreprocessingWarning[] = [];
  const src = `${m.dataset}.${m.column}`;
  const rows = store[m.dataset];
  const sources = fromColumns(m);

  if (!rows) {
    warnings.push({ source: src, message: t("mutation.missingDataset", { dataset: m.dataset }) });
    return { warnings };
  }

  const present = rows.length > 0 ? columnUnion(rows) : undefined;
  const missing = present ? sources.filter((c) => !present.has(c)) : [];
  if (missing.length > 0) {
    // A condition mutation proceeds (every row falls through to `else`); an
    // `fn` mutation does not — a transform handed columns of `undefined` would
    // produce a column of silent nonsense rather than nothing. The two say so
    // differently, because the outcome differs.
    const key = m.fn ? "mutation.missingColumnFn" : "mutation.missingColumn";
    warnings.push({
      source: src,
      message: t(key, { column: missing.join(", "), dataset: m.dataset, target: m.column }),
    });
    if (m.fn) return { warnings };
  }

  if (m.fn) {
    const result = runTransform(rows, m, sources, transforms, src, settings);
    return { dataset: result.dataset, warnings: [...warnings, ...result.warnings] };
  }

  const from = sources[0];

  // Top-level `when`/`then` (if present) is the first elif branch, followed by `cases`.
  // `{ from_config }` values are resolved into fresh case objects, never
  // written back into the config's own.
  const cases: MutationCase[] = [];
  if (m.when !== undefined || m.then !== undefined) cases.push({ when: m.when ?? {}, then: m.then ?? "" });
  if (m.cases) cases.push(...m.cases);
  const resolvedCases = cases.map((c) => ({ ...c, when: resolveConditionRefs(c.when, settings) }));

  const elseValue = m.else ?? "";
  let elseHits = 0;
  const result: DataSet = rows.map((row) => {
    const value = row[from];
    const hit = resolvedCases.find((c) => matchesLeafCondition(value, c.when));
    if (!hit) elseHits++;
    return { ...row, [m.column]: hit ? hit.then : elseValue };
  });

  if (elseHits > 0 && m.elseWarning) {
    warnings.push({
      source: src,
      message: `${t("mutation.elseHit", { dataset: m.dataset, column: m.column, count: elseHits })} ${m.elseWarning}`,
    });
  }

  return { dataset: result, warnings };
}

/**
 * Compute a derived column with a registered transform (see the transforms
 * module). The transform is column-wise: it gets one array per `from:` column
 * and returns the finished column. Every failure mode — unknown name, a throw,
 * a non-array or wrong-length result — degrades to a warning and leaves the
 * dataset untouched, so a broken transform can never write ragged rows or
 * abort the pipeline.
 */
function runTransform(
  rows: DataSet,
  m: MutationDef,
  sources: string[],
  transforms: TransformRegistry | undefined,
  src: string,
  settings?: Record<string, unknown>
): { dataset?: DataSet; warnings: PreprocessingWarning[] } {
  const fn = transforms?.[m.fn!];
  if (!fn) {
    return { warnings: [{ source: src, message: t("mutation.unknownFn", { fn: m.fn! }) }] };
  }

  const columns = sources.map((name) => rows.map((row) => row[name]));
  let out: unknown;
  try {
    out = fn(columns, {
      rowCount: rows.length,
      options: resolveOptions(m.options, settings),
      dataset: m.dataset,
      column: m.column,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { warnings: [{ source: src, message: t("mutation.fnFailed", { fn: m.fn!, detail }) }] };
  }

  if (!Array.isArray(out) || out.length !== rows.length) {
    return {
      warnings: [
        {
          source: src,
          message: t("mutation.fnBadResult", {
            fn: m.fn!,
            expected: rows.length,
            got: Array.isArray(out) ? out.length : typeof out,
          }),
        },
      ],
    };
  }

  return { dataset: rows.map((row, i) => ({ ...row, [m.column]: out[i] })), warnings: [] };
}

/** Condition keys whose value may be a `{ from_config }` reference. */
const REF_KEYS = ["equals", "in", "notEquals", "contains", "startsWith", "endsWith"] as const;

/**
 * Replace `{ from_config: "path" }` values in a condition with what that path
 * holds in the resolved AppConfig — how a mutation reads a value list the user
 * picked in the data-validation step (e.g. which profiles count as STEM).
 * An unresolvable path becomes an empty list, which matches nothing. Returns a
 * copy; the config's own condition object is left untouched.
 */
function resolveConditionRefs(
  when: MutationCondition,
  settings: Record<string, unknown> | undefined
): MutationCondition {
  if (!REF_KEYS.some((k) => isConfigRef(when[k]))) return when;
  const out: Record<string, unknown> = { ...when };
  for (const key of REF_KEYS) {
    const v = when[key];
    if (!isConfigRef(v)) continue;
    const resolved = getAtPath(settings ?? {}, v.from_config);
    out[key] = Array.isArray(resolved)
      ? resolved
      : resolved === undefined || resolved === null
        ? []
        : [resolved];
  }
  return out as MutationCondition;
}

/**
 * Resolve a mutation's `options:` before handing them to a transform.
 *
 * A value written as `{ from_config: "dotted.path" }` is looked up in
 * `settings` — the **resolved** AppConfig, i.e. after the user's parameter
 * answers have been merged in. That is the difference between a transform
 * seeing the config's bundled default and seeing what the user actually
 * entered; a literal in the YAML would only ever be the former.
 *
 * Anything else passes through untouched, and an unresolvable path yields
 * `undefined` (the transform decides what that means) rather than an error.
 */
function resolveOptions(
  options: Record<string, unknown> | undefined,
  settings: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!options) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    const ref =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>).from_config
        : undefined;
    out[key] = typeof ref === "string" ? getAtPath(settings ?? {}, ref) : value;
  }
  return out;
}

interface ResolvedSelect {
  /** Source column in the right dataset. */
  from: string;
  /** Output column on the left rows. */
  as: string;
}

function runJoin(
  store: DataStore,
  join: JoinDef
): { dataset?: DataSet; warnings: PreprocessingWarning[] } {
  const warnings: PreprocessingWarning[] = [];
  const src = join.name || `${join.left}⋈${join.right}`;

  const left = store[join.left];
  const right = store[join.right];
  const leftKey = join.leftOn ?? join.on;
  const rightKey = join.rightOn ?? join.on;

  if (!left) {
    warnings.push({ source: src, message: t("join.missingLeft", { sheet: join.left }) });
    return { warnings };
  }
  if (!right) {
    warnings.push({ source: src, message: t("join.missingRight", { sheet: join.right }) });
    return { warnings };
  }
  if (!leftKey || !rightKey) {
    warnings.push({ source: src, message: t("join.missingKey", { name: src }) });
    return { warnings };
  }

  const leftCols = columnUnion(left);
  const rightCols = columnUnion(right);
  const prefix = join.prefix ?? "";
  const type = join.type === "inner" ? "inner" : "left";

  const selects = resolveSelects(join, rightCols, rightKey, leftCols, prefix, src, warnings);

  // Lookup index: normalized right-key value → first matching right row.
  const index = new Map<string, Record<string, unknown>>();
  for (const r of right) {
    const k = normalizeKey(r[rightKey]);
    if (k !== "" && !index.has(k)) index.set(k, r);
  }

  const result: DataSet = [];
  let matched = 0;
  for (const lrow of left) {
    const k = normalizeKey(lrow[leftKey]);
    const match = k === "" ? undefined : index.get(k);

    if (!match) {
      if (type === "inner") continue;
      const row = { ...lrow };
      for (const sel of selects) if (!(sel.as in row)) row[sel.as] = "";
      if (join.indicator) row[join.indicator] = false;
      result.push(row);
      continue;
    }

    matched++;
    const row = { ...lrow };
    for (const sel of selects) row[sel.as] = match[sel.from];
    if (join.indicator) row[join.indicator] = true;
    result.push(row);
  }

  if (matched === 0 && left.length > 0) {
    warnings.push({ source: src, message: t("join.noMatches", { left: join.left, right: join.right }) });
  }

  return { dataset: result, warnings };
}

/**
 * Resolve the right columns to copy. Explicit `select` entries are validated
 * against the right schema (missing ones warn and are skipped). When `select`
 * is omitted, copy every right column except the key and any already present
 * on the left (enrichment), so re-running a join doesn't clobber base columns.
 */
function resolveSelects(
  join: JoinDef,
  rightCols: Set<string>,
  rightKey: string,
  leftCols: Set<string>,
  prefix: string,
  src: string,
  warnings: PreprocessingWarning[]
): ResolvedSelect[] {
  if (join.select && join.select.length > 0) {
    const out: ResolvedSelect[] = [];
    for (const entry of join.select) {
      const from = typeof entry === "string" ? entry : entry.column;
      const asName = typeof entry === "string" ? entry : entry.as ?? entry.column;
      if (!rightCols.has(from)) {
        warnings.push({ source: src, message: t("join.missingColumn", { column: from, sheet: join.right }) });
        continue;
      }
      out.push({ from, as: prefix + asName });
    }
    return out;
  }

  return [...rightCols]
    .filter((c) => c !== rightKey && !leftCols.has(prefix + c))
    .map((c) => ({ from: c, as: prefix + c }));
}

/** Union of column names across all rows (xlsx omits empty cells per row). */
function columnUnion(rows: DataSet): Set<string> {
  const cols = new Set<string>();
  for (const row of rows) for (const k of Object.keys(row)) cols.add(k);
  return cols;
}

/** Normalize a key value for matching: string, NFC, trimmed, whitespace-collapsed. */
function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}
