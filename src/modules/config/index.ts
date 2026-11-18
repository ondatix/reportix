/**
 * Config module — parses a YAML config file into an AppConfig object.
 * Usable independently in other projects.
 */
import { parse as parseYAML } from "yaml";
import { getLocale, DEFAULT_LOCALE } from "../i18n";
import { fromColumns } from "../types";
import { resolveDateValue } from "../shared/dates";
import type { AppConfig, ParameterDef, DataSourceDef, SheetDef, ColumnDef, TemplateDef, TemplateOption, ExportConfig, ChartDefaults, DataParametersConfig, PreprocessingConfig, JoinDef, JoinColumnSelect, MutationDef, MutationCase, MutationCondition, ParameterStep, TemplateBlock, ValidationConfig, ValidationCondition, ValidationRule } from "../types";

/**
 * Resolve a possibly-localized string for the active locale. A value may be:
 *   • a plain string — used verbatim in every language, or
 *   • a mapping like `{ de: "Titel", en: "Title" }` — the entry for the
 *     current locale is chosen, falling back to the default locale, then to
 *     any provided entry, then to `fallback`.
 * Config is re-parsed when the locale changes, so labels follow the selection.
 */
function resolveLocalized(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const map = value as Record<string, unknown>;
    const picked = map[getLocale()] ?? map[DEFAULT_LOCALE] ?? Object.values(map)[0];
    return String(picked ?? fallback);
  }
  return value === undefined || value === null ? fallback : String(value);
}

/** Parse `data_parameters.category_order` — a map of column name to an ordered list of that column's values. */
function parseCategoryOrder(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [column, order] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(order)) out[column] = order.map(String);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Parse a join `select:` list (each entry a plain string or `{ column, as }`). */
function parseJoinSelect(value: unknown): (string | JoinColumnSelect)[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: (string | JoinColumnSelect)[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      out.push(entry);
    } else if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      if (e.column != null) out.push({ column: String(e.column), as: e.as != null ? String(e.as) : undefined });
    }
  }
  return out.length > 0 ? out : undefined;
}

/** Parse a parameter's `options_from: { dataset, column }`. */
function parseOptionsFrom(value: unknown): ParameterDef["optionsFrom"] {
  if (!value || typeof value !== "object") return undefined;
  const o = value as Record<string, unknown>;
  const dataset = o.dataset != null ? String(o.dataset) : "";
  const column = o.column != null ? String(o.column) : "";
  return dataset && column ? { dataset, column } : undefined;
}

/** Parse a mutation `when:` condition (snake_case keys → camelCase predicate). */
function parseMutationCondition(value: unknown): MutationCondition | undefined {
  if (!value || typeof value !== "object") return undefined;
  const w = value as Record<string, unknown>;
  const c: MutationCondition = {};
  if (w.equals !== undefined) c.equals = w.equals as MutationCondition["equals"];
  if (w.not_equals !== undefined || w.notEquals !== undefined)
    c.notEquals = (w.not_equals ?? w.notEquals) as MutationCondition["notEquals"];
  if (w.in !== undefined) c.in = w.in as MutationCondition["in"];
  if (w.contains !== undefined) c.contains = w.contains as MutationCondition["contains"];
  if (w.starts_with !== undefined || w.startsWith !== undefined)
    c.startsWith = (w.starts_with ?? w.startsWith) as MutationCondition["startsWith"];
  if (w.ends_with !== undefined || w.endsWith !== undefined)
    c.endsWith = (w.ends_with ?? w.endsWith) as MutationCondition["endsWith"];
  if (w.matches !== undefined) c.matches = String(w.matches);
  if (w.gt !== undefined) c.gt = Number(w.gt);
  if (w.gte !== undefined) c.gte = Number(w.gte);
  if (w.lt !== undefined) c.lt = Number(w.lt);
  if (w.lte !== undefined) c.lte = Number(w.lte);
  if (w.empty !== undefined) c.empty = Boolean(w.empty);
  if (w.truthy !== undefined) c.truthy = Boolean(w.truthy);
  return Object.keys(c).length > 0 ? c : undefined;
}

