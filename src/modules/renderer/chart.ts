/**
 * Chart renderer — renders a ChartSpec into a <figure> with an accessible
 * Chart.js canvas, alt text, and optional caption.
 *
 * The data shaping is NOT done here: the spec's embedded `table:` is turned
 * into a shared `WrangledTable` (filter → groupby → aggregate, with per-cell
 * data-protection flags) by the aggregation module, and this renderer only
 * maps that crosstab onto Chart.js datasets — rows become the category axis,
 * cols become the series. Protected cells are not plotted at their real value:
 * a `count` clamps to the threshold so a small bar stays visible, every other
 * op plots nothing — see `maskedPlotValue` and `maskLabel`.
 *
 * Applies ChartDefaults from the bundled config for consistent styling.
 * Usable independently in other projects.
 */
import { Chart, registerables, ArcElement, BarElement, PointElement } from "chart.js";
import type { ChartOptions, TooltipItem, Plugin } from "chart.js";
import type { ChartSpec, DataSet, ChartDefaults, DataParametersConfig } from "../types";
import { generateAltText } from "../alt-text";
import { getPalette } from "../palettes";
import { t, getLocale } from "../i18n";
import { wrangleTable, showsGroupCount, type WrangledTable } from "../aggregation";

Chart.register(...registerables);

/** White contour applied to every shape (bars, slices, points) for contrast against the fill color. */
const SHAPE_BORDER_COLOR = "#ffffff";

// ── Category color resolution ────────────────────────────────────────

/** NFC + trim + lowercase — matches the normalization used elsewhere in the app for data-value comparisons (e.g. mutation conditions). */
function normalizeLabel(s: string): string {
  return s.normalize("NFC").trim().toLowerCase();
}

/**
 * Every crosstab in this report's config is broken down by "Geschlecht", so
 * a category label — whichever axis (rows or cols) it happens to sit on —
 * that normalizes to "männlich" or "weiblich" always gets its dedicated,
 * user-configured color (`ChartDefaults.gender`), keeping gender coding
 * consistent across every chart in the document. Any other label (a future
 * "divers" value, or an unrelated non-gender dimension) falls back to the
 * ambient palette, cycling by `fallbackIndex`.
 */
function categoryColor(
  label: string,
  d: ChartDefaults | undefined,
  fallbackColors: string[],
  fallbackIndex: number
): string {
  const normalized = normalizeLabel(label);
  if (normalized === "männlich" && d?.gender?.male) return d.gender.male;
  if (normalized === "weiblich" && d?.gender?.female) return d.gender.female;
  return fallbackColors[fallbackIndex % fallbackColors.length];
}

/**
 * Extra room reserved around the chart area so the value labels drawn by
 * `valueLabelsPlugin` — positioned just outside their shape, e.g. above the
 * tallest bar or right of the rightmost horizontal bar — don't get clipped
 * by the canvas edge. Chart.js sizes the plotted area to exactly fit the
 * data with no such headroom by default.
 */
const CHART_LAYOUT_PADDING = 24;

/** Per-Chart.js-dataset-index → set of data indices whose values were privacy-suppressed. */
type ProtectionMap = Map<number, Set<number>>;

/**
 * What to plot in place of a suppressed cell.
 *
 * For `count` the drawn quantity *is* the group size, so clamping to the
 * threshold keeps a small bar visible without revealing the exact figure —
 * the reader sees "some, fewer than 5". For every other op the value is
 * unrelated to the group size, so there is no honest small stand-in: plotting
 * a mean's threshold would draw a fabricated average. Those plot 0, i.e.
 * nothing, and the permanent value label says so.
 */
function maskedPlotValue(w: WrangledTable): number {
  return showsGroupCount(w.aggregation) ? w.threshold : 0;
}

/**
 * The text shown in place of a suppressed value. `<threshold` only where the
 * number *is* the group count; otherwise a neutral placeholder, since calling
 * a suppressed 4200 € mean "< 5" would be a factual lie. Computed once and
 * handed to the tooltip and value-label renderers, which is why they take a
 * label rather than a threshold.
 */
function maskLabel(w: WrangledTable): string {
  return showsGroupCount(w.aggregation) ? `<${w.threshold}` : t("agg.suppressed");
}

/** Clamped values + protected indices for one crosstab column. */
function columnSeries(w: WrangledTable, col: number): { values: number[]; protectedIdx: Set<number> } {
  const protectedIdx = new Set<number>();
  const values = w.rows.map((_, i) => {
    const cell = w.cells[i][col];
    if (cell.protected) protectedIdx.add(i);
    return cell.protected ? maskedPlotValue(w) : cell.value;
  });
  return { values, protectedIdx };
}

/** Every series' clamped values flattened into one array (for chart-wide min/max, e.g. axis trimming). */
function flattenValues(w: WrangledTable): number[] {
  const numCols = w.colHeader ? w.cols.length : 1;
  const values: number[] = [];
  for (let j = 0; j < numCols; j++) values.push(...columnSeries(w, j).values);
  return values;
}

