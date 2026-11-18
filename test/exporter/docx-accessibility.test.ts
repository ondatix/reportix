/**
 * @vitest-environment jsdom
 *
 * Accessibility of the exported DOCX — the deliverable people actually pass
 * on. The report DOM is built by the real renderers (a fixture table, text
 * with headings), run through `buildDocx`, packed, and the resulting OOXML is
 * inspected directly: that is what Word's Accessibility Checker and screen
 * readers read, so asserting on it catches what a preview-only test cannot.
 *
 * Charts are the exception: Chart.js needs a real 2D canvas, so the figure is
 * assembled here in the shape `renderChart` produces (canvas with role="img"
 * and the alt text as aria-label, plus a figcaption).
 */
import { describe, it, beforeAll, expect } from "vitest";
import { inflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { Packer } from "docx";
import { buildDocx } from "../../src/modules/exporter";
import { renderText } from "../../src/modules/renderer/text";
import { renderTable } from "../../src/modules/renderer/table";
import { parseTemplate } from "../../src/modules/template";
import { loadDataStore, TEMPLATE_PATH } from "../alt-text/helpers";
import type { TableBlock } from "../../src/modules/types";

/** A valid 1×1 PNG — jsdom's canvas cannot rasterise, so toDataURL is stubbed. */
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const CHART_ALT = "Balkendiagramm: Anzahl der Beschäftigten nach Geschlecht. männlich: 12, weiblich: 15.";
const PART_ALTS = ["Teil 1 von 2: Balkendiagramm, A7–E10.", "Teil 2 von 2: Balkendiagramm, E11–E14."];
const CHART_CAPTION = "Beschäftigte nach Geschlecht.";

/**
 * Read one file out of a zip archive. Enough of the format for what docx
 * writes (stored or deflated entries, no zip64), so the test needs no zip
 * library of its own.
 */
function readZipEntry(zip: Buffer, name: string): string {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip archive");
  const entries = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const entryName = zip.toString("utf8", p + 46, p + 46 + nameLen);
    if (entryName === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${name} not in archive`);
}

/** First table block of the generated full template that the fixture can fill. */
function fixtureTable(): { block: TableBlock; data: ReturnType<typeof loadDataStore>["store"][string] } {
  const { store } = loadDataStore();
  const block = parseTemplate(readFileSync(TEMPLATE_PATH, "utf8")).find(
    (b): b is TableBlock => b.type === "table" && !!store[b.spec.data] && !!b.spec.caption
  )!;
  return { block, data: store[block.spec.data] };
}

/** Build the report DOM the way the preview does, inside a lang="de" article. */
function buildReport(): { container: HTMLElement; caption: string } {
  document.body.replaceChildren();
  const container = document.createElement("article");
  container.lang = "de";
  document.body.appendChild(container);

  container.innerHTML = renderText(
    ["# Schuljahresbericht", "", "## Schülerschaft", "", "Text.", "", "### Jahrgangsstufen", "", "Text."].join("\n")
  );

  const figure = document.createElement("figure");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", CHART_ALT);
  canvas.toDataURL = () => PNG_1X1;
  const figcaption = document.createElement("figcaption");
  figcaption.textContent = CHART_CAPTION;
  figure.append(canvas, figcaption);
  container.appendChild(figure);

  // A chart split into partial plots: one wrapped canvas per part.
  const split = document.createElement("figure");
  for (const alt of PART_ALTS) {
    const part = document.createElement("div");
    part.className = "chart-part";
    const c = document.createElement("canvas");
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", alt);
    c.toDataURL = () => PNG_1X1;
    part.appendChild(c);
    split.appendChild(part);
  }
  container.appendChild(split);

  const { block, data } = fixtureTable();
  const { threshold } = loadDataStore();
  renderTable(block.spec, data, container, { smallestGroup: threshold });
  return { container, caption: block.spec.caption! };
}

describe("DOCX export accessibility", () => {
  let documentXml: string;
  let stylesXml: string;
  let coreXml: string;
  let tableCaption: string;

  beforeAll(async () => {
    const { container, caption } = buildReport();
    tableCaption = caption;
    const doc = buildDocx(container, {
      locale: "de-DE",
      document: { title: "Schuljahresbericht" },
    } as Parameters<typeof buildDocx>[1]);
    const zip = await Packer.toBuffer(doc);
    documentXml = readZipEntry(zip, "word/document.xml");
    stylesXml = readZipEntry(zip, "word/styles.xml");
    coreXml = readZipEntry(zip, "docProps/core.xml");
  });

  it("carries each chart's alt text onto the embedded image", () => {
    const docPr = documentXml.match(/<wp:docPr\b[^>]*>/g) ?? [];
    expect(docPr).toHaveLength(1 + PART_ALTS.length);
    expect(docPr[0]).toContain(`descr="${CHART_ALT}"`);
  });

  it("embeds every part of a split chart as its own image with its own alt text", () => {
    const docPr = documentXml.match(/<wp:docPr\b[^>]*>/g) ?? [];
    PART_ALTS.forEach((alt, i) => expect(docPr[1 + i]).toContain(`descr="${alt}"`));
  });

  it("keeps the chart caption as visible text", () => {
    expect(documentXml).toContain(CHART_CAPTION);
  });

  it("maps section headings to Word heading styles, but not the title", () => {
    const styles = [...documentXml.matchAll(/<w:pStyle w:val="(Heading\d)"\/>/g)].map((m) => m[1]);
    expect(styles).toEqual(["Heading2", "Heading3"]);
    // The title is a centred paragraph, not Heading1 — present, but unstyled.
    expect(documentXml).toContain("Schuljahresbericht");
  });

  it("marks the table's header row as a repeating header row", () => {
    const tables = documentXml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? [];
    expect(tables).toHaveLength(1);
    const rows = tables[0].match(/<w:tr>[\s\S]*?<\/w:tr>/g) ?? [];
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0]).toMatch(/<w:tblHeader\b/);
    // Only the <thead> row — a body row flagged as header would repeat too.
    for (const row of rows.slice(1)) expect(row).not.toMatch(/<w:tblHeader\b/);
  });

  it("exports the table caption right above its table, kept with it", () => {
    const captionAt = documentXml.indexOf(tableCaption);
    const tableAt = documentXml.indexOf("<w:tbl>");
    expect(captionAt).toBeGreaterThan(-1);
    expect(captionAt).toBeLessThan(tableAt);
    const captionParagraph = documentXml.slice(documentXml.lastIndexOf("<w:p>", captionAt), captionAt);
    expect(captionParagraph).toContain("<w:keepNext/>");
  });

  it("declares the document language from the preview's lang", () => {
    const docDefaults = stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)![0];
    expect(docDefaults).toMatch(/<w:lang w:val="de-DE"/);
  });

  it("sets a document title in the file properties", () => {
    expect(coreXml).toContain("<dc:title>Schuljahresbericht</dc:title>");
  });
});
