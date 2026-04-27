/**
 * Palettes module — curated accessible color palettes for charts.
 * Every palette is designed to remain distinguishable under common
 * colorblindness simulations (deuteranopia, protanopia, tritanopia).
 * Self-contained and reusable in other projects.
 */

export type PaletteId =
  | "okabe-ito"
  | "tol-bright"
  | "tol-muted"
  | "ibm"
  | "grayscale";

/**
 * Okabe & Ito (2008), popularised by Wong (2011, Nature Methods).
 * The de-facto standard 8-colour colourblind-safe palette.
 */
const OKABE_ITO = [
  "#0072B2", // blue
  "#E69F00", // orange
  "#009E73", // green
  "#CC79A7", // reddish purple
  "#56B4E9", // sky blue
  "#D55E00", // vermillion
  "#F0E442", // yellow
  "#000000", // black
];

/** Paul Tol — Bright qualitative palette (7 colours). */
const TOL_BRIGHT = [
  "#4477AA", // blue
  "#EE6677", // red
  "#228833", // green
  "#CCBB44", // yellow
  "#66CCEE", // cyan
  "#AA3377", // purple
  "#BBBBBB", // grey
];

/** Paul Tol — Muted qualitative palette (9 colours), softer for long reports. */
const TOL_MUTED = [
  "#332288", // indigo
  "#88CCEE", // cyan
  "#44AA99", // teal
  "#117733", // green
  "#999933", // olive
  "#DDCC77", // sand
  "#CC6677", // rose
  "#882255", // wine
  "#AA4499", // purple
];

/** IBM Design Language colourblind-safe sequence (5 colours). */
const IBM = [
  "#648FFF",
  "#785EF0",
  "#DC267F",
  "#FE6100",
  "#FFB000",
];

/** Grayscale — maximum-contrast fallback for print or strict accessibility. */
const GRAYSCALE = [
  "#000000",
  "#404040",
  "#808080",
  "#BFBFBF",
  "#E5E5E5",
];

export const PALETTES: Record<PaletteId, string[]> = {
  "okabe-ito": OKABE_ITO,
  "tol-bright": TOL_BRIGHT,
  "tol-muted": TOL_MUTED,
  ibm: IBM,
  grayscale: GRAYSCALE,
};

export const DEFAULT_PALETTE_ID: PaletteId = "okabe-ito";

export function getPalette(id?: string): string[] {
  if (id && id in PALETTES) return PALETTES[id as PaletteId];
  return PALETTES[DEFAULT_PALETTE_ID];
}