/** Parse a validation `check:` condition tree (leaf keys plus `and`/`or`/`not`). */
function parseValidationCondition(value: unknown): ValidationCondition | undefined {
  if (!value || typeof value !== "object") return undefined;
  const w = value as Record<string, unknown>;
  const leaf = parseMutationCondition(w);
  const cond: ValidationCondition = { ...(leaf ?? {}) };
  if (Array.isArray(w.and)) {
    const and = w.and.map(parseValidationCondition).filter((c): c is ValidationCondition => c !== undefined);
    if (and.length > 0) cond.and = and;
  }
  if (Array.isArray(w.or)) {
    const or = w.or.map(parseValidationCondition).filter((c): c is ValidationCondition => c !== undefined);
    if (or.length > 0) cond.or = or;
  }
  if (w.not !== undefined) {
    const not = parseValidationCondition(w.not);
    if (not) cond.not = not;
  }
  return Object.keys(cond).length > 0 ? cond : undefined;
}

/** Parse a mutation `cases:` list (elif chain, evaluated in order). */
function parseMutationCases(value: unknown): MutationCase[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: MutationCase[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const when = parseMutationCondition(e.when);
    if (!when || e.then === undefined) continue;
    out.push({ when, then: e.then as string | number | boolean });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Resolve an `info:` value (plain string or `{ de, en }` map) to the active
 * locale's string, or undefined when absent/empty. Config is re-parsed on
 * locale switch, so the resolved text follows the language like `label`.
 */
function parseInfo(value: unknown): string | undefined {
  if (value == null) return undefined;
  return resolveLocalized(value, "") || undefined;
}

/** Normalize an `include:` value (scalar or list) to a `string[]` (or undefined). */
function parseInclude(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = Array.isArray(value) ? value : [value];
  const out = list.map((v) => String(v)).filter((s) => s.length > 0);
  return out.length > 0 ? out : undefined;
}

/** Parse one column entry: a plain string, or an object `{ column|name, description, notes, include }`. */
function parseColumn(entry: unknown): ColumnDef | undefined {
  if (typeof entry === "string") {
    const name = entry.trim();
    return name ? { name } : undefined;
  }
  if (entry && typeof entry === "object") {
    const c = entry as Record<string, unknown>;
    const name = String(c.column ?? c.name ?? "").trim();
    if (!name) return undefined;
    const definition = c.definition ?? c.description; // `description` accepted as a legacy alias
    return {
      name,
      definition: definition != null ? String(definition) : undefined,
      info: parseInfo(c.info),
      notes: c.notes != null ? String(c.notes) : undefined,
      include: parseInclude(c.include),
      warning: parseInfo(c.warning),
    };
  }
  return undefined;
}

/** Parse the body of a config object (already merged from one or more YAML files). */
export function parseConfigObject(raw: Record<string, unknown>): AppConfig {
  const parameters: Record<string, ParameterDef> = {};
  if (raw.parameters && typeof raw.parameters === "object") {
    for (const [key, value] of Object.entries(raw.parameters as Record<string, unknown>)) {
      const v = value as Record<string, unknown>;
      parameters[key] = {
        label: resolveLocalized(v.label, key),
        type: (v.type as ParameterDef["type"]) ?? "text",
        default: v.default as ParameterDef["default"],
        options: v.options as string[] | undefined,
        bind: v.bind as string | undefined,
        definition: v.definition != null ? String(v.definition) : undefined,
        info: parseInfo(v.info),
        step: v.step === "template" || v.step === "data" ? v.step : undefined,
        optionsFrom: parseOptionsFrom(v.options_from ?? v.optionsFrom),
        defaultWhen: parseMutationCondition(v.default_when ?? v.defaultWhen),
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
        columns: ((s.columns as unknown[]) ?? [])
          .map(parseColumn)
          .filter((c): c is ColumnDef => c !== undefined),
        definition: (s.definition ?? s.description) != null ? String(s.definition ?? s.description) : undefined,
        info: parseInfo(s.info),
        notes: s.notes != null ? String(s.notes) : undefined,
        include: parseInclude(s.include),
        warning: parseInfo(s.warning),
      }));
      data[key] = { sheets };
    }
  }

  const tplRaw = (raw.template ?? {}) as Record<string, unknown>;
  const filesRaw = tplRaw.files as Array<Record<string, unknown>> | undefined;
  const templateFiles: TemplateOption[] = (filesRaw ?? [])
    .map((f) => ({
      id: f.id != null ? String(f.id) : undefined,
      label: resolveLocalized(f.label, String(f.file ?? "")),
      file: String(f.file ?? ""),
      definition: f.definition != null ? String(f.definition) : undefined,
      info: parseInfo(f.info),
    }))
    .filter((f) => f.file.length > 0);
  const template: TemplateDef = { files: templateFiles };

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
      sectionNumbering: e.section_numbering as boolean | undefined,
      toc: e.toc as boolean | undefined,

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
            position: pageNumRaw.position as string | undefined,
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
    const genderRaw = c.gender as Record<string, unknown> | undefined;

    charts = {
      palette: c.palette as string | undefined,
      gender: genderRaw
        ? {
            male: genderRaw.male as string | undefined,
            female: genderRaw.female as string | undefined,
          }
        : undefined,
      animation: c.animation as boolean | undefined,
      aspectRatio: c.aspect_ratio as number | undefined,
      maxHeightRatio: c.max_height_ratio as number | undefined,

      font: fontRaw
        ? {
            family: fontRaw.family as string | undefined,
            size: fontRaw.size as number | undefined,
            color: fontRaw.color as string | undefined,
          }
        : undefined,

      title: titleRaw
        ? {
            display: titleRaw.display as boolean | undefined,
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
                  trimToData: scaleY.trim_to_data as boolean | undefined,
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
                  maxColumns: barRaw.max_columns as number | undefined,
                }
              : undefined,
          }
        : undefined,
    };
  }

  // `data_protection:` is the former name of this section, kept as an alias so
  // an older config still parses; `data_parameters:` wins when both are given.
  let dataParameters: DataParametersConfig | undefined;
  const dataParamsRaw = raw.data_parameters ?? raw.data_protection;
  if (dataParamsRaw && typeof dataParamsRaw === "object") {
    const dp = dataParamsRaw as Record<string, unknown>;
    dataParameters = {
      smallestGroup: dp.smallest_group as number | undefined,
      // Accepts a literal `YYYY-MM-DD` or a relative token such as
      // `last_year_start`, so the bundled default does not age.
      periodStart: resolveDateValue(dp.period_start),
      periodEnd: resolveDateValue(dp.period_end),
      categoryOrder: parseCategoryOrder(dp.category_order),
    };
  }

  let preprocessing: PreprocessingConfig | undefined;
  if (raw.preprocessing && typeof raw.preprocessing === "object") {
    const p = raw.preprocessing as Record<string, unknown>;

    const mutationsRaw = p.mutations as Array<Record<string, unknown>> | undefined;
    let mutations: MutationDef[] | undefined;
    if (Array.isArray(mutationsRaw)) {
      mutations = mutationsRaw
        .map((m) => ({
          dataset: String(m.dataset ?? ""),
          column: String(m.column ?? ""),
          definition: (m.definition ?? m.description) != null ? String(m.definition ?? m.description) : undefined,
          // `from` accepts a scalar or a list; an `fn` mutation typically needs
          // several columns, a condition mutation tests the first.
          from: Array.isArray(m.from) ? m.from.map(String) : String(m.from ?? ""),
          fn: m.fn != null ? String(m.fn) : undefined,
          options: (m.options ?? undefined) as Record<string, unknown> | undefined,
          when: parseMutationCondition(m.when),
          then: m.then as string | number | boolean | undefined,
          cases: parseMutationCases(m.cases),
          else: m.else as string | number | boolean | undefined,
          elseWarning: parseInfo(m.else_warning ?? m.elseWarning),
        }))
        // An `fn` mutation is complete without `then`/`cases` — the transform
        // computes every value — so it is accepted on `fn` alone.
        .filter(
          (m) =>
            m.dataset &&
            m.column &&
            fromColumns(m).length > 0 &&
            (m.fn || m.then !== undefined || (m.cases?.length ?? 0) > 0)
        );
      if (mutations.length > 0) preprocessing = { ...(preprocessing ?? {}), mutations };
    }

    const joinsRaw = p.joins as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(joinsRaw)) {
      const joins: JoinDef[] = joinsRaw
        .map((j) => ({
          name: String(j.name ?? ""),
          left: String(j.left ?? ""),
          right: String(j.right ?? ""),
          on: j.on as string | undefined,
          leftOn: (j.left_on ?? j.leftOn) as string | undefined,
          rightOn: (j.right_on ?? j.rightOn) as string | undefined,
          type: j.type === "inner" ? ("inner" as const) : ("left" as const),
          select: parseJoinSelect(j.select),
          prefix: j.prefix as string | undefined,
          indicator: j.indicator as string | undefined,
        }))
        .filter((j) => j.name && j.left && j.right);
      if (joins.length > 0) preprocessing = { ...(preprocessing ?? {}), joins };
    }
  }

  let validation: ValidationConfig | undefined;
  if (raw.validation && typeof raw.validation === "object") {
    const v = raw.validation as Record<string, unknown>;
    const rulesRaw = v.rules as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(rulesRaw)) {
      const rules: ValidationRule[] = rulesRaw
        .map((r) => ({
          dataset: String(r.dataset ?? ""),
          column: String(r.column ?? ""),
          definition: (r.definition ?? r.description) != null ? String(r.definition ?? r.description) : undefined,
          check: parseValidationCondition(r.check) ?? {},
        }))
        .filter((r) => r.dataset && r.column && Object.keys(r.check).length > 0);
      if (rules.length > 0) validation = { rules };
    }
  }

  return { parameters, data, template, preprocessing, validation, export: exportConfig, charts, dataParameters };
}

