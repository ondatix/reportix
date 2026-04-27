/**
 * Fonts module — curated list of accessible system fonts for use across
 * preview, charts, tables, and DOCX export. System-only so the app remains
 * fully offline and respects a strict CSP (no remote font loading).
 * Self-contained and reusable in other projects.
 */

export interface FontDef {
  /** Stable ID used in config and parameter values. */
  id: string;
  /** Human-readable name. */
  displayName: string;
  /** CSS font stack used for HTML preview, tables, and Chart.js. */
  cssStack: string;
  /** Single font name written into the .docx file. */
  docxName: string;
}

/**
 * Curated set of accessible system fonts.
 * Selection criteria: clear letterforms (distinct I/l/1), open counters,
 * generous spacing, and broad availability across Windows/macOS/Linux.
 */
export const FONTS: Record<string, FontDef> = {
  verdana: {
    id: "verdana",
    displayName: "Verdana",
    cssStack: 'Verdana, Geneva, sans-serif',
    docxName: "Verdana",
  },
  tahoma: {
    id: "tahoma",
    displayName: "Tahoma",
    cssStack: 'Tahoma, Geneva, sans-serif',
    docxName: "Tahoma",
  },
  arial: {
    id: "arial",
    displayName: "Arial",
    cssStack: 'Arial, Helvetica, sans-serif',
    docxName: "Arial",
  },
  georgia: {
    id: "georgia",
    displayName: "Georgia",
    cssStack: 'Georgia, "Times New Roman", serif',
    docxName: "Georgia",
  },
};

export const DEFAULT_FONT_ID = "arial";

export function getFont(id?: string): FontDef {
  if (id && id in FONTS) return FONTS[id];
  return FONTS[DEFAULT_FONT_ID];
}
