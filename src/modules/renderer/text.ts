/**
 * Text renderer — converts Markdown to semantic HTML.
 * Usable independently in other projects.
 */
import { marked } from "marked";
import type { ParameterValues } from "../types";

/**
 * Render a Markdown string to HTML.
 * Supports simple {{parameter}} interpolation from collected values.
 */
export function renderText(
  markdown: string,
  parameters?: ParameterValues
): string {
  let interpolated = markdown;

  if (parameters) {
    interpolated = markdown.replace(
      /\{\{\s*(\w+)\s*\}\}/g,
      (_match, key: string) => {
        const value = parameters[key];
        return value !== undefined ? String(value) : `{{${key}}}`;
      }
    );
  }

  return marked.parse(interpolated, { async: false }) as string;
}
