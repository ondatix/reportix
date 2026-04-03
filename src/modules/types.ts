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
}

export interface SheetDef {
  sheet: string;
  columns: string[];
}

export interface DataSourceDef {
  sheets: SheetDef[];
}

export interface TemplateDef {
  file: string;
}

export interface ExportConfig {
  filename?: string;
  font?: {
    family?: string;
    size?: number;
    headingFamily?: string;
  };
  page?: {
    width?: number;   // in twips (1440 twips = 1 inch)
    height?: number;
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
  locale?: string;
}

export interface AppConfig {
  parameters: Record<string, ParameterDef>;
  data: Record<string, DataSourceDef>;
  template: TemplateDef;
  export?: ExportConfig;
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
  x: string;
  y: string | string[];
  type: "bar" | "line" | "pie" | "doughnut" | "scatter";
  title?: string;
  alt?: string;
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
  caption?: string;
}

export interface TableBlock {
  type: "table";
  spec: TableSpec;
}

export type TemplateBlock = TextBlock | ChartBlock | TableBlock;

// ── Parameters (user-collected values) ──────────────────────────────

export type ParameterValues = Record<string, string | number | boolean | string[]>;
