/**
 * Shared leaf-condition matcher — the single evaluator behind the `when:`
 * predicate in preprocessing mutations and the `check:` rule in data
 * validation, so the two condition DSLs (and their operators) never drift
 * apart. Depends only on the `MutationCondition` shape in `../types`.
 */
import type { ConfigRef, MutationCondition } from "../types";

/** `{ from_config: "path" }` — a config reference not (yet) resolved to a value. */
export function isConfigRef(value: unknown): value is ConfigRef {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).from_config === "string"
  );
}

/** Evaluate a leaf condition against a source value (AND of all provided keys). */
export function matchesLeafCondition(value: unknown, when?: MutationCondition): boolean {
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

  // An otherwise-empty condition object falls back to truthy (defensive).
  return checks.length > 0 ? checks.every(Boolean) : isTruthy(value);
}

/**
 * A condition value as a list. A config reference still unresolved here
 * (preprocessing resolves them first; validation never does) matches nothing
 * rather than being compared as "[object Object]".
 */
function toList<T>(v: T | T[] | ConfigRef): T[] {
  if (isConfigRef(v)) return [];
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
export function isTruthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return TRUTHY.has(asStr(value).toLowerCase());
}

export function asStr(value: unknown): string {
  return String(value ?? "").normalize("NFC").trim();
}
