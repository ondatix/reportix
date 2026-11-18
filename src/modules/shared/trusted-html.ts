/**
 * The single TrustedHTML mint for the app.
 *
 * `nginx.conf` sends `require-trusted-types-for 'script'`, so in Chromium every
 * write to an injection sink (`innerHTML`, …) must be a `TrustedHTML` value, not
 * a string, or the assignment throws. Exactly two sinks in this codebase feed a
 * string into `innerHTML`:
 *
 *   • `src/app.ts` — the static app-shell markup (only `t()` program strings
 *     interpolated).
 *   • `src/modules/renderer` — the rendered report HTML from `renderText`, whose
 *     parameter values are already HTML-escaped before Markdown parsing and
 *     whose template markup is bundled at build time (not user-supplied).
 *
 * The shell routes through `trustedHtml()`; the report through
 * `trustedReportHtml()`. The primary injection defense stays where it already
 * is — escaping at `renderText`, bundled templates — so this policy is a
 * **validator, not a sanitizer**: it passes the markup through untouched, but
 * throws if it contains a script element, an inline event handler, a
 * `javascript:` URL, or a nested-context / plugin element. Trusted structural
 * HTML (headings, callout divs, figures, the shell's landmarks) never trips
 * these; a genuine injection that slipped past the escape fails loudly at the
 * sink instead of rendering.
 *
 * `trustedReportHtml()` adds one rule on top: **no `<a>` element**. The report
 * templates carry no links, and a parameter value that rendered to one would be
 * a Markdown-link injection (`[x](…)` → `<a href="…">`) — the report prose has
 * no legitimate reason to hyperlink, so any anchor in that output is rejected.
 * The shell's own links (skip link, logo) go through `trustedHtml()`, which
 * still allows them.
 *
 * Where Trusted Types is unavailable — Firefox, Safari, jsdom (the a11y tests) —
 * `window.trustedTypes` is undefined and `trustedHtml` still runs the same
 * validation before returning the string.
 */

interface TrustedTypePolicy {
  createHTML(input: string): unknown;
}
interface TrustedTypePolicyFactory {
  createPolicy(
    name: string,
    rules: { createHTML: (input: string) => string }
  ): TrustedTypePolicy;
}

/** Markup that must never reach an `innerHTML` sink, whatever its source. */
const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/<script[\s/>]/i, "<script> element"],
  [/<(iframe|object|embed|base)[\s/>]/i, "nested-context / plugin element"],
  [/\son[a-z]+\s*=/i, "inline event handler attribute"],
  [/(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i, "javascript: URL"],
];

/**
 * Throw if `markup` carries an active-content construct. Not a sanitizer — it
 * never rewrites — so trusted HTML passes straight through and an injection
 * throws where it would otherwise be assigned.
 */
function assertInert(markup: string): string {
  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(markup)) {
      throw new Error(`trustedHtml: refused HTML containing ${label}`);
    }
  }
  return markup;
}

/** The report output must contain no hyperlinks (see file header). */
function assertNoLinks(markup: string): void {
  if (/<a[\s/>]/i.test(markup)) {
    throw new Error("trustedHtml: refused report HTML containing an <a> element");
  }
}

const factory: TrustedTypePolicyFactory | undefined =
  typeof window !== "undefined"
    ? (window as unknown as { trustedTypes?: TrustedTypePolicyFactory }).trustedTypes
    : undefined;

// Created once at module load, never inside `initApp` — that re-runs on every
// locale switch and a second `createPolicy("reportix-html", …)` throws.
const policy: TrustedTypePolicy | undefined = factory
  ? factory.createPolicy("reportix-html", { createHTML: assertInert })
  : undefined;

/**
 * Validate `markup` and mint a `TrustedHTML` value for assignment to an
 * `innerHTML` sink. Returns a `string` to the type system (lib.dom has no
 * `TrustedHTML` type and the sink setters are typed `string`); the runtime
 * value is `TrustedHTML` in Chromium and a plain (validated) string elsewhere.
 */
export function trustedHtml(markup: string): string {
  return (policy ? policy.createHTML(markup) : assertInert(markup)) as string;
}

/**
 * Like {@link trustedHtml}, but also rejects any `<a>` element — for the
 * rendered report sink, whose templates carry no links and where an anchor
 * signals a Markdown-link injection through a parameter value.
 */
export function trustedReportHtml(markup: string): string {
  assertNoLinks(markup);
  return trustedHtml(markup);
}