/**
 * Clamped values + protected indices for one crosstab row, indexed by
 * column — the mirror of `columnSeries`. Used by stacked bar charts, which
 * put `cols` on the category axis and `rows` on the color axis (the
 * opposite of every other bar/line chart), so each Chart.js dataset is one
 * row's values across the columns instead of one column's values across
 * the rows.
 */
function rowSeries(w: WrangledTable, row: number): { values: number[]; protectedIdx: Set<number> } {
  const protectedIdx = new Set<number>();
  const values = w.cols.map((_, j) => {
    const cell = w.cells[row][j];
    if (cell.protected) protectedIdx.add(j);
    return cell.protected ? maskedPlotValue(w) : cell.value;
  });
  return { values, protectedIdx };
}

/** Pyramid/distance need the column axis to hold exactly two distinct values. */
function requireBinaryCols(spec: ChartSpec, w: WrangledTable): void {
  const field = spec.table.groupby.cols;
  if (!field || w.cols.length !== 2) {
    throw new Error(
      t("chart.needsBinaryCols", {
        type: spec.type,
        field: field ?? "groupby.cols",
        count: field ? w.cols.length : 0,
      })
    );
  }
}

/**
 * Pie/doughnut only have one axis (rows → slices; `cols` is unsupported).
 * When a spec omits `rows` and supplies only `cols` — the general
 * single-axis convenience for tables and bar/line series — treat `cols` as
 * that one axis instead of erroring, so the same spec means "the sole
 * breakdown dimension" consistently across every block type.
 */
export function normalizePieSpec(spec: ChartSpec): ChartSpec {
  const isPie = spec.type === "pie" || spec.type === "doughnut";
  const { rows, cols } = spec.table.groupby;
  if (!isPie || rows || !cols) return spec;
  return { ...spec, table: { ...spec.table, groupby: { rows: cols } } };
}

export function renderChart(
  spec: ChartSpec,
  data: DataSet,
  container: HTMLElement,
  defaults?: ChartDefaults,
  palette?: string[],
  dataParameters?: DataParametersConfig
): HTMLElement {
  const colors = palette ?? getPalette();
  const threshold = dataParameters?.smallestGroup ?? 0; // 0 = disabled
  const effectiveSpec = normalizePieSpec(spec);
  const wrangled = wrangleTable(effectiveSpec.table, data, threshold, dataParameters?.categoryOrder);

  const figure = document.createElement("figure");

  const makeCanvas = (altText: string): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", altText);
    // The alt text is generated in the active UI locale, but the report body it
    // sits in is always German (the templates are German-only, and the preview
    // is marked lang="de"). Declaring the language here keeps a screen reader
    // from voicing an English alt text with a German synthesiser.
    canvas.lang = getLocale();
    return canvas;
  };

  // A horizontal bar chart that would grow taller than `maxHeightRatio` is
  // split into equally big partial plots: one canvas — each in its own
  // wrapper, since Chart.js sizes a canvas from its parent — and one alt text
  // per slice of categories, all on the same value axis.
  const layout =
    effectiveSpec.type === "bar"
      ? horizontalBarLayout(effectiveSpec, defaults, barCategoryCount(effectiveSpec, wrangled))
      : undefined;
  const slices =
    layout && layout.parts.length > 1
      ? layout.parts.map((part) => ({ ...part, table: sliceCategories(effectiveSpec, wrangled, part) }))
      : undefined;

  let canvases: { canvas: HTMLCanvasElement; table: WrangledTable; offset: number }[];
  if (slices) {
    canvases = slices.map((slice, i) => {
      const canvas = makeCanvas(
        generateAltText(effectiveSpec, slice.table, getLocale(), { index: i + 1, count: slices.length })
      );
      const wrapper = document.createElement("div");
      wrapper.className = "chart-part";
      wrapper.appendChild(canvas);
      figure.appendChild(wrapper);
      return { canvas, table: slice.table, offset: slice.start };
    });
  } else {
    const canvas = makeCanvas(generateAltText(effectiveSpec, wrangled));
    figure.appendChild(canvas);
    canvases = [{ canvas, table: wrangled, offset: 0 }];
  }

  if (spec.caption || spec.title) {
    const figcaption = document.createElement("figcaption");
    figcaption.textContent = spec.caption ?? spec.title!;
    figure.appendChild(figcaption);
  }

  container.appendChild(figure);

  const canvas = canvases[0].canvas;
  switch (effectiveSpec.type) {
    case "pyramid":
      renderPyramid(canvas, effectiveSpec, wrangled, colors, defaults);
      break;
    case "distance":
      renderDistance(canvas, effectiveSpec, wrangled, colors, defaults);
      break;
    case "pie":
    case "doughnut":
      renderPie(canvas, effectiveSpec, wrangled, colors, defaults);
      break;
    default: {
      // Parts share the full chart's value range so their bars stay comparable.
      const valueMax = slices ? plottedValueMax(effectiveSpec, wrangled) : undefined;
      for (const part of canvases) {
        renderBarLine(part.canvas, effectiveSpec, part.table, colors, defaults, {
          aspectRatio: layout?.aspectRatio,
          valueMax,
          values: flattenValues(wrangled),
          colorOffset: part.offset,
        });
      }
    }
  }

  return figure;
}

