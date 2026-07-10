/** Shared types for all modules. */

// ── Config ──────────────────────────────────────────────────────────

export type ParameterType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "boolean";

export interface ParameterDef {
  label: string;
  type: ParameterType;
  default?: string | number | boolean;
  options?: string[];
  /**
   * Dotted path into the resolved AppConfig (e.g. `export.font.size`).
   * When set, the form prefills from the value at that path and the user-
   * entered value overrides the preset at runtime. Bound entries do not
   * carry their own `default:` — the bound leaf is the single source of
   * truth. Omit `bind` for standalone parameters (template variables that
   * don't map to a config setting, e.g. `title`, `office`).
   */
  bind?: string;
  /** German-only explanatory text shown as a click-to-open tooltip. */
  definition?: string;
  /** Bilingual tooltip text, resolved to the active locale at parse time. Wins over `definition`. */
  info?: string;
}

/**
 * One required column of a config sheet, plus optional metadata.
 * `include` lists the template ids (see `TemplateOption.id`) this column
 * belongs to; omitted/empty ⇒ included in every template.
 */
export interface ColumnDef {
  name: string;
  definition?: string;
  /** Bilingual tooltip text, resolved to the active locale at parse time. Wins over `definition`. */
  info?: string;
  notes?: string;
  include?: string[];
}

export interface SheetDef {
  sheet: string;
  columns: ColumnDef[];
  definition?: string;
  /** Bilingual tooltip text, resolved to the active locale at parse time. Wins over `definition`. */
  info?: string;
  notes?: string;
  /** Template ids this sheet belongs to; omitted/empty ⇒ every template. */
  include?: string[];
}

export interface DataSourceDef {
  sheets: SheetDef[];
}

export interface TemplateOption {
  /**
   * Stable, translation-free identifier referenced by data `include:` lists to
   * scope which sheets/columns the data step requests for this template.
   */
  id?: string;
  /** Human-readable name shown in the template chooser. */
  label: string;
  /** Filename within the bundled `templates/` directory (e.g. `report_template.md`). */
  file: string;
  /** German-only explanatory text shown as a click-to-open tooltip. */
  definition?: string;
  /** Bilingual tooltip text, resolved to the active locale at parse time. Wins over `definition`. */
  info?: string;
}

export interface TemplateDef {
  /**
   * Choices presented in Step 2. Each entry references a Markdown file
   * under the `templates/` directory bundled at build time. Hard-fails on
   * startup if any referenced file isn't present in the bundle.
   */
  files: TemplateOption[];
}

export interface ExportConfig {
  filename?: string;
  locale?: string;

  /** Document metadata written into the .docx file properties. */
  document?: {
    title?: string;
    subject?: string;
    creator?: string;
    description?: string;
    keywords?: string;
  };

  /** Body text font. */
  font?: {
    family?: string;
    /** Point size (e.g. 11). Stored as half-points internally. */
    size?: number;
    /** Defaults to font.family if omitted. */
    headingFamily?: string;
    /** 6-digit hex without #, e.g. "1A1A1A". */
    color?: string;
  };

  /** Per-level heading overrides. */
  headings?: {
    /** 6-digit hex color applied to all heading levels unless overridden. */
    color?: string;
    /** Point sizes for h1–h4. */
    h1Size?: number;
    h2Size?: number;
    h3Size?: number;
    h4Size?: number;
  };

  /** Default paragraph spacing and alignment. */
  paragraph?: {
    /** "left" | "center" | "right" | "justify" */
    alignment?: string;
    /** Space before paragraph in twips. */
    spacingBefore?: number;
    /** Space after paragraph in twips. */
    spacingAfter?: number;
    /** Line height in twips (276 ≈ single, 360 ≈ 1.5×, 480 ≈ double at 11pt). */
    lineSpacing?: number;
  };

