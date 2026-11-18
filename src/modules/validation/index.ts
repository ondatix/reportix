/**
 * Data validation module — runs config-defined row-level checks against the
 * loaded (and preprocessed) DataStore, so bad or unexpected source values
 * surface as visible warnings instead of quietly rendering wrong numbers.
 *
 * Self-contained and reusable: depends only on the shared condition matcher
 * (`../shared/condition`, also used by the preprocessing module's mutations)
 * and the i18n layer. Never throws — structural problems (missing dataset,
 * missing column) surface as non-blocking warnings, same as preprocessing.
 */
import type { DataSet, DataStore, ValidationCondition, ValidationConfig } from "../types";
import { filterColumnMissing, isFilterActive } from "../aggregation";
import { matchesLeafCondition } from "../shared/condition";
import { t } from "../i18n";

export interface ValidationWarning {
  source: string;
  message: string;
}

/**
 * Report every template block whose `filter:` names a column the dataset does
 * not carry. `applyFilter` treats such a filter as a no-op, so the block still
 * renders — but over the *unfiltered* Personenkreis, which is far harder to
 * spot than an empty chart. One warning per dataset/column pair, not per
 * block: the same filter typically repeats across a section's questions.
 */
export interface FilteredSpec {
  /** Dataset the block reads (a sheet or a preprocessing output). */
  data: string;
  /** The block's `filter:` column, if any. */
  filter?: string;
}

export function checkFilterColumns(
  specs: FilteredSpec[],
  store: DataStore
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const seen = new Set<string>();

  for (const spec of specs) {
    if (!isFilterActive(spec.filter)) continue;
    const key = `${spec.data}.${spec.filter}`;
    if (seen.has(key)) continue;

    const rows = store[spec.data];
    // A missing dataset is already reported by the mapping step; only flag the
    // filter when the dataset itself loaded fine.
    if (!rows || rows.length === 0) continue;
    if (!filterColumnMissing(rows, spec.filter)) continue;

    seen.add(key);
    warnings.push({
      source: key,
      message: t("validation.missingFilterColumn", { column: spec.filter, dataset: spec.data }),
    });
  }

  return warnings;
}

/**
 * Restrict a validation config to the rules whose dataset is present in the
 * store — the counterpart of `preprocessingForStore`. The data step only
 * requests the sheets the selected template needs, so a rule on a sheet that
 * template never uses (e.g. `Zeitraum_Beurlaubung` in the mandatory template)
 * is expected to be inapplicable, not a "dataset not found" problem.
 */
export function validationForStore(
  store: DataStore,
  config?: ValidationConfig
): ValidationConfig | undefined {
  if (!config) return config;
  return { ...config, rules: (config.rules ?? []).filter((r) => r.dataset in store) };
}

/**
 * Run every configured rule against `store`, returning one warning per rule
 * that has at least one failing row (not one per row — that would flood the
 * warnings list on a real dataset). The warning names the dataset, column,
 * and failing-row count, with the rule's optional `definition` appended.
 */
export function runValidation(store: DataStore, config?: ValidationConfig): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const rule of config?.rules ?? []) {
    const src = `${rule.dataset}.${rule.column}`;
    const rows = store[rule.dataset];

    if (!rows) {
      warnings.push({ source: src, message: t("validation.missingDataset", { dataset: rule.dataset }) });
      continue;
    }
    if (rows.length > 0 && !columnUnion(rows).has(rule.column)) {
      warnings.push({ source: src, message: t("validation.missingColumn", { column: rule.column, dataset: rule.dataset }) });
      continue;
    }

    const failCount = rows.reduce((n, row) => (evaluateCondition(row[rule.column], rule.check) ? n : n + 1), 0);
    if (failCount > 0) {
      const generic = t("validation.ruleFailed", { dataset: rule.dataset, column: rule.column, count: failCount });
      warnings.push({ source: src, message: rule.definition ? `${generic} ${rule.definition}` : generic });
    }
  }

  return warnings;
}

/**
 * Evaluate a validation condition tree against one value. `and`/`or`/`not`
 * combine with any leaf predicate keys present on the same object — all via
 * AND, mirroring how a mutation's `when:` already ANDs its own keys.
 */
function evaluateCondition(value: unknown, cond: ValidationCondition | undefined): boolean {
  if (!cond) return true;

  const results: boolean[] = [];
  if (cond.and) results.push(cond.and.every((c) => evaluateCondition(value, c)));
  if (cond.or) results.push(cond.or.some((c) => evaluateCondition(value, c)));
  if (cond.not) results.push(!evaluateCondition(value, cond.not));

  const { and: _and, or: _or, not: _not, ...leaf } = cond;
  if (Object.keys(leaf).length > 0) results.push(matchesLeafCondition(value, leaf));

  // No predicate at all (bare `{}`) is vacuously satisfied.
  return results.length > 0 ? results.every(Boolean) : true;
}

/** Union of column names across all rows (xlsx omits empty cells per row). */
function columnUnion(rows: DataSet): Set<string> {
  const cols = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) cols.add(key);
  return cols;
}