/**
 * bar / line — rows are the category axis, one dataset per crosstab column.
 * A single synthetic column (no `groupby.cols`) renders as one dataset with
 * per-category palette colors and no legend. Stacked *bar* charts flip the
 * category axis: `cols` (always "Geschlecht" in this report) become the
 * x-axis, since a stacked bar reads as "for each column value, how do the
 * rows break it down" rather than the other way round. Unlike every other
 * chart type, stacked bars are colored from the ambient accessible
 * `palette` (one hue per row/segment) rather than the gender pickers — a
 * stack can have more segments than there are gender colors to spare, and
 * gender-coding the border there read poorly, so gender coding is skipped
 * here entirely.
 */
function renderBarLine(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  w: WrangledTable,
  colors: string[],
  defaults?: ChartDefaults,
  layout: BarLayoutOptions = {}
): void {
  const isLine = spec.type === "line";
  const flipAxes = flipsStackedBar(spec, w);
  // A partial plot's categories start `colorOffset` into the full chart, so
  // palette-indexed colors match what the unsplit chart would have drawn.
  const offset = layout.colorOffset ?? 0;
  const protectionMap: ProtectionMap = new Map();
  let labels: string[];
  let datasets: object[];

  if (flipAxes) {
    labels = w.cols;
    datasets = w.rows.map((name, i) => {
      const series = rowSeries(w, i);
      protectionMap.set(i, series.protectedIdx);
      return {
        label: name,
        data: series.values,
        backgroundColor: colors[i % colors.length],
        borderColor: SHAPE_BORDER_COLOR,
        borderWidth: 2,
      };
    });
  } else if (w.colHeader) {
    labels = w.rows;
    datasets = w.cols.map((name, j) => {
      const series = columnSeries(w, j);
      protectionMap.set(j, series.protectedIdx);
      const color = categoryColor(name, defaults, colors, j);
      return isLine
        ? {
            label: name,
            data: series.values,
            backgroundColor: color,
            borderColor: color,
            pointBackgroundColor: color,
            pointBorderColor: SHAPE_BORDER_COLOR,
            pointBorderWidth: 2,
          }
        : {
            label: name,
            data: series.values,
            backgroundColor: color,
            borderColor: SHAPE_BORDER_COLOR,
            borderWidth: 2,
          };
    });
  } else {
    labels = w.rows;
    const series = columnSeries(w, 0);
    protectionMap.set(0, series.protectedIdx);
    const perBar = w.rows.map((label, i) => categoryColor(label, defaults, colors, offset + i));
    datasets = [
      isLine
        ? {
            label: w.valueLabel,
            data: series.values,
            backgroundColor: colors[0],
            borderColor: colors[0],
            pointBackgroundColor: colors[0],
            pointBorderColor: SHAPE_BORDER_COLOR,
            pointBorderWidth: 2,
          }
        : {
            label: w.valueLabel,
            data: series.values,
            backgroundColor: perBar,
            borderColor: SHAPE_BORDER_COLOR,
            borderWidth: 2,
          },
    ];
  }

  new Chart(canvas, {
    type: spec.type as "bar" | "line",
    data: { labels, datasets: datasets as never },
    options: buildOptions(
      spec,
      Boolean(w.colHeader),
      defaults,
      maskLabel(w),
      protectionMap,
      w.isShare,
      layout.values ?? flattenValues(w),
      labels.length,
      layout.aspectRatio,
      layout.valueMax
    ),
    plugins: [
      valueLabelsPlugin(
        maskLabel(w),
        protectionMap,
        labelColor(defaults),
        labelFont(defaults),
        w.isShare,
        false,
        flipAxes
      ),
    ],
  });
}

/** pie / doughnut — one slice per row; a column axis is not supported. */
function renderPie(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  w: WrangledTable,
  colors: string[],
  defaults?: ChartDefaults
): void {
  if (spec.table.groupby.cols) {
    throw new Error(t("chart.pieNoCols", { type: spec.type }));
  }
  const series = columnSeries(w, 0);
  const protectionMap: ProtectionMap = new Map([[0, series.protectedIdx]]);
  const slice = w.rows.map((label, i) => categoryColor(label, defaults, colors, i));

  new Chart(canvas, {
    type: spec.type as "pie" | "doughnut",
    data: {
      labels: w.rows,
      datasets: [
        {
          label: w.valueLabel,
          data: series.values,
          backgroundColor: slice,
          borderColor: SHAPE_BORDER_COLOR,
          borderWidth: 2,
        },
      ],
    },
    options: buildOptions(spec, true, defaults, maskLabel(w), protectionMap, w.isShare),
    plugins: [valueLabelsPlugin(maskLabel(w), protectionMap, labelColor(defaults), labelFont(defaults), w.isShare)],
  });
}

