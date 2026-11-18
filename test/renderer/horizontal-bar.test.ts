/**
 * @vitest-environment jsdom
 *
 * Bar charts with more categories than `charts.elements.bar.max_columns`
 * flip to horizontal bars and grow in height; past
 * `charts.max_height_ratio` they are split into equally big partial plots.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  horizontalBarLayout,
  sliceCategories,
  plottedValueMax,
  renderChart,
} from "../../src/modules/renderer/chart";
import { wrangleTable } from "../../src/modules/aggregation";
import { generateAltText } from "../../src/modules/alt-text";
import { parseConfigObject } from "../../src/modules/config";
import type { ChartSpec, ChartDefaults } from "../../src/modules/types";

const spec = (type: ChartSpec["type"], stacked = false): ChartSpec =>
  ({ type, stacked, table: { data: "S", groupby: { rows: "Gruppe" }, aggregation: "count" } }) as ChartSpec;

const d: ChartDefaults = { aspectRatio: 2, elements: { bar: { maxColumns: 10 } } };
const capped: ChartDefaults = { ...d, maxHeightRatio: 1 }; // ≤ 20 categories per plot

describe("horizontalBarLayout", () => {
  it("keeps a bar chart vertical up to maxColumns categories", () => {
    expect(horizontalBarLayout(spec("bar"), d, 10)).toBeUndefined();
  });

  it("flips beyond maxColumns and scales the height with the category count", () => {
    expect(horizontalBarLayout(spec("bar"), d, 20)).toEqual({ aspectRatio: 1, parts: [{ start: 0, end: 20 }] });
    expect(horizontalBarLayout(spec("bar", true), d, 40)?.aspectRatio).toBe(0.5);
  });

  it("never flips other chart types or when the limit is unset", () => {
    expect(horizontalBarLayout(spec("line"), d, 20)).toBeUndefined();
    expect(horizontalBarLayout(spec("bar"), { aspectRatio: 2 }, 20)).toBeUndefined();
    expect(horizontalBarLayout(spec("bar"), undefined, 20)).toBeUndefined();
  });

  it("stays in one plot while within maxHeightRatio", () => {
    expect(horizontalBarLayout(spec("bar"), capped, 20)?.parts).toHaveLength(1);
  });

  it("splits into the fewest equally big parts that each fit", () => {
    const layout = horizontalBarLayout(spec("bar"), capped, 21)!;
    expect(layout.parts).toEqual([
      { start: 0, end: 11 },
      { start: 11, end: 21 },
    ]);
    // Every part shares the largest part's aspect ratio: 2 × 10 / 11.
    expect(layout.aspectRatio).toBeCloseTo(20 / 11);
    expect(horizontalBarLayout(spec("bar"), capped, 45)!.parts.map((p) => p.end - p.start)).toEqual([15, 15, 15]);
  });
});

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => `G${String(i + 1).padStart(2, "0")}`).flatMap((g, i) =>
    Array.from({ length: i + 1 }, (_, k) => ({ Gruppe: g, Geschlecht: k % 2 ? "weiblich" : "männlich" }))
  );

describe("sliceCategories / plottedValueMax", () => {
  it("slices the category axis and keeps the full chart's value maximum", () => {
    const s = spec("bar");
    const w = wrangleTable(s.table, rows(25), 0);
    const part = sliceCategories(s, w, { start: 20, end: 25 });
    expect(part.rows).toEqual(["G21", "G22", "G23", "G24", "G25"]);
    expect(part.cells).toHaveLength(5);
    expect(plottedValueMax(s, w)).toBe(25);
  });

  it("slices cols for a flipped stacked bar and uses the stack total", () => {
    const s = { ...spec("bar", true), table: { data: "S", groupby: { rows: "Geschlecht", cols: "Gruppe" }, aggregation: "count" } } as ChartSpec;
    const w = wrangleTable(s.table, rows(25), 0);
    const part = sliceCategories(s, w, { start: 0, end: 3 });
    expect(part.cols).toHaveLength(3);
    expect(part.cells.every((r) => r.length === 3)).toBe(true);
    expect(plottedValueMax(s, w)).toBe(25);
  });
});

describe("renderChart — split charts", () => {
  beforeAll(() => {
    // jsdom has no 2D canvas; Chart.js declines to draw, which is fine here.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders one labelled canvas per part inside a single figure", () => {
    const container = document.createElement("div");
    const s = { ...spec("bar"), caption: "Personen je Gruppe" } as ChartSpec;
    const figure = renderChart(s, rows(25), container, capped, ["#000000"]);
    const canvases = figure.querySelectorAll("canvas");
    expect(canvases).toHaveLength(2);
    expect(figure.querySelectorAll(".chart-part")).toHaveLength(2);
    expect(figure.querySelectorAll("figcaption")).toHaveLength(1);
    expect(canvases[0].getAttribute("aria-label")).toMatch(/^Teil 1 von 2: /);
    expect(canvases[1].getAttribute("aria-label")).toMatch(/^Teil 2 von 2: /);
    expect(canvases[1].getAttribute("aria-label")).toContain("G25");
    expect(canvases[0].getAttribute("aria-label")).not.toContain("G25");
  });

  it("keeps a chart within the limit in one canvas without a part prefix", () => {
    const figure = renderChart(spec("bar"), rows(15), document.createElement("div"), capped, ["#000000"]);
    expect(figure.querySelectorAll("canvas")).toHaveLength(1);
    expect(figure.querySelector("canvas")!.getAttribute("aria-label")).not.toMatch(/^Teil/);
  });
});

describe("generateAltText — part prefix", () => {
  it("prefixes only when there is more than one part, in the requested locale", () => {
    const s = spec("bar");
    expect(generateAltText(s, undefined, "en", { index: 2, count: 3 })).toMatch(/^Part 2 of 3: /);
    expect(generateAltText(s, undefined, "de", { index: 1, count: 1 })).toBe(generateAltText(s, undefined, "de"));
  });
});

describe("config: chart size limits", () => {
  it("parses max_columns and max_height_ratio", () => {
    const parsed = parseConfigObject({ charts: { max_height_ratio: 1.5, elements: { bar: { max_columns: 6 } } } });
    expect(parsed.charts?.elements?.bar?.maxColumns).toBe(6);
    expect(parsed.charts?.maxHeightRatio).toBe(1.5);
  });
});