  /** Page size, orientation, and margins (all in twips). */
  page?: {
    /** "portrait" | "landscape" */
    orientation?: string;
    /** Twips. Defaults to A4 (11906). Swapped automatically for landscape. */
    width?: number;
    /** Twips. Defaults to A4 (16838). Swapped automatically for landscape. */
    height?: number;
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
      /** Distance from top edge to header content in twips. */
      header?: number;
      /** Distance from bottom edge to footer content in twips. */
      footer?: number;
    };
  };

  /** Page numbers inserted into the footer. */
  pageNumbers?: {
    /**
     * Footer page-number placement: "left" | "center" | "right" align the
     * number in the footer; "none" hides it. Supersedes the legacy `show`
     * boolean (kept for back-compat: `show: false` ≡ `position: none`).
     */
    position?: string;
    /** @deprecated Use `position`. `false` ≡ `position: none`. */
    show?: boolean;
    /** Starting page number. */
    start?: number;
    /** "decimal" | "upperRoman" | "lowerRoman" | "upperLetter" | "lowerLetter" */
    format?: string;
  };

  /** Static text rendered in the page header (left-aligned). */
  header?: {
    text?: string;
  };

  /** Static text rendered in the page footer alongside optional page numbers. */
  footer?: {
    text?: string;
  };

  /** Default table styling applied to every rendered table. */
  table?: {
    /** Border style: "single" | "double" | "dashed" | "dotted" | "thick" | "none" */
    borderStyle?: string;
    /** 6-digit hex border color, e.g. "999999". */
    borderColor?: string;
    /** Border thickness in eighths of a point. */
    borderSize?: number;
    /** Default cell padding in twips (~80 twips ≈ 1.5 mm). */
    cellPadding?: number;
  };

  /**
   * Number all headings using a multilevel decimal scheme (1., 1.1., 1.1.1., …).
   * Implemented via a docx multilevel numbering config bound to each heading
   * style. Disabled by default.
   */
  sectionNumbering?: boolean;

  /**
   * Insert a Word table-of-contents field at the start of the document.
   * Word will prompt to "update fields" the first time the document is
   * opened — the TOC entries materialise then. Disabled by default.
   */
  toc?: boolean;

  /**
   * Styling for `::: {.callout-note} … :::` blocks (used for definition
   * boxes in the stmas template). The accent colour drives the left
   * border and title text; `background: true` adds a pale tint derived
   * from the accent colour.
   */
  definitionBox?: CalloutBoxConfig;

  /**
   * Styling for `::: {.callout-tip} … :::` blocks (used for summary /
   * "Fazit" boxes).
   */
  summaryBox?: CalloutBoxConfig;
}

export interface CalloutBoxConfig {
  /** 6-digit hex without #. Drives the left-border and title colour. */
  color?: string;
  /** When true, the cell is filled with a pale tint derived from `color`. */
  background?: boolean;
}

/** Global chart rendering defaults applied to every chart. */
export interface ChartDefaults {
  /**
   * Palette ID used by every chart (e.g. `okabe-ito`). Resolved at render
   * time via the palettes module. Overridable via the `palette` parameter.
   */
  palette?: string;
  /** Disable animation — recommended for report generation. */
  animation?: boolean;
  /** width:height ratio (default 2). */
  aspectRatio?: number;

  /** Global font applied to all chart text (titles, labels, ticks). */
  font?: {
    family?: string;
    size?: number;
    /** Hex color without #, e.g. "666666". */
    color?: string;
  };

  title?: {
    /** "top" | "bottom" | "left" | "right" */
    position?: string;
    /** "start" | "center" | "end" */
    align?: string;
    /** Hex color without #. */
    color?: string;
  };

  legend?: {
    display?: boolean;
    /** "top" | "bottom" | "left" | "right" */
    position?: string;
    /** "start" | "center" | "end" */
    align?: string;
  };

  tooltip?: {
    enabled?: boolean;
  };