/**
 * Pyramid chart — horizontal stacked bar with two datasets that extend in
 * opposite directions from the y-axis: rows are the category axis, the two
 * crosstab columns the left/right sides (first-seen order).
 */
function renderPyramid(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  w: WrangledTable,
  colors: string[],
  defaults?: ChartDefaults
): void {
  requireBinaryCols(spec, w);
  const left = columnSeries(w, 0);
  const right = columnSeries(w, 1);
  const protectionMap: ProtectionMap = new Map([
    [0, left.protectedIdx],
    [1, right.protectedIdx],
  ]);

  const maxAbs = Math.max(0, ...left.values, ...right.values);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: w.rows,
      datasets: [
        {
          label: w.cols[0],
          data: left.values.map((v) => -v),
          backgroundColor: categoryColor(w.cols[0], defaults, colors, 0),
          borderColor: SHAPE_BORDER_COLOR,
          borderWidth: 2,
        },
        {
          label: w.cols[1],
          data: right.values,
          backgroundColor: categoryColor(w.cols[1], defaults, colors, 1),
          borderColor: SHAPE_BORDER_COLOR,
          borderWidth: 2,
        },
      ],
    },
    options: buildPyramidOptions(spec, maxAbs, defaults, maskLabel(w), protectionMap, w.isShare),
    plugins: [
      valueLabelsPlugin(maskLabel(w), protectionMap, labelColor(defaults), labelFont(defaults), w.isShare, true),
    ],
  });
}

/**
 * Distance plot — for each category (row) on the y-axis, draws two markers
 * (one per crosstab column, with distinct shapes) and a thin connecting
 * line between them. The line is coloured according to the winning
 * class (the column with the higher value at that category).
 *
 * Implemented as a mixed Chart.js chart: a floating bar dataset (thin)
 * provides the connecting line, and two line datasets with
 * `showLine: false` and custom `pointStyle` provide the markers.
 */
function renderDistance(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  w: WrangledTable,
  colors: string[],
  defaults?: ChartDefaults
): void {
  requireBinaryCols(spec, w);
  const seriesA = columnSeries(w, 0);
  const seriesB = columnSeries(w, 1);

  const colorA = categoryColor(w.cols[0], defaults, colors, 0);
  const colorB = categoryColor(w.cols[1], defaults, colors, 1);

  // Floating-bar "line": [min, max] per category, coloured by who's winning.
  const ranges = w.rows.map((_, i) => [
    Math.min(seriesA.values[i], seriesB.values[i]),
    Math.max(seriesA.values[i], seriesB.values[i]),
  ]);
  const winners = w.rows.map((_, i) =>
    seriesA.values[i] >= seriesB.values[i] ? colorA : colorB
  );

  // Chart.js dataset index → protected set, used by the tooltip callback.
  // 0 = bar (range, hidden), 1 = seriesA markers, 2 = seriesB markers.
  const protectionMap: ProtectionMap = new Map([
    [1, seriesA.protectedIdx],
    [2, seriesB.protectedIdx],
  ]);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: w.rows,
      datasets: [
        {
          type: "bar",
          label: "",
          data: ranges as unknown as number[],
          backgroundColor: winners,
          borderColor: SHAPE_BORDER_COLOR,
          borderWidth: 1,
          barThickness: 3,
        },
        {
          type: "line",
          label: w.cols[0],
          data: seriesA.values,
          showLine: false,
          pointRadius: 7,
          pointHoverRadius: 8,
          pointStyle: "circle",
          backgroundColor: colorA,
          borderColor: colorA,
          pointBackgroundColor: colorA,
          pointBorderColor: SHAPE_BORDER_COLOR,
          pointBorderWidth: 2,
        },
        {
          type: "line",
          label: w.cols[1],
          data: seriesB.values,
          showLine: false,
          pointRadius: 7,
          pointHoverRadius: 8,
          pointStyle: "rect",
          backgroundColor: colorB,
          borderColor: colorB,
          pointBackgroundColor: colorB,
          pointBorderColor: SHAPE_BORDER_COLOR,
          pointBorderWidth: 2,
        },
      ],
    },
    options: buildDistanceOptions(spec, defaults, maskLabel(w), protectionMap, w.isShare),
    plugins: [valueLabelsPlugin(maskLabel(w), protectionMap, labelColor(defaults), labelFont(defaults), w.isShare)],
  });
}

// ── Tooltip helpers ──────────────────────────────────────────────────