/** Parse a single YAML string into an AppConfig (standalone-friendly wrapper). */
export function parseConfig(yamlString: string): AppConfig {
  return parseConfigObject((parseYAML(yamlString) ?? {}) as Record<string, unknown>);
}

/**
 * Whether a sheet/column with the given `include` list belongs to `templateId`.
 * An omitted/empty `include` means "every template"; otherwise the list must
 * contain the id. With no selected template, everything is included.
 */
/**
 * The parameters asked in one workflow step. `step: template` entries move to
 * step 1 (beside the template chooser), `step: data` entries to the
 * data-validation step; everything else stays with the report parameters.
 * Insertion order is preserved, so the config file's order still drives the
 * form layout.
 */
export function parametersForStep(
  parameters: Record<string, ParameterDef>,
  step: ParameterStep
): Record<string, ParameterDef> {
  return Object.fromEntries(
    Object.entries(parameters).filter(([, def]) => (def.step ?? "parameters") === step)
  );
}

export function includedFor(include: string[] | undefined, templateId?: string): boolean {
  if (!include || include.length === 0) return true;
  if (!templateId) return true;
  return include.includes(templateId);
}

/**
 * Filter data-source definitions to what the given template needs: keep only
 * sheets included for the template, each with only its included columns.
 */
export function dataForTemplate(
  data: Record<string, DataSourceDef>,
  templateId?: string
): Record<string, DataSourceDef> {
  const out: Record<string, DataSourceDef> = {};
  for (const [source, def] of Object.entries(data)) {
    const sheets = def.sheets
      .filter((s) => includedFor(s.include, templateId))
      .map((s) => ({
        ...s,
        columns: s.columns.filter((c) => includedFor(c.include, templateId)),
      }));
    out[source] = { sheets };
  }
  return out;
}