  scales?: {
    x?: {
      beginAtZero?: boolean;
      gridDisplay?: boolean;
      /** Hex or rgba grid line color. */
      gridColor?: string;
      tickColor?: string;
    };
    y?: {
      beginAtZero?: boolean;
      gridDisplay?: boolean;
      gridColor?: string;
      tickColor?: string;
    };
  };

  elements?: {
    line?: {
      /** Curve tension: 0 = straight lines, ~0.4 = smooth curves. */
      tension?: number;
      /** Point marker radius in pixels. */
      pointRadius?: number;
    };
    bar?: {
      /** Rounded bar corners in pixels. */
      borderRadius?: number;
      /** Fraction of the category slot used by all bars (0–1). */
      barPercentage?: number;
    };
  };
}

export interface DataProtectionConfig {
  /**
   * Minimum aggregated value to display verbatim. Aggregated values strictly
   * less than this threshold (and greater than zero) are replaced with the
   * threshold itself in charts (so a small bar is still drawn) and rendered
   * as `<{threshold}` in tables. Default: 5.
   */
  smallestGroup?: number;
}

// ── Data preprocessing (joins) ──────────────────────────────────────

/** A right-side column to copy onto the left rows, optionally renamed. */
export interface JoinColumnSelect {
  /** Column name in the `right` dataset. */
  column: string;
  /** Output column name (defaults to `column`). */
  as?: string;
}

/**
 * A single join: look up matching rows in `right` by key and copy its columns
 * onto each `left` row. The result is stored under `name` (which may equal
 * `left` to enrich it in place). First-match (lookup) semantics — a left row
 * is never duplicated, even if several right rows share its key.
 */
export interface JoinDef {
  /** Output dataset name (referenced by template `data:` blocks). */
  name: string;
  /** Base dataset — one output row per left row (left join) or per match (inner). */
  left: string;
  /** Dataset to look values up in. */
  right: string;
  /** Join key present in both datasets (shorthand for equal `leftOn`/`rightOn`). */
  on?: string;
  /** Join key in `left` (overrides `on`). */
  leftOn?: string;
  /** Join key in `right` (overrides `on`). */
  rightOn?: string;
  /** `left` (default — keep unmatched left rows) or `inner` (drop them). */
  type?: "left" | "inner";
  /**
   * Right columns to copy. Omit to copy every right column that isn't the key
   * and isn't already present on the left (enrichment). Each entry is a plain
   * column name or `{ column, as }`.
   */
  select?: (string | JoinColumnSelect)[];
  /** Prefix prepended to every copied column name (collision safety). */
  prefix?: string;
  /** Optional boolean column set to whether the left row matched any right row. */
  indicator?: string;
}

/**
 * A predicate tested against a single source-column value. All provided keys
 * are combined with AND. String comparisons are NFC + trimmed; numeric ones
 * (`gt`/`lt`/…) parse the value as a number. Scalar keys also accept a list,
 * which matches if any entry matches.
 */
export interface MutationCondition {
  equals?: string | number | (string | number)[];
  notEquals?: string | number | (string | number)[];
  /** Alias of `equals` with a list. */
  in?: (string | number)[];
  contains?: string | string[];
  startsWith?: string | string[];
  endsWith?: string | string[];
  /** JavaScript regular-expression source tested against the value. */
  matches?: string;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  /** `true` matches empty/blank values; `false` matches non-empty. */
  empty?: boolean;
  /** `true` matches truthy values (`true`/`Ja`/`Yes`/`1`); `false` the inverse. */
  truthy?: boolean;
}

/**
 * Derive a new column on a dataset with a simple if-else rule: where `when`
 * holds for the `from` value, the new `column` gets `then`, otherwise `else`.
 * Omitting `when` means the condition is "value is truthy".
 */
