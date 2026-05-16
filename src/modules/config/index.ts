/**
 * Config module — parses a YAML config file into an AppConfig object.
 * Usable independently in other projects.
 */
import { parse as parseYAML } from "yaml";
import type { AppConfig, ParameterDef, DataSourceDef, SheetDef, TemplateDef, ExportConfig, ChartDefaults, DataProtectionConfig } from "../types";

export function parseConfig(yamlString: string): AppConfig {
  const raw = parseYAML(yamlString) as Record<string, unknown>;

  const parameters: Record<string, ParameterDef> = {};
  if (raw.parameters && typeof raw.parameters === "object") {
    for (const [key, value] of Object.entries(raw.parameters as Record<string, unknown>)) {
      const v = value as Record<string, unknown>;
      parameters[key] = {
        label: String(v.label ?? key),
        type: (v.type as ParameterDef["type"]) ?? "text",
        default: v.default as ParameterDef["default"],
        options: v.options as string[] | undefined,
        bind: v.bind as string | undefined,
      };
    }
  }

  const data: Record<string, DataSourceDef> = {};
  if (raw.data && typeof raw.data === "object") {
    for (const [key, value] of Object.entries(raw.data as Record<string, unknown>)) {
      const v = value as Record<string, unknown>;
      const rawSheets = v.sheets as Record<string, unknown>[] | undefined;
      const sheets: SheetDef[] = (rawSheets ?? []).map((s) => ({
        sheet: String(s.sheet ?? ""),
        columns: (s.columns as string[]) ?? [],
      }));
      data[key] = { sheets };
    }
  }

  const tplRaw = (raw.template ?? {}) as Record<string, unknown>;
  const template: TemplateDef = {
    file: String(tplRaw.file ?? ""),
  };

  let exportConfig: ExportConfig | undefined;
  if (raw.export && typeof raw.export === "object") {
    const e = raw.export as Record<string, unknown>;

    const docRaw = e.document as Record<string, unknown> | undefined;
    const fontRaw = e.font as Record<string, unknown> | undefined;
    const headingsRaw = e.headings as Record<string, unknown> | undefined;
    const paraRaw = e.paragraph as Record<string, unknown> | undefined;
    const pageRaw = e.page as Record<string, unknown> | undefined;
    const marginRaw = pageRaw?.margin as Record<string, unknown> | undefined;
    const pageNumRaw = e.page_numbers as Record<string, unknown> | undefined;
    const headerRaw = e.header as Record<string, unknown> | undefined;
    const footerRaw = e.footer as Record<string, unknown> | undefined;
    const tableRaw = e.table as Record<string, unknown> | undefined;
    const defBoxRaw = e.definition_box as Record<string, unknown> | undefined;
    const sumBoxRaw = e.summary_box as Record<string, unknown> | undefined;

    exportConfig = {
      filename: e.filename as string | undefined,
      locale: e.locale as string | undefined,

      document: docRaw
        ? {
            title: docRaw.title as string | undefined,
            subject: docRaw.subject as string | undefined,
            creator: docRaw.creator as string | undefined,
            description: docRaw.description as string | undefined,
            keywords: docRaw.keywords as string | undefined,
          }
        : undefined,

      font: fontRaw
        ? {
            family: fontRaw.family as string | undefined,
            size: fontRaw.size as number | undefined,
            headingFamily: fontRaw.heading_family as string | undefined,
            color: fontRaw.color as string | undefined,
          }
        : undefined,

      headings: headingsRaw
        ? {
            color: headingsRaw.color as string | undefined,
            h1Size: headingsRaw.h1_size as number | undefined,
            h2Size: headingsRaw.h2_size as number | undefined,
            h3Size: headingsRaw.h3_size as number | undefined,
            h4Size: headingsRaw.h4_size as number | undefined,
          }
        : undefined,

      paragraph: paraRaw
        ? {
            alignment: paraRaw.alignment as string | undefined,
            spacingBefore: paraRaw.spacing_before as number | undefined,
            spacingAfter: paraRaw.spacing_after as number | undefined,
            lineSpacing: paraRaw.line_spacing as number | undefined,
          }
        : undefined,

      page: pageRaw
        ? {
            orientation: pageRaw.orientation as string | undefined,
            width: pageRaw.width as number | undefined,
            height: pageRaw.height as number | undefined,
            margin: marginRaw
              ? {
                  top: marginRaw.top as number | undefined,
                  right: marginRaw.right as number | undefined,
                  bottom: marginRaw.bottom as number | undefined,
                  left: marginRaw.left as number | undefined,
                  header: marginRaw.header as number | undefined,
                  footer: marginRaw.footer as number | undefined,
                }
              : undefined,
          }
        : undefined,

      pageNumbers: pageNumRaw
        ? {
            show: pageNumRaw.show as boolean | undefined,
            start: pageNumRaw.start as number | undefined,
            format: pageNumRaw.format as string | undefined,
          }
        : undefined,

      header: headerRaw
        ? { text: headerRaw.text as string | undefined }
        : undefined,

      footer: footerRaw
        ? { text: footerRaw.text as string | undefined }
        : undefined,

      table: tableRaw
        ? {
            borderStyle: tableRaw.border_style as string | undefined,
            borderColor: tableRaw.border_color as string | undefined,
            borderSize: tableRaw.border_size as number | undefined,
            cellPadding: tableRaw.cell_padding as number | undefined,
          }
        : undefined,

      definitionBox: defBoxRaw
        ? {
            color: defBoxRaw.color as string | undefined,
            background: defBoxRaw.background as boolean | undefined,
          }
        : undefined,

      summaryBox: sumBoxRaw
        ? {
            color: sumBoxRaw.color as string | undefined,
            background: sumBoxRaw.background as boolean | undefined,
          }
        : undefined,
    };
  }

  let charts: ChartDefaults | undefined;
  if (raw.charts && typeof raw.charts === "object") {
    const c = raw.charts as Record<string, unknown>;
    const fontRaw = c.font as Record<string, unknown> | undefined;
    const titleRaw = c.title as Record<string, unknown> | undefined;
    const legendRaw = c.legend as Record<string, unknown> | undefined;
    const tooltipRaw = c.tooltip as Record<string, unknown> | undefined;
    const scalesRaw = c.scales as Record<string, unknown> | undefined;
    const scaleX = scalesRaw?.x as Record<string, unknown> | undefined;
    const scaleY = scalesRaw?.y as Record<string, unknown> | undefined;
    const elemRaw = c.elements as Record<string, unknown> | undefined;
    const lineRaw = elemRaw?.line as Record<string, unknown> | undefined;
    const barRaw = elemRaw?.bar as Record<string, unknown> | undefined;

    charts = {
      palette: c.palette as string | undefined,
      animation: c.animation as boolean | undefined,
      aspectRatio: c.aspect_ratio as number | undefined,

      font: fontRaw
        ? {
            family: fontRaw.family as string | undefined,
            size: fontRaw.size as number | undefined,
            color: fontRaw.color as string | undefined,
          }
        : undefined,

      title: titleRaw
        ? {
            position: titleRaw.position as string | undefined,
            align: titleRaw.align as string | undefined,
            color: titleRaw.color as string | undefined,
          }
        : undefined,

      legend: legendRaw
        ? {
            display: legendRaw.display as boolean | undefined,
            position: legendRaw.position as string | undefined,
            align: legendRaw.align as string | undefined,
          }
        : undefined,

      tooltip: tooltipRaw
        ? { enabled: tooltipRaw.enabled as boolean | undefined }
        : undefined,

      scales: (scaleX || scaleY)
        ? {
            x: scaleX
              ? {
                  beginAtZero: scaleX.begin_at_zero as boolean | undefined,
                  gridDisplay: scaleX.grid_display as boolean | undefined,
                  gridColor: scaleX.grid_color as string | undefined,
                  tickColor: scaleX.tick_color as string | undefined,
                }
              : undefined,
            y: scaleY
              ? {
                  beginAtZero: scaleY.begin_at_zero as boolean | undefined,
                  gridDisplay: scaleY.grid_display as boolean | undefined,
                  gridColor: scaleY.grid_color as string | undefined,
                  tickColor: scaleY.tick_color as string | undefined,
                }
              : undefined,
          }
        : undefined,

      elements: (lineRaw || barRaw)
        ? {
            line: lineRaw
              ? {
                  tension: lineRaw.tension as number | undefined,
                  pointRadius: lineRaw.point_radius as number | undefined,
                }
              : undefined,
            bar: barRaw
              ? {
                  borderRadius: barRaw.border_radius as number | undefined,
                  barPercentage: barRaw.bar_percentage as number | undefined,
                }
              : undefined,
          }
        : undefined,
    };
  }

  let dataProtection: DataProtectionConfig | undefined;
  if (raw.data_protection && typeof raw.data_protection === "object") {
    const dp = raw.data_protection as Record<string, unknown>;
    dataProtection = {
      smallestGroup: dp.smallest_group as number | undefined,
    };
  }

  return { parameters, data, template, export: exportConfig, charts, dataProtection };
}

/**
 * Load the config from the project root (/config.yaml).
 * The file is bundled at build time via Vite's ?raw import.
 */
import configRaw from "/config.yaml?raw";

export function loadConfig(): AppConfig {
  return parseConfig(configRaw);
}
