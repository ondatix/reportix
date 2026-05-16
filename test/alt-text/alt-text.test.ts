/**
 * Alt-text golden test.
 *
 * Parses `templates/stmas_template.md`, generates the auto alt text for
 * every chart block, and compares each one to the string stored in
 * `stmas_template.expected.json`.
 *
 * The golden file is hand-maintained: when alt-text output changes
 * intentionally, regenerate it via `npm run test:bootstrap-alt-text`
 * and verify the diff before committing.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTemplate } from "../../src/modules/template";
import { generateAltText } from "../../src/modules/alt-text";
import type { ChartBlock } from "../../src/modules/types";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(here, "../../templates/stmas_template.md");
const GOLDEN_PATH = resolve(here, "stmas_template.expected.json");

interface GoldenEntry {
  index: number;
  title?: string;
  alt: string;
}

const templateText = readFileSync(TEMPLATE_PATH, "utf8");
const chartSpecs = parseTemplate(templateText)
  .filter((b): b is ChartBlock => b.type === "chart")
  .map((b) => b.spec);

const golden: GoldenEntry[] = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));

describe("alt-text — stmas_template.md", () => {
  it("template has the expected number of charts", () => {
    expect(chartSpecs.length).toBe(golden.length);
  });

  chartSpecs.forEach((spec, i) => {
    const label = spec.title ?? `(untitled #${i})`;
    it(`chart ${i}: ${label}`, () => {
      const actual = generateAltText(spec);
      expect(actual).toBe(golden[i]?.alt);
    });
  });
});