export interface MutationDef {
  /** Dataset to add the column to (modified into a derived copy). */
  dataset: string;
  /** New (or overwritten) column name. */
  column: string;
  /** Human-readable definition of the derived column (metadata). */
  definition?: string;
  /** Source column whose value the condition tests. */
  from: string;
  /** Condition on the `from` value (default: truthy). */
  when?: MutationCondition;
  /** Value written when the condition holds. */
  then: string | number | boolean;
  /** Value written otherwise (default: empty string). */
  else?: string | number | boolean;
}

export interface PreprocessingConfig {
  /** Column derivations (if-else). Applied first, in order, before joins. */
  mutations?: MutationDef[];
  /** Joins applied after mutations, in order; a later join can use an earlier output. */
  joins?: JoinDef[];
}

export interface AppConfig {
  parameters: Record<string, ParameterDef>;
  data: Record<string, DataSourceDef>;
  template: TemplateDef;
  /** Derived datasets (joins) built from the loaded sheets before rendering. */
  preprocessing?: PreprocessingConfig;
  export?: ExportConfig;
  charts?: ChartDefaults;
  dataProtection?: DataProtectionConfig;
}

// ── Data ────────────────────────────────────────────────────────────

/** A named dataset: array of row objects keyed by column name. */
export type DataSet = Record<string, unknown>[];
export type DataStore = Record<string, DataSet>;

// ── Template ────────────────────────────────────────────────────────

export type BlockType = "text" | "chart" | "table";

export interface TextBlock {
  type: "text";
  markdown: string;
}

/**
 * The wrangled-crosstab spec — the single data-shaping description shared
 * by table blocks and (embedded as `table:`) chart blocks. It is turned
 * into a `WrangledTable` by `wrangleTable()` in the aggregation module:
 * filter → group by `groupby.rows` (× `groupby.cols`) → aggregate per cell.
 */
export interface TableSpec {
  /** DataStore key (a config sheet name or preprocessing join output). */
  data: string;
  /**
   * Boolean column whose truthy rows are kept before aggregation. Useful
   * for restricting a block to a sub-group ("Personenkreis"). Values
   * `Alle`, `-`, or empty disable the filter.
   */
  filter?: string;
  /** Crosstab axes: `rows` labels the table rows (chart categories), the
   *  optional `cols` the table columns (chart series). */
  groupby: { rows: string; cols?: string };
  /**
   * Single aggregation op applied per cell (defaulted to `count` by the
   * template parser). Supported: count, sum, mean, min, max, median,
   * share_total, share_group.
   */
  aggregation: import("./aggregation").AggregationOp;
  /** Column the op aggregates — required by sum/mean/min/max/median/share_group. */
  value?: string;
  caption?: string;
  /** Explicit cell format, overriding the op-derived default. */
  format?: "integer" | "decimal" | "percent" | "currency";
}

export interface ChartSpec {
  type: "bar" | "line" | "pie" | "doughnut" | "pyramid" | "distance";
  /** The wrangled-crosstab spec the chart visualises (rows → categories,
   *  cols → series; pyramid/distance require exactly two `cols` values). */
  table: TableSpec;
  /**
   * For multi-series bar (and line) charts: stack the series along the
   * value axis instead of placing them side-by-side. Defaults to `false`
   * (dodged). Ignored by pyramid, which is always stacked.
   */
  stacked?: boolean;
  title?: string;
  /**
   * Explicit alt text. When set, bypasses auto-generation entirely.
   */
  alt?: string;
  /**
   * Optional introductory sentence prepended to the auto-generated alt
   * text. Useful for describing the chart's role in the surrounding
   * document. YAML may use either `altIntro:` or `alt-intro:`.
   */
  altIntro?: string;
  caption?: string;
}

export interface ChartBlock {
  type: "chart";
  spec: ChartSpec;
}

export interface TableBlock {
  type: "table";
  spec: TableSpec;
}

export type TemplateBlock = TextBlock | ChartBlock | TableBlock;

// ── Parameters (user-collected values) ──────────────────────────────

export type ParameterValues = Record<string, string | number | boolean | string[]>;
