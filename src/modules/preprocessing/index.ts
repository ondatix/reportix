/**
 * Preprocessing module — derives additional datasets from the loaded sheets
 * before rendering. The main operation is a **join**: enrich rows in one sheet
 * with columns looked up from another by a shared key (e.g. attach the
 * person's master-data attributes from `Stichtag` onto each `Zeitraum_*`
 * event via `PersNr`).
 *
 * Semantics are **first-match lookup** (not a SQL cross-product): each left
 * row appears at most once in the output, even if several right rows share its
 * key — the first matching right row wins. This keeps counts and shares stable.
 *
 * Self-contained and reusable: depends only on the shared types and the i18n
 * layer (for localized warnings). Never throws — structural problems (missing
 * sheet, missing key, missing column) surface as non-blocking warnings.
 */
import type { DataSet, DataStore, JoinDef, MutationDef, MutationCondition, PreprocessingConfig } from "../types";
import { t } from "../i18n";

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
  config?: PreprocessingConfig
): PreprocessingResult {
  const out: DataStore = { ...store };
  const warnings: PreprocessingWarning[] = [];

  // Mutations first (derive columns on raw sheets), then joins (which can
  // propagate the derived columns to other datasets).
  for (const mutation of config?.mutations ?? []) {
    const { dataset, warnings: w } = runMutation(out, mutation);
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
  m: MutationDef
): { dataset?: DataSet; warnings: PreprocessingWarning[] } {
  const warnings: PreprocessingWarning[] = [];
  const src = `${m.dataset}.${m.column}`;
  const rows = store[m.dataset];

  if (!rows) {
    warnings.push({ source: src, message: t("mutation.missingDataset", { dataset: m.dataset }) });
    return { warnings };
  }
  if (rows.length > 0 && !columnUnion(rows).has(m.from)) {
    warnings.push({ source: src, message: t("mutation.missingColumn", { column: m.from, dataset: m.dataset }) });
    // Proceed: every row fails the condition and receives the `else` value.
  }

  const elseValue = m.else ?? "";
  const result: DataSet = rows.map((row) => ({
    ...row,
    [m.column]: matchesCondition(row[m.from], m.when) ? m.then : elseValue,
  }));

  return { dataset: result, warnings };
}

/** Evaluate the if-else condition against a source value (AND of all predicates). */
function matchesCondition(value: unknown, when?: MutationCondition): boolean {
  // No condition → "is truthy".
  if (!when || Object.keys(when).length === 0) return isTruthy(value);

  const s = asStr(value);
  const num = Number(s);
  const checks: boolean[] = [];

  if (when.equals !== undefined) checks.push(toList(when.equals).some((v) => asStr(v) === s));
  if (when.in !== undefined) checks.push(toList(when.in).some((v) => asStr(v) === s));
  if (when.notEquals !== undefined) checks.push(!toList(when.notEquals).some((v) => asStr(v) === s));
  if (when.contains !== undefined) checks.push(toList(when.contains).some((v) => s.includes(asStr(v))));
  if (when.startsWith !== undefined) checks.push(toList(when.startsWith).some((v) => s.startsWith(asStr(v))));
  if (when.endsWith !== undefined) checks.push(toList(when.endsWith).some((v) => s.endsWith(asStr(v))));
  if (when.matches !== undefined) checks.push(safeRegex(when.matches).test(s));
  if (when.gt !== undefined) checks.push(!Number.isNaN(num) && num > when.gt);
  if (when.gte !== undefined) checks.push(!Number.isNaN(num) && num >= when.gte);
  if (when.lt !== undefined) checks.push(!Number.isNaN(num) && num < when.lt);
  if (when.lte !== undefined) checks.push(!Number.isNaN(num) && num <= when.lte);
  if (when.empty !== undefined) checks.push(when.empty ? s === "" : s !== "");
  if (when.truthy !== undefined) checks.push(when.truthy ? isTruthy(value) : !isTruthy(value));

  // An otherwise-empty `when` object falls back to truthy (defensive).
  return checks.length > 0 ? checks.every(Boolean) : isTruthy(value);
}

function toList<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

function safeRegex(source: string): RegExp {
  try {
    return new RegExp(source);
  } catch {
    return /$.^/; // never matches
  }
}

const TRUTHY = new Set(["true", "ja", "yes", "1"]);
function isTruthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return TRUTHY.has(asStr(value).toLowerCase());
}

function asStr(value: unknown): string {
  return String(value ?? "").normalize("NFC").trim();
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