/**
 * Build the `plugins.title` block from a ChartSpec + ChartDefaults.
 * Returns `{ display: false }` when the spec has no title, or when
 * `charts.title.display` is globally set to false, so the caller can splat
 * the result into every option builder without a conditional. Centralising
 * this keeps title styling consistent across chart types.
 */
function buildTitlePlugin(
  spec: ChartSpec,
  d?: ChartDefaults
): NonNullable<NonNullable<ChartOptions["plugins"]>["title"]> {
  if (!spec.title || d?.title?.display === false) return { display: false };
  const fontColor = d?.font?.color ? `#${d.font.color}` : undefined;
  const fontSpec = d?.font ? { family: d.font.family, size: d.font.size } : undefined;
  return {
    display: true,
    text: spec.title,
    position: (d?.title?.position ?? "top") as "top" | "bottom" | "left" | "right",
    align: (d?.title?.align ?? "center") as "start" | "center" | "end",
    color: d?.title?.color ? `#${d.title.color}` : fontColor,
    font: fontSpec,
  };
}

/**
 * Format a data value, replacing privacy-suppressed ones with `mask`.
 * Share ops (`isShare`) render as `x %` with at most 2 decimals. Shared by
 * tooltips, value labels, and axis ticks so every on-chart number agrees.
 */
function formatValue(
  value: number,
  isProtected: boolean,
  mask: string,
  isShare: boolean,
  abs = false
): string {
  if (isProtected) return mask;
  const display = abs ? Math.abs(value) : value;
  return formatAxisValue(display, isShare);
}

