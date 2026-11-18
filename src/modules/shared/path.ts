/**
 * Dotted-path lookup into a plain object tree.
 *
 * Shared by the parameters module (resolving a parameter's `bind:` preset) and
 * the preprocessing module (resolving a mutation option's `from_config:`
 * reference), so the two cannot disagree about what `a.b.c` means.
 */
export function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}
