/**
 * Column-transform registry — the escape hatch for derived columns the
 * declarative `when`/`cases` mutation form cannot express (date arithmetic,
 * running totals, lookups against a table, …).
 *
 * The point of this module is that **`src/` stays domain-free**: the
 * transforms themselves live next to the config they belong to, in
 * `config/functions/*.ts`, and are picked up here the same way `loadConfig`
 * globs `config/*.yaml`. Adding a project-specific derivation means adding a
 * file under `config/functions/` and naming it from `config/data.yaml` — no
 * change anywhere in `src/`.
 *
 * A transform is **column-wise, not row-wise**: it receives one array per
 * `from:` column (aligned by row index) and returns the finished column as an
 * array of the same length. That keeps vectorized implementations natural and
 * makes the contract easy to check — the preprocessing module rejects a
 * wrong-length or non-array result rather than writing ragged rows.
 *
 * Registration is by **file-scoped export name**, resolved at build time.
 * Nothing is evaluated from a string: there is no `eval`/`new Function` here,
 * so the strict CSP (`script-src` without `'unsafe-eval'`) is unaffected.
 */

/** Everything a transform gets besides its columns. */
export interface TransformContext {
  /** Number of rows in the dataset — the required length of the returned array. */
  rowCount: number;
  /** The mutation's `options:` block, passed through verbatim (never undefined). */
  options: Record<string, unknown>;
  /** The dataset the column is being added to, for error messages. */
  dataset: string;
  /** The column being derived, for error messages. */
  column: string;
}

/**
 * One derived column. `columns[i]` is the full column named by the mutation's
 * `from[i]`, so `columns[0][r]` and `columns[1][r]` belong to the same row.
 * Returns the new column, one entry per row, in row order.
 *
 * Throwing is allowed — the caller catches and turns it into a non-blocking
 * warning — but returning a value for every row is friendlier.
 */
export type ColumnTransform = (columns: unknown[][], ctx: TransformContext) => unknown[];

export type TransformRegistry = Record<string, ColumnTransform>;

/**
 * Build the registry from every named function exported by
 * `config/functions/*.ts`. Non-function exports are skipped, so a module may
 * also export types and constants. A duplicate name across two files is a
 * config error the caller reports; last one wins, and the clash is returned.
 */
export function buildRegistry(
  modules: Record<string, Record<string, unknown>>
): { registry: TransformRegistry; duplicates: string[] } {
  const registry: TransformRegistry = {};
  const duplicates: string[] = [];
  // Sort by path so the result does not depend on glob iteration order.
  for (const path of Object.keys(modules).sort()) {
    for (const [name, value] of Object.entries(modules[path] ?? {})) {
      if (typeof value !== "function") continue;
      if (name in registry) duplicates.push(name);
      registry[name] = value as ColumnTransform;
    }
  }
  return { registry, duplicates };
}

/**
 * The registry for this project, bundled at build time. Mirrors `loadConfig`'s
 * glob of `/config/*.yaml`, so both halves of a derivation — the YAML that
 * declares it and the TypeScript that computes it — sit in `config/`.
 */
export function loadTransforms(): { registry: TransformRegistry; duplicates: string[] } {
  const modules = import.meta.glob<Record<string, unknown>>("/config/functions/*.ts", {
    eager: true,
  });
  return buildRegistry(modules);
}