/** Format a plain (non-protected) axis/tick value — used for scale labels, which have no per-point masking. */
function formatAxisValue(value: number, isShare: boolean): string {
  return isShare
    ? `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Roughly how many gridlines a trimmed axis should show — drives the "nice" step size below. */
const TRIM_TARGET_TICKS = 5;

/**
 * Round a positive rough step up to a "nice" 1 / 2 / 5 × 10ⁿ number
 * (Heckbert's algorithm), so a trimmed axis lands on human-friendly tick
 * values instead of an arbitrary fraction.
 */
function niceStep(roughStep: number): number {
  if (roughStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const nice = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  return nice * magnitude;
}

/**
 * For non-stacked bar charts with `scales.y.trimToData` enabled, compute a
 * y-axis min/step pair that starts the axis at the nearest round tick below
 * the smallest plotted value instead of at 0 — e.g. a step of 5 and a
 * minimum of 132 start the axis at 130, not at 132 or some arbitrary
 * padded value. The step is forced via `ticks.stepSize` so every tick
 * (including the bottom one) lands on the same round grid. Chart.js clips
 * bars below the visible min, so this cuts the mostly-empty gap beneath
 * tall, similarly-sized bars without exaggerating the bars themselves.
 * Skipped for stacked bars (the baseline must stay at 0 for stacked totals
 * to read correctly), line charts, and any chart whose smallest value is
 * <= 0 (nothing to trim).
 */
export function trimmedAxisScale(
  spec: ChartSpec,
  d: ChartDefaults | undefined,
  values: number[]
): { min: number; stepSize: number } | undefined {
  if (spec.type !== "bar" || spec.stacked === true) return undefined;
  if (!d?.scales?.y?.trimToData) return undefined;
  if (values.length === 0) return undefined;
  const min = Math.min(...values);
  if (min <= 0) return undefined;
  const max = Math.max(...values);
  const step = niceStep((max > min ? max - min : min) / TRIM_TARGET_TICKS);
  return { min: Math.floor(min / step) * step, stepSize: step };
}

/**
 * Stacked bar charts with a column axis put `cols` on the category axis
 * (see `renderBarLine`); every other bar/line chart puts `rows` there.
 */
function flipsStackedBar(spec: ChartSpec, w: WrangledTable): boolean {
  return spec.type === "bar" && spec.stacked === true && Boolean(w.colHeader);
}

/** Number of categories on a bar chart's category axis. */
export function barCategoryCount(spec: ChartSpec, w: WrangledTable): number {
  return flipsStackedBar(spec, w) ? w.cols.length : w.rows.length;
}

/** Per-chart overrides `renderChart` passes to `renderBarLine`. */
interface BarLayoutOptions {
  /** Aspect ratio of a horizontal bar chart (or of each of its parts). */
  aspectRatio?: number;
  /** Shared value-axis maximum across the parts of a split chart. */
  valueMax?: number;
  /** All plotted values of the full chart (drives `trimToData`). */
  values?: number[];
  /** Index of the part's first category within the full chart. */
  colorOffset?: number;
}

/** A contiguous slice of a chart's categories. */
export interface ChartPart {
  start: number;
  /** Exclusive. */
  end: number;
}

/**
 * Bar charts with more categories than `elements.bar.maxColumns` flip to
 * horizontal bars and grow in height instead of squeezing ever-thinner
 * columns (and their unreadable rotated tick labels) into a fixed box: the
 * configured aspect ratio is scaled by `maxColumns / categories`, so each
 * bar keeps the thickness it had at exactly `maxColumns`.
 *
 * If that would make the chart taller than `maxHeightRatio` × its width,
 * the categories are split into the fewest parts that each fit, balanced so
 * part sizes differ by at most one. Every part gets the aspect ratio of the
 * largest one, so all partial plots are equally big.
 *
 * Returns `undefined` when the chart stays vertical.
 */
export function horizontalBarLayout(
  spec: ChartSpec,
  d: ChartDefaults | undefined,
  categoryCount: number
): { aspectRatio: number; parts: ChartPart[] } | undefined {
  const max = d?.elements?.bar?.maxColumns;
  if (spec.type !== "bar" || !max || max < 1 || categoryCount <= max) return undefined;
  const scale = (d?.aspectRatio ?? 2) * max; // categories per unit of height÷width
  const maxHeight = d?.maxHeightRatio;
  const capacity =
    maxHeight && maxHeight > 0 ? Math.max(1, Math.floor(maxHeight * scale + 1e-9)) : categoryCount;
  const count = Math.ceil(categoryCount / capacity);
  const small = Math.floor(categoryCount / count);
  const parts: ChartPart[] = [];
  for (let i = 0, start = 0; i < count; i++) {
    const size = small + (i < categoryCount % count ? 1 : 0);
    parts.push({ start, end: start + size });
    start += size;
  }
  return { aspectRatio: scale / Math.ceil(categoryCount / count), parts };
}

/** The crosstab restricted to one part's categories (rows, or cols for a flipped stacked bar). */
export function sliceCategories(spec: ChartSpec, w: WrangledTable, part: ChartPart): WrangledTable {
  if (flipsStackedBar(spec, w)) {
    return {
      ...w,
      cols: w.cols.slice(part.start, part.end),
      cells: w.cells.map((row) => row.slice(part.start, part.end)),
    };
  }
  return { ...w, rows: w.rows.slice(part.start, part.end), cells: w.cells.slice(part.start, part.end) };
}

/**
 * Largest value the value axis must reach: the biggest stack total for a
 * stacked chart, else the biggest single plotted value.
 */
export function plottedValueMax(spec: ChartSpec, w: WrangledTable): number {
  const flip = flipsStackedBar(spec, w);
  const series = flip
    ? w.rows.map((_, i) => rowSeries(w, i).values)
    : w.cols.map((_, j) => columnSeries(w, j).values);
  const categories = flip ? w.cols.length : w.rows.length;
  let max = 0;
  for (let c = 0; c < categories; c++) {
    const vals = series.map((v) => v[c] ?? 0);
    const total = spec.stacked === true ? vals.reduce((sum, v) => sum + Math.max(0, v), 0) : Math.max(...vals);
    max = Math.max(max, total);
  }
  return max;
}

/** Build a tooltip label callback that replaces privacy-suppressed values with `mask`. */
function tooltipLabel(mask: string, protection: ProtectionMap, isShare: boolean, abs = false) {
  return (ctx: TooltipItem<"bar" | "line" | "pie" | "doughnut">) => {
    const set = protection.get(ctx.datasetIndex);
    const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : "";
    const parsed = ctx.parsed as { x?: number; y?: number } | number;
    // Pie/doughnut parse to a plain number; bar/line parse to {x, y} where the
    // *value* axis is whichever one isn't the chart's indexAxis (e.g. pyramid
    // and distance are indexAxis "y", so the value lives in .x, not .y).
    const valueKey = ctx.chart.options.indexAxis === "y" ? "x" : "y";
    const raw = typeof parsed === "object" ? parsed[valueKey] : parsed;
    return `${label}${formatValue(Number(raw), Boolean(set?.has(ctx.dataIndex)), mask, isShare, abs)}`;
  };
}

// ── Value-label plugin ───────────────────────────────────────────────

function labelColor(d?: ChartDefaults): string {
  return d?.font?.color ? `#${d.font.color}` : "#1a1a1a";
}

function labelFont(d?: ChartDefaults): { family?: string; size?: number } {
  return { family: d?.font?.family, size: d?.font?.size };
}

/**
 * Position a value label just outside the shape it belongs to — except for
 * stacked bars (vertical or horizontal), where "just outside" would land a
 * segment's label on the next segment or past the end of the whole bar.
 * Those get centered inside their own block instead.
 */
function labelPoint(
  element: ReturnType<Chart["getDatasetMeta"]>["data"][number],
  chart: Chart,
  value: number,
  stacked: boolean
): { x: number; y: number } {
  if (element instanceof ArcElement) return element.getCenterPoint(false);
  if (element instanceof PointElement) return { x: element.x, y: element.y - 12 };
  if (element instanceof BarElement) {
    const horizontal = chart.options.indexAxis === "y";
    if (stacked) {
      const center = element.getCenterPoint(false);
      return { x: center.x ?? element.x, y: center.y ?? element.y };
    }
    return horizontal
      ? { x: element.x + (value >= 0 ? 16 : -16), y: element.y }
      : { x: element.x, y: element.y + (value >= 0 ? -12 : 12) };
  }
  return { x: 0, y: 0 };
}

