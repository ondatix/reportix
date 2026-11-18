/**
 * Template module — parses a Markdown template with fenced chart/table
 * code blocks into a sequence of typed blocks.
 * Usable independently in other projects.
 */
import YAML from "yaml";
import type { TemplateBlock, ChartSpec, TableSpec } from "../types";

const FENCED_BLOCK_RE = /^```(chart|table)\s*\n([\s\S]*?)^```/gm;

export function parseTemplate(markdown: string): TemplateBlock[] {
  const blocks: TemplateBlock[] = [];
  let lastIndex = 0;

  for (const match of markdown.matchAll(FENCED_BLOCK_RE)) {
    const matchStart = match.index!;

    // Collect any preceding markdown as a text block.
    if (matchStart > lastIndex) {
      const preceding = markdown.slice(lastIndex, matchStart).trim();
      if (preceding) {
        blocks.push({ type: "text", markdown: preceding });
      }
    }

    const blockType = match[1] as "chart" | "table";
    const yamlBody = match[2];
    const spec = YAML.parse(yamlBody) as Record<string, unknown>;

    // Normalise kebab-case aliases to the camelCase fields used in code.
    if ("alt-intro" in spec && !("altIntro" in spec)) {
      spec.altIntro = spec["alt-intro"];
      delete spec["alt-intro"];
    }

    // Hand-written specs may omit the aggregation op — default to count.
    const tableSpec = (blockType === "chart" ? spec.table : spec) as
      | Record<string, unknown>
      | undefined;
    if (tableSpec && typeof tableSpec === "object" && !tableSpec.aggregation) {
      tableSpec.aggregation = "count";
    }

    if (blockType === "chart") {
      blocks.push({ type: "chart", spec: spec as unknown as ChartSpec });
    } else {
      blocks.push({ type: "table", spec: spec as unknown as TableSpec });
    }

    lastIndex = matchStart + match[0].length;
  }

  // Trailing text after the last fenced block.
  if (lastIndex < markdown.length) {
    const trailing = markdown.slice(lastIndex).trim();
    if (trailing) {
      blocks.push({ type: "text", markdown: trailing });
    }
  }

  return blocks;
}

export async function loadTemplate(file: File): Promise<TemplateBlock[]> {
  const text = await file.text();
  return parseTemplate(text);
}
