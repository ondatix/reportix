/**
 * Config module — parses a TOML config file into an AppConfig object.
 * Usable independently in other projects.
 */
import { parse as parseTOML } from "smol-toml";
import type { AppConfig, ParameterDef, DataSourceDef, SheetDef, TemplateDef, ExportConfig } from "../types";

export function parseConfig(tomlString: string): AppConfig {
  const raw = parseTOML(tomlString) as Record<string, unknown>;

  const parameters: Record<string, ParameterDef> = {};
  if (raw.parameters && typeof raw.parameters === "object") {
    for (const [key, value] of Object.entries(raw.parameters as Record<string, unknown>)) {
      const v = value as Record<string, unknown>;
      parameters[key] = {
        label: String(v.label ?? key),
        type: (v.type as ParameterDef["type"]) ?? "text",
        default: v.default as ParameterDef["default"],
        options: v.options as string[] | undefined,
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
    const fontRaw = e.font as Record<string, unknown> | undefined;
    const pageRaw = e.page as Record<string, unknown> | undefined;
    const marginRaw = pageRaw?.margin as Record<string, unknown> | undefined;

    exportConfig = {
      filename: e.filename as string | undefined,
      locale: e.locale as string | undefined,
      font: fontRaw
        ? {
            family: fontRaw.family as string | undefined,
            size: fontRaw.size as number | undefined,
            headingFamily: fontRaw.heading_family as string | undefined,
          }
        : undefined,
      page: pageRaw
        ? {
            width: pageRaw.width as number | undefined,
            height: pageRaw.height as number | undefined,
            margin: marginRaw
              ? {
                  top: marginRaw.top as number | undefined,
                  right: marginRaw.right as number | undefined,
                  bottom: marginRaw.bottom as number | undefined,
                  left: marginRaw.left as number | undefined,
                }
              : undefined,
          }
        : undefined,
    };
  }

  return { parameters, data, template, export: exportConfig };
}

/**
 * Load the config from the project root (/config.toml).
 * The file is bundled at build time via Vite's ?raw import.
 */
import configRaw from "/config.toml?raw";

export function loadConfig(): AppConfig {
  return parseConfig(configRaw);
}