/**
 * Draws a permanent, non-tooltip value label on every shape (bar, slice,
 * point) so the aggregate is legible without hovering — required for the
 * static DOCX export and for accessibility. Datasets with an empty `label`
 * (e.g. the distance plot's hidden connecting bar) are skipped.
 */
function valueLabelsPlugin(
  mask: string,
  protection: ProtectionMap,
  color: string,
  font: { family?: string; size?: number },
  isShare: boolean,
  abs = false,
  stacked = false
): Plugin {
  return {
    id: "valueLabels",
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${font.size ?? 12}px ${font.family ?? "sans-serif"}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = SHAPE_BORDER_COLOR;
      ctx.fillStyle = color;

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (!dataset.label) return;
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;
        const protectedIdx = protection.get(datasetIndex);

        meta.data.forEach((element, dataIndex) => {
          const value = Number(dataset.data[dataIndex]);
          if (Number.isNaN(value)) return;
          const text = formatValue(value, Boolean(protectedIdx?.has(dataIndex)), mask, isShare, abs);
          const { x, y } = labelPoint(element, chart, value, stacked);
          ctx.strokeText(text, x, y);
          ctx.fillText(text, x, y);
        });
      });

      ctx.restore();
    },
  };
}

// ── Pyramid options ─────────────────────────────────────────────────

function buildPyramidOptions(
  spec: ChartSpec,
  maxAbs: number,
  d?: ChartDefaults,
  mask: string = "",
  protection: ProtectionMap = new Map(),
  isShare = false
): ChartOptions {
  const fontColor = d?.font?.color ? `#${d.font.color}` : undefined;
  const fontSpec = d?.font ? { family: d.font.family, size: d.font.size } : undefined;

  return {
    indexAxis: "y",
    animation: d?.animation === false ? false : undefined,
    aspectRatio: d?.aspectRatio ?? 2,
    responsive: true,
    maintainAspectRatio: true,
    layout: { padding: CHART_LAYOUT_PADDING },

    plugins: {
      title: buildTitlePlugin(spec, d),

      legend: {
        display: d?.legend?.display ?? true,
        position: (d?.legend?.position ?? "top") as "top" | "bottom" | "left" | "right",
        align: (d?.legend?.align ?? "center") as "start" | "center" | "end",
        labels: { color: fontColor, font: fontSpec },
      },

      tooltip: {
        enabled: d?.tooltip?.enabled ?? true,
        callbacks: { label: tooltipLabel(mask, protection, isShare, true) },
      },
    },

    scales: {
      x: {
        stacked: true,
        suggestedMin: -maxAbs,
        suggestedMax: maxAbs,
        ticks: {
          color: d?.scales?.x?.tickColor ? `#${d.scales.x.tickColor}` : fontColor,
          font: fontSpec,
          callback: (val) => formatAxisValue(Math.abs(Number(val)), isShare),
        },
        grid: {
          display: d?.scales?.x?.gridDisplay ?? true,
          color: d?.scales?.x?.gridColor ?? "rgba(0,0,0,0.08)",
        },
      },
      y: {
        stacked: true,
        // Reverse the category axis so the first row sits at the top and the
        // pyramid reads top-to-bottom, matching the table and alt-text order.
        reverse: true,
        ticks: {
          color: d?.scales?.y?.tickColor ? `#${d.scales.y.tickColor}` : fontColor,
          font: fontSpec,
        },
        grid: {
          display: d?.scales?.y?.gridDisplay ?? true,
          color: d?.scales?.y?.gridColor ?? "rgba(0,0,0,0.08)",
        },
      },
    },

    elements: {
      bar: {
        borderRadius: d?.elements?.bar?.borderRadius ?? 0,
      },
    },
  };
}

// ── Distance plot options ──────────────────────────────────────────