/**
 * Filter data-source definitions down to what the given template blocks
 * actually reference, so the data-loading step only prompts for required
 * sheets/columns. A block's needs are its crosstab spec's `groupby.rows`,
 * `groupby.cols`, `value`, and `filter` columns on its `data` dataset; each
 * need is resolved back to physical columns through the preprocessing
 * pipeline:
 *
 *   - declared column on the dataset's sheet → required as-is;
 *   - mutation-derived column → the mutation's `from` column is required
 *     (recursively, since mutations may chain);
 *   - column supplied by a join (the dataset is a join output) → the column
 *     is resolved on the right sheet (honouring `select`/`as`/`prefix`), and
 *     the join keys become required on both sides.
 *
 * Unresolvable references (e.g. columns that exist in no sheet) are ignored —
 * they are no-ops at render time too. Sheets with no required column are
 * dropped, as are sources with no remaining sheets.
 */
export function requiredDataForBlocks(
  blocks: TemplateBlock[],
  data: Record<string, DataSourceDef>,
  preprocessing?: PreprocessingConfig
): Record<string, DataSourceDef> {
  // Index of declared physical columns per sheet name.
  const declared = new Map<string, Set<string>>();
  for (const source of Object.values(data)) {
    for (const sheet of source.sheets) {
      declared.set(sheet.sheet, new Set(sheet.columns.map((c) => c.name)));
    }
  }

  const mutations = preprocessing?.mutations ?? [];
  const joins = preprocessing?.joins ?? [];
  const joinByName = new Map(joins.map((j) => [j.name, j]));

  const required = new Map<string, Set<string>>();
  const require_ = (sheet: string, col: string) => {
    if (!required.has(sheet)) required.set(sheet, new Set());
    required.get(sheet)!.add(col);
  };

  // Joins whose keys have already been requested. A join may be named after
  // the sheet it reads (`name` = `right`), so resolving its key would ask for
  // the same join's keys again, forever.
  const keyedJoins = new Set<string>();

  /** Map a join-output column name back to the right sheet's column name. */
  const rightColumnFor = (j: JoinDef, col: string): string | undefined => {
    if (j.select) {
      const entries = j.select.map((s) => (typeof s === "string" ? { column: s } : s));
      return entries.find((s) => (s.as ?? s.column) === col)?.column;
    }
    if (j.prefix) return col.startsWith(j.prefix) ? col.slice(j.prefix.length) : undefined;
    return col;
  };

  /** Resolve a needed (dataset, column) to physical requirements. */
  const resolve = (dataset: string, col: string, seen: Set<string>): boolean => {
    const key = `${dataset} ${col}`;
    if (seen.has(key)) return false;
    seen.add(key);

    const join = joinByName.get(dataset);

    /** The join must run → its keys are required on both sides. */
    const requireKeys = () => {
      if (!join || keyedJoins.has(dataset)) return;
      keyedJoins.add(dataset);
      const leftKey = join.leftOn ?? join.on;
      const rightKey = join.rightOn ?? join.on;
      if (leftKey) resolve(join.left, leftKey, new Set());
      if (rightKey) resolve(join.right, rightKey, new Set());
    };

    // A join that does not enrich its source in place (`name !== left`) builds
    // a dataset that exists only once the join has run, so every column read
    // from it needs the keys — not just the ones the right sheet supplies.
    // Columns the left sheet carries, or that a mutation adds to the
    // same-named source sheet, otherwise resolve without ever requesting the
    // keys, and the join then matches nothing and copies in empty values.
    const derivedByJoin = !!join && join.left !== dataset;

    if (declared.get(dataset)?.has(col)) {
      require_(dataset, col);
      if (derivedByJoin) requireKeys();
      return true;
    }

    const mutation = mutations.find((m) => m.dataset === dataset && m.column === col);
    if (mutation) {
      // Require every source column, not just the first: an `fn` mutation
      // derives one column from several, and all of them must be mapped.
      // `reduce` rather than `some`, so resolution is not short-circuited.
      const ok = fromColumns(mutation).reduce(
        (acc, source) => resolve(dataset, source, seen) || acc,
        false
      );
      if (ok && derivedByJoin) requireKeys();
      return ok;
    }

    if (join) {
      if (derivedByJoin && resolve(join.left, col, seen)) {
        requireKeys();
        return true;
      }
      const viaRight =
        col === join.indicator ||
        (() => {
          const rightCol = rightColumnFor(join, col);
          return rightCol ? resolve(join.right, rightCol, seen) : false;
        })();
      if (viaRight) {
        requireKeys();
        return true;
      }
    }
    return false;
  };

  for (const block of blocks) {
    if (block.type === "text") continue;
    const spec = block.type === "chart" ? block.spec.table : block.spec;
    if (!spec?.data) continue;
    const rowCols = Array.isArray(spec.groupby?.rows)
      ? spec.groupby.rows
      : [spec.groupby?.rows];
    const cols = [...rowCols, spec.groupby?.cols, spec.value];
    if (spec.filter && spec.filter !== "Alle" && spec.filter !== "-") cols.push(spec.filter);
    for (const col of cols) {
      if (col) resolve(spec.data, col, new Set());
    }
  }

  const out: Record<string, DataSourceDef> = {};
  for (const [source, def] of Object.entries(data)) {
    const sheets = def.sheets
      .filter((s) => required.has(s.sheet))
      .map((s) => ({
        ...s,
        columns: s.columns.filter((c) => required.get(s.sheet)!.has(c.name)),
      }));
    if (sheets.length > 0) out[source] = { sheets };
  }
  return out;
}

/**
 * Load the config from the project root. `/config.yaml` is a manifest listing
 * the per-section files under `config/`; each is bundled at build time via
 * Vite's `?raw` import, parsed, and shallow-merged (top-level sections are
 * disjoint) before parsing into an AppConfig.
 */
import configManifestRaw from "/config.yaml?raw";

const CONFIG_SECTIONS = import.meta.glob<string>("/config/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});

export function loadConfig(): AppConfig {
  const manifest = (parseYAML(configManifestRaw) ?? {}) as Record<string, unknown>;
  const includes = (manifest.include as unknown[] | undefined) ?? [];
  const paths = includes.length > 0 ? includes.map((p) => String(p)) : Object.keys(CONFIG_SECTIONS);

  const merged: Record<string, unknown> = {};
  for (const rel of paths) {
    const key = rel.startsWith("/") ? rel : `/${rel}`;
    const rawText = CONFIG_SECTIONS[key];
    if (rawText === undefined) {
      throw new Error(`Config section not found: ${rel}`);
    }
    const section = (parseYAML(rawText) ?? {}) as Record<string, unknown>;
    Object.assign(merged, section);
  }
  return parseConfigObject(merged);
}
