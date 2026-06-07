/**
 * i18n module — central, self-contained translation layer for all UI text
 * and program-generated messages (including error messages).
 *
 * Holds a single global "current locale" and a `t(key, params)` lookup with
 * `{placeholder}` interpolation. Modules import `t` (and, where they generate
 * report content, `getLocale`) instead of hardcoding strings, so switching the
 * language re-renders every program text in the selected language.
 *
 * German (`de`) is the default. English (`en`) is the second option.
 *
 * Usable independently in other projects: it has no dependencies on the rest
 * of the app.
 */

export type Locale = "de" | "en";

/** German is the default language. */
export const DEFAULT_LOCALE: Locale = "de";

/** Selectable locales, in display order, with their native display names. */
export const LOCALES: ReadonlyArray<{ code: Locale; label: string }> = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
];

let current: Locale = DEFAULT_LOCALE;

/** The currently active locale. */
export function getLocale(): Locale {
  return current;
}

/** Switch the active locale. Unknown codes fall back to the default. */
export function setLocale(locale: Locale): void {
  current = STRINGS[locale] ? locale : DEFAULT_LOCALE;
}

type Dict = Record<string, string>;

const STRINGS: Record<Locale, Dict> = {
  de: {
    // — App shell / steps —
    "ui.language": "Sprache",
    "ui.step.data": "1. Daten laden",
    "ui.step.template": "2. Vorlage wählen",
    "ui.step.params": "3. Berichtsparameter",
    "ui.step.preview": "Berichtsvorschau",
    "ui.button.continue": "Weiter",
    "ui.button.export": "Als .docx exportieren",
    "ui.button.loadValidate": "Daten laden und prüfen",
    "ui.button.generate": "Bericht erstellen",
    "ui.data.expectedSheets": "{name}\n\t(erwartete Tabellenblätter: {sheets}): ",
    "ui.data.warningsHeading": "Warnungen bei der Datenprüfung:",
    "ui.data.warningLine": "[{source}] {message}",

    // — Parameter widgets (icon radios) —
    "param.orientation.portrait": "Hochformat",
    "param.orientation.landscape": "Querformat",
    "param.pageNumbers.left": "Links",
    "param.pageNumbers.center": "Zentriert",
    "param.pageNumbers.right": "Rechts",
    "param.pageNumbers.none": "Keine",

    // — Startup / config errors —
    "error.noTemplates":
      "config.template.files ist leer — mindestens eine gebündelte Vorlage angeben.",
    "error.templatesMissing":
      "In config.template.files referenzierte Vorlagendateien sind nicht gebündelt: {names}. Verfügbar in templates/: {available}.",

    // — Data loader —
    "data.noFile": "Keine Datei für „{name}“ bereitgestellt.",
    "data.missingSheet": "Tabellenblatt „{sheet}“ fehlt. Gefunden: {found}.",
    "data.emptySheet": "Tabellenblatt „{sheet}“ ist leer.",
    "data.missingColumns":
      "Im Tabellenblatt „{sheet}“ fehlen Spalten: {missing}. Gefunden: {found}.",

    // — Renderer —
    "render.kind.chart": "Diagramm",
    "render.kind.table": "Tabelle",
    "render.headingWithLabel": "{kind} „{label}“",
    "render.tbd": "⚠ {heading} — offen: {message}",
    "render.dataSourceNotFound": "Datenquelle „{name}“ nicht gefunden.",

    // — Chart validation —
    "chart.requiresX": "Diagrammtyp „{type}“ benötigt ein „x“-Feld.",
    "chart.pyramidRequiresColor":
      "Pyramidendiagramm benötigt ein „color“- (oder „split“-)Feld — die binäre Spalte zum Aufteilen.",
    "chart.pyramidRequiresY":
      "Pyramidendiagramm benötigt ein „y“-Feld (die Kategorieachse).",
    "chart.distanceRequiresColor":
      "Distanzdiagramm benötigt ein „color“-Feld (die binäre Vergleichsspalte).",
    "chart.distanceRequiresX":
      "Distanzdiagramm benötigt ein „x“-Feld (die Kategorieachse).",
    "chart.distanceRequiresY":
      "Distanzdiagramm benötigt ein „y“-Feld (den numerischen Wert).",
    "chart.distanceNeeds2":
      "Distanzdiagramm benötigt genau 2 verschiedene Werte in „{field}“, gefunden: {count}.",
    "chart.requiresColor": "„{type}“-Diagramm benötigt ein „color“-Feld.",
    "chart.groupingRequiresX":
      "Diagrammtyp „{type}“ mit Gruppierung benötigt ein „x“-Feld.",
    "chart.groupingRequiresY":
      "Diagrammtyp „{type}“ mit Gruppierung benötigt ein „y“-Feld.",
    "chart.groupedScatterRequiresColor":
      "Gruppiertes Streudiagramm benötigt ein „color“-Feld.",

    // — Aggregation (pyramid split validation) —
    "agg.pyramidNeeds2":
      "Pyramidendiagramm benötigt genau 2 verschiedene Werte in „{field}“, gefunden: {count}.",
    "agg.pyramidExtra":
      "Pyramidendiagramm benötigt genau 2 verschiedene Werte in „{field}“. Zusätzliche Werte gefunden: {extras}.",

    // — Exporter —
    "export.toc": "Inhaltsverzeichnis",
  },

  en: {
    // — App shell / steps —
    "ui.language": "Language",
    "ui.step.data": "1. Load Data Files",
    "ui.step.template": "2. Choose Template",
    "ui.step.params": "3. Report Parameters",
    "ui.step.preview": "Report Preview",
    "ui.button.continue": "Continue",
    "ui.button.export": "Export as .docx",
    "ui.button.loadValidate": "Load & Validate Data",
    "ui.button.generate": "Generate Report",
    "ui.data.expectedSheets": "{name}\n\t(expected sheets: {sheets}): ",
    "ui.data.warningsHeading": "Data validation warnings:",
    "ui.data.warningLine": "[{source}] {message}",

    // — Parameter widgets (icon radios) —
    "param.orientation.portrait": "Portrait",
    "param.orientation.landscape": "Landscape",
    "param.pageNumbers.left": "Left",
    "param.pageNumbers.center": "Center",
    "param.pageNumbers.right": "Right",
    "param.pageNumbers.none": "None",

    // — Startup / config errors —
    "error.noTemplates":
      "config.template.files is empty — declare at least one bundled template.",
    "error.templatesMissing":
      "Template files referenced in config.template.files are not bundled: {names}. Available in templates/: {available}.",

    // — Data loader —
    "data.noFile": 'No file provided for "{name}".',
    "data.missingSheet": 'Missing sheet "{sheet}". Found: {found}.',
    "data.emptySheet": 'Sheet "{sheet}" is empty.',
    "data.missingColumns":
      'Sheet "{sheet}" is missing columns: {missing}. Found: {found}.',

    // — Renderer —
    "render.kind.chart": "Chart",
    "render.kind.table": "Table",
    "render.headingWithLabel": '{kind} "{label}"',
    "render.tbd": "⚠ {heading} — TBD: {message}",
    "render.dataSourceNotFound": 'Data source "{name}" not found.',

    // — Chart validation —
    "chart.requiresX": 'Chart type "{type}" requires an "x" field.',
    "chart.pyramidRequiresColor":
      'Pyramid chart requires a "color" (or "split") field — the binary column to split on.',
    "chart.pyramidRequiresY": 'Pyramid chart requires a "y" field (the category axis).',
    "chart.distanceRequiresColor":
      'Distance chart requires a "color" field (the binary column to compare).',
    "chart.distanceRequiresX": 'Distance chart requires an "x" field (the category axis).',
    "chart.distanceRequiresY": 'Distance chart requires a "y" field (the numeric value).',
    "chart.distanceNeeds2":
      'Distance chart needs exactly 2 distinct values in "{field}", found {count}.',
    "chart.requiresColor": '"{type}" chart requires a "color" field.',
    "chart.groupingRequiresX": 'Chart type "{type}" with grouping requires an "x" field.',
    "chart.groupingRequiresY": 'Chart type "{type}" with grouping requires a "y" field.',
    "chart.groupedScatterRequiresColor": 'Grouped scatter requires a "color" field.',

    // — Aggregation (pyramid split validation) —
    "agg.pyramidNeeds2":
      'Pyramid chart needs exactly 2 distinct values in "{field}", found {count}.',
    "agg.pyramidExtra":
      'Pyramid chart needs exactly 2 distinct values in "{field}". Extra values found: {extras}.',

    // — Exporter —
    "export.toc": "Table of Contents",
  },
};

/**
 * Translate `key` in the current locale, interpolating any `{name}`
 * placeholders from `params`. Falls back to the default locale, then to the
 * raw key, so a missing translation is visible rather than fatal.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = STRINGS[current] ?? STRINGS[DEFAULT_LOCALE];
  let s = dict[key] ?? STRINGS[DEFAULT_LOCALE][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
