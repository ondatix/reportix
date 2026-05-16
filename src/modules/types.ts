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
}

export interface SheetDef {
  sheet: string;
  columns: string[];
}

export interface DataSourceDef {
  sheets: SheetDef[];
}

export interface TemplateOption {
  /** Human-readable name shown in the template chooser. */
  label: string;
  /** Filename within the bundled `templates/` directory (e.g. `report_template.md`). */
  file: string;
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

export interface AppConfig {
  parameters: Record<string, ParameterDef>;
  data: Record<string, DataSourceDef>;
  template: TemplateDef;
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

export interface ChartSpec {
  data: string;
  /** Categorical axis for non-pyramid charts; not used by pyramid. */
  x?: string;
  /** Series key(s); for pyramid: the category axis (e.g. age group, pay grade). */
  y: string | string[];
  type: "bar" | "line" | "pie" | "doughnut" | "scatter" | "pyramid" | "distance";
  /** Pyramid only — column whose two distinct values split the chart left/right. */
  split?: string;
  /** Pyramid only — column to sum per bucket; if omitted, rows are counted. */
  value?: string;
  /**
   * Categorical column used as the grouping (a.k.a. "hue") axis: rows are
   * pivoted into one series per distinct value, each coloured from the
   * active palette. Works across bar, line, scatter, pie, doughnut, and
   * pyramid (where it acts as the binary split, equivalent to `split`).
   */
  color?: string;
  /**
   * For multi-series bar (and line) charts: stack groups along the value
   * axis instead of placing them side-by-side. Defaults to `false`
   * (dodged). Ignored by pyramid, which is always stacked.
   */
  stacked?: boolean;
  /**
   * How to combine rows that share the same group key. Setting `y` to any
   * non-identity op enables grouping by `x` (and `color` if present).
   * Defaults: ungrouped charts → `identity` (rows are data points);
   * `color`-grouped or pyramid charts → `sum`.
   * Supported ops: identity, count, sum, mean, min, max, median.
   */
  aggregation?: {
    x?: import("./aggregation").AggregationOp;
    y?: import("./aggregation").AggregationOp;
  };
  /**
   * Boolean column whose truthy rows are kept before aggregation. Useful
   * for restricting a chart to a sub-group ("Personenkreis"). Values
   * `Alle`, `-`, or empty disable the filter.
   */
  filter?: string;
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

export interface TableSpec {
  data: string;
  columns: string[];
  format?: Record<string, string>;
  /**
   * Per-column aggregation. Setting any column to a non-identity op enables
   * GROUP BY semantics: rows are grouped by the columns whose op is
   * `identity` (or unspecified), and the others are aggregated. Omitting
   * the field entirely renders rows verbatim.
   */
  aggregation?: Record<string, import("./aggregation").AggregationOp>;
  /** Boolean column whose truthy rows are kept before aggregation. */
  filter?: string;
  caption?: string;
}

export interface TableBlock {
  type: "table";
  spec: TableSpec;
}

export type TemplateBlock = TextBlock | ChartBlock | TableBlock;

// ── Parameters (user-collected values) ──────────────────────────────

export type ParameterValues = Record<string, string | number | boolean | string[]>;
