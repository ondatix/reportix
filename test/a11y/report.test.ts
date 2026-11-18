/**
 * @vitest-environment jsdom
 *
 * Accessibility regression tests for the rendered report output — the part
 * that ends up in the DOCX as well as on screen.
 *
 * Charts are out of scope here: Chart.js needs a real 2D canvas context,
 * which jsdom does not provide. Their alt text is covered by the golden
 * suites in `test/alt-text/`, and their rendered shape by the `verify` skill.
 * What this covers is the table and prose rendering, plus the document
 * structure (numbering + table of contents) applied on top.
 */
import { describe, it, beforeEach, expect } from "vitest";
import { renderTable } from "../../src/modules/renderer/table";
import { renderText } from "../../src/modules/renderer/text";
import { applyDocumentStructure } from "../../src/modules/renderer";
import { parseTemplate } from "../../src/modules/template";
import { loadDataStore, TEMPLATE_PATH } from "../alt-text/helpers";
import { expectNoViolations, mountRoot } from "./helpers";
import { readFileSync } from "node:fs";
import type { TableBlock } from "../../src/modules/types";

/** Every table block of the generated full template, in document order. */
function tableBlocks(): TableBlock[] {
  return parseTemplate(readFileSync(TEMPLATE_PATH, "utf8")).filter(
    (b): b is TableBlock => b.type === "table"
  );
}

describe("rendered table accessibility", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = mountRoot();
  });

  it("renders every template table without violations", async () => {
    const { store, threshold } = loadDataStore();
    const blocks = tableBlocks();
    expect(blocks.length).toBeGreaterThan(0);

    let rendered = 0;
    for (const block of blocks) {
      const data = store[block.spec.data];
      if (!data) continue; // block references a dataset the fixture lacks
      renderTable(block.spec, data, root, { smallestGroup: threshold });
      rendered++;
    }
    expect(rendered).toBeGreaterThan(0);
    await expectNoViolations(root);
  });

  it("marks up header cells with a scope", () => {
    const { store, threshold } = loadDataStore();
    const block = tableBlocks().find((b) => store[b.spec.data])!;
    const table = renderTable(block.spec, store[block.spec.data], root, {
      smallestGroup: threshold,
    });

    const headerCells = table.querySelectorAll("thead th");
    expect(headerCells.length).toBeGreaterThan(0);
    for (const th of headerCells) expect(th.getAttribute("scope")).toBe("col");

    const rowHeaders = table.querySelectorAll("tbody th");
    expect(rowHeaders.length).toBeGreaterThan(0);
    for (const th of rowHeaders) expect(th.getAttribute("scope")).toBe("row");

    // The corner cell must not be empty, or the row-header column is unnamed.
    expect(headerCells[0].textContent!.trim().length).toBeGreaterThan(0);
  });
});

describe("rendered prose accessibility", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = mountRoot();
  });

  it("renders callouts and headings without violations", async () => {
    root.innerHTML = renderText(
      [
        "# Bericht",
        "",
        "## Einleitung",
        "",
        "Ein Absatz mit **Auszeichnung** und einer [Verknüpfung](https://example.org).",
        "",
        "::: {.callout-note title='Definitionen'}",
        "**Geschlecht:** männlich oder weiblich.",
        ":::",
        "",
        "### Unterabschnitt",
        "",
        "| Spalte | Wert |",
        "| --- | --- |",
        "| a | 1 |",
        "",
      ].join("\n")
    );
    await expectNoViolations(root);
  });

  it("builds a labelled table of contents that resolves to real headings", async () => {
    root.innerHTML = renderText(
      ["# Titel", "", "## Erster", "", "Text.", "", "### Unter", "", "Text.", "", "## Zweiter", "", "Text."].join("\n")
    );
    applyDocumentStructure(root, { sectionNumbering: true, toc: true });

    const nav = root.querySelector("nav.report-toc")!;
    expect(nav.getAttribute("aria-label")).toBeTruthy();

    const links = nav.querySelectorAll("a");
    expect(links.length).toBe(3);
    for (const a of links) {
      const id = a.getAttribute("href")!.slice(1);
      expect(root.querySelector(`#${id}`), `TOC link to missing #${id}`).not.toBeNull();
    }
    await expectNoViolations(root);
  });
});
