/**
 * The `trustedHtml` policy is a validator, not a sanitizer: it passes trusted
 * structural markup through untouched but throws on active-content constructs
 * that should never reach an `innerHTML` sink. jsdom has no `window.trustedTypes`,
 * so this exercises the fallback path — which runs the same validation.
 */
import { describe, it, expect } from "vitest";
import { trustedHtml, trustedReportHtml } from "../../src/modules/shared/trusted-html";

describe("trustedHtml — validator", () => {
  it("passes trusted structural HTML through byte-for-byte", () => {
    const markup =
      '<section><h2 id="s1">Titel</h2><div class="callout-note"><p>Text</p></div>' +
      '<figure><figcaption>Bild</figcaption></figure>' +
      '<a href="https://www.ondatix.org/" target="_blank" rel="noopener">Link</a>' +
      '<a href="#main-content">Sprung</a></section>';
    expect(trustedHtml(markup)).toBe(markup);
  });

  it("allows shell links but rejects them in report output", () => {
    const withLink = '<p>siehe <a href="https://x.example">hier</a></p>';
    expect(trustedHtml(withLink)).toBe(withLink);
    expect(() => trustedReportHtml(withLink)).toThrow(/<a> element/);
  });

  it("trustedReportHtml passes link-free report HTML and still blocks scripts", () => {
    const clean = '<section><h3>Titel</h3><p>Text</p></section>';
    expect(trustedReportHtml(clean)).toBe(clean);
    expect(() => trustedReportHtml('<p><script>x</script></p>')).toThrow(/refused/);
  });

  it.each([
    ["<script> element", '<p>x</p><script>alert(1)</script>'],
    ["self-closing script", '<script src="x.js"/>'],
    ["inline event handler", '<img src="x" onerror="alert(1)">'],
    ["javascript: URL", '<a href="javascript:alert(1)">x</a>'],
    ["iframe", '<iframe src="https://evil.example"></iframe>'],
    ["object", '<object data="x"></object>'],
    ["base", '<base href="https://evil.example/">'],
  ])("throws on %s", (_label, markup) => {
    expect(() => trustedHtml(markup)).toThrow(/refused HTML/);
  });

  it("does not flag the word 'on' in prose or a normal attribute", () => {
    const markup = '<p>Informationen on demand</p><input type="radio" name="on-call">';
    expect(trustedHtml(markup)).toBe(markup);
  });
});
