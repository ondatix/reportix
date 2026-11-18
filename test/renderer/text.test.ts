/**
 * Text-renderer tests — parameter interpolation must not smuggle markup into
 * the report. `renderText`'s output is assigned via innerHTML by the renderer
 * and read back by the DOCX exporter, so an unescaped parameter value would
 * execute in the preview and travel into the export.
 */
import { describe, it, expect } from "vitest";
import { renderText } from "../../src/modules/renderer/text";

describe("renderText — parameter interpolation", () => {
  it("escapes HTML in parameter values instead of rendering it as markup", () => {
    const html = renderText("Bericht für {{office}}.", {
      office: '<img src=x onerror="alert(1)">',
    });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror=\"");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escapes a script payload", () => {
    const html = renderText("{{title}}", { title: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes single quotes (attribute-context breakout)", () => {
    const html = renderText("{{x}}", { x: "it's" });
    expect(html).toContain("&#39;");
  });

  it("leaves the trusted template's own HTML untouched", () => {
    const html = renderText('<div class="intro">text</div>');
    expect(html).toContain('<div class="intro">');
  });

  it("keeps plain values readable (entities render as typed characters)", () => {
    const html = renderText("{{office}}", { office: "Familie & Soziales" });
    expect(html).toContain("Familie &amp; Soziales");
  });

  it("leaves unknown placeholders in place", () => {
    expect(renderText("{{nope}}", { other: "x" })).toContain("{{nope}}");
  });
});
