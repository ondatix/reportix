/**
 * Text renderer — converts Markdown to semantic HTML.
 * Adds a Pandoc-style fenced-div extension so callouts written like
 *   `::: {.callout-note title='…'} … :::` (matching Quarto syntax)
 * render as `<div class="callout callout-note" role="note">…</div>`.
 * Usable independently in other projects.
 */
import { marked, type Tokens, type TokenizerAndRendererExtension } from "marked";
import type { ParameterValues } from "../types";

const CALLOUT_RULE =
  /^:::\s*\{\s*\.([\w-]+)\s*(?:title\s*=\s*['"]([^'"]*)['"]\s*)?\}\s*\n([\s\S]*?)\n:::(?:\s*\n|\s*$)/;

interface CalloutToken extends Tokens.Generic {
  type: "callout";
  raw: string;
  cls: string;
  title: string;
  tokens: Tokens.Generic[];
}

const calloutExtension: TokenizerAndRendererExtension = {
  name: "callout",
  level: "block",
  start(src) {
    const idx = src.search(/^:::/m);
    return idx >= 0 ? idx : undefined;
  },
  tokenizer(src) {
    const match = CALLOUT_RULE.exec(src);
    if (!match) return undefined;
    const token: CalloutToken = {
      type: "callout",
      raw: match[0],
      cls: match[1] || "callout",
      title: match[2] ?? "",
      tokens: [],
    };
    this.lexer.blockTokens(match[3], token.tokens as Tokens.Generic[]);
    return token;
  },
  renderer(token) {
    const t = token as CalloutToken;
    const cls = t.cls.startsWith("callout") ? t.cls : `callout-${t.cls}`;
    const titleHTML = t.title
      ? `<div class="callout-title">${escapeHTML(t.title)}</div>`
      : "";
    const body = this.parser.parse(t.tokens);
    return `<div class="callout ${cls}" role="note">${titleHTML}${body}</div>`;
  },
};

marked.use({ extensions: [calloutExtension] });

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

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