function buildDistanceOptions(
  spec: ChartSpec,
  d?: ChartDefaults,
  mask: string = "",
  protection: ProtectionMap = new Map(),
  isShare = false
): ChartOptions {
  const fontColor = d?.font?.color ? `#${d.font.color}` : undefined;
  const fontSpec = d?.font ? { family: d.font.family, size: d.font.size } : undefined;

  return {
    indexAxis: "y",
    animation: d?.animation === false ? false : undefined,
    aspectRatio: d?.aspectRatio ?? 2,
    responsive: true,
    maintainAspectRatio: true,
    layout: { padding: CHART_LAYOUT_PADDING },

    plugins: {
      title: buildTitlePlugin(spec, d),

      legend: {
        display: d?.legend?.display ?? true,
        position: (d?.legend?.position ?? "top") as "top" | "bottom" | "left" | "right",
        align: (d?.legend?.align ?? "center") as "start" | "center" | "end",
        labels: {
          color: fontColor,
          font: fontSpec,
          // Hide the unlabelled connecting-bar dataset.
          filter: (item) => item.text !== "",
          usePointStyle: true,
        },
      },

      tooltip: {
        enabled: d?.tooltip?.enabled ?? true,
        // Suppress the floating-bar dataset (datasetIndex 0); the two
        // marker datasets carry the information instead.
        filter: (ctx) => ctx.datasetIndex !== 0,
        callbacks: { label: tooltipLabel(mask, protection, isShare) },
      },
    },

    scales: {
      x: {
        ticks: {
          color: d?.scales?.x?.tickColor ? `#${d.scales.x.tickColor}` : fontColor,
          font: fontSpec,
          callback: (val) => formatAxisValue(Number(val), isShare),
        },
        grid: {
          display: d?.scales?.x?.gridDisplay ?? true,
          color: d?.scales?.x?.gridColor ?? "rgba(0,0,0,0.08)",
        },
      },
      y: {
        ticks: {
          color: d?.scales?.y?.tickColor ? `#${d.scales.y.tickColor}` : fontColor,
          font: fontSpec,
        },
        grid: {
          display: d?.scales?.y?.gridDisplay ?? true,
          color: d?.scales?.y?.gridColor ?? "rgba(0,0,0,0.08)",
        },
      },
    },
  };
}

// ── Standard options ────────────────────────────────────────────────

function buildOptions(
  spec: ChartSpec,
  multiSeries: boolean,
  d?: ChartDefaults,
  mask: string = "",
  protection: ProtectionMap = new Map(),
  isShare = false,
  values: number[] = [],
  categoryCount = 0,
  horizontalAspect?: number,
  valueMax?: number
): ChartOptions {
  const fontColor = d?.font?.color ? `#${d.font.color}` : undefined;
  const fontSpec = d?.font ? { family: d.font.family, size: d.font.size } : undefined;
  const trimmed = trimmedAxisScale(spec, d, values);
  horizontalAspect ??= horizontalBarLayout(spec, d, categoryCount)?.aspectRatio;
  const horizontal = horizontalAspect !== undefined;

  // `scales.x` configures the category axis and `scales.y` the value axis;
  // a horizontal bar chart keeps that meaning and just swaps where they sit.
  const categoryScale = {
    stacked: spec.stacked === true,
    ticks: { color: d?.scales?.x?.tickColor ? `#${d.scales.x.tickColor}` : fontColor, font: fontSpec },
    grid: {
      display: d?.scales?.x?.gridDisplay ?? true,
      color: d?.scales?.x?.gridColor ?? "rgba(0,0,0,0.08)",
    },
  };
  const valueScale = {
    stacked: spec.stacked === true,
    beginAtZero: trimmed ? false : (d?.scales?.y?.beginAtZero ?? true),
    min: trimmed?.min,
    suggestedMax: valueMax,
    ticks: {
      color: d?.scales?.y?.tickColor ? `#${d.scales.y.tickColor}` : fontColor,
      font: fontSpec,
      stepSize: trimmed?.stepSize,
      callback: (val: number | string) => formatAxisValue(Number(val), isShare),
    },
    grid: {
      display: d?.scales?.y?.gridDisplay ?? true,
      color: d?.scales?.y?.gridColor ?? "rgba(0,0,0,0.08)",
    },
  };

  return {
    animation: d?.animation === false ? false : undefined,
    indexAxis: horizontal ? "y" : "x",
    aspectRatio: horizontalAspect ?? d?.aspectRatio ?? 2,
    responsive: true,
    maintainAspectRatio: true,
    layout: { padding: CHART_LAYOUT_PADDING },

    plugins: {
      title: buildTitlePlugin(spec, d),

      legend: {
        display: d?.legend?.display ?? multiSeries,
        position: (d?.legend?.position ?? "top") as "top" | "bottom" | "left" | "right",
        align: (d?.legend?.align ?? "center") as "start" | "center" | "end",
        labels: { color: fontColor, font: fontSpec },
      },

      tooltip: {
        enabled: d?.tooltip?.enabled ?? true,
        callbacks: { label: tooltipLabel(mask, protection, isShare) },
      },
    },

    scales: horizontal ? { x: valueScale, y: categoryScale } : { x: categoryScale, y: valueScale },

    elements: {
      line: {
        tension: d?.elements?.line?.tension ?? 0,
        borderWidth: 2,
      },
      point: {
        radius: d?.elements?.line?.pointRadius ?? 3,
      },
      bar: {
        borderRadius: d?.elements?.bar?.borderRadius ?? 0,
      },
    },

    datasets: {
      bar: {
        barPercentage: d?.elements?.bar?.barPercentage ?? 0.9,
      },
    },
  };
}
