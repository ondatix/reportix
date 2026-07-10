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
    "ui.handbuch": "Handbuch",
    "ui.step.template": "1. Vorlage wählen",
    "ui.step.data": "2. Daten laden",
    "ui.step.params": "3. Berichtsparameter",
    "ui.step.preview": "Berichtsvorschau",
    "ui.step.template.info":
      "Wählen Sie die zu erstellende Berichtsvorlage. Die Auswahl bestimmt, welche Daten im nächsten Schritt abgefragt werden.",
    "ui.step.data.info":
      "Laden Sie Ihre Datei(en) hoch und ordnen Sie deren Tabellenblätter und Spalten den erwarteten Feldern zu. Gleichnamige Felder werden automatisch vorausgewählt.",
    "ui.step.params.info":
      "Füllen Sie die Berichtsparameter aus. Diese Werte fließen in den Bericht ein bzw. überschreiben Gestaltungsvorgaben.",
    "ui.button.continue": "Weiter",
    "ui.button.export": "Als .docx exportieren",
    "ui.button.loadValidate": "Daten laden und prüfen",
    "ui.button.generate": "Bericht erstellen",
    "ui.data.warningsHeading": "Warnungen bei der Datenprüfung:",
    "ui.data.warningLine": "[{source}] {message}",
    "ui.data.format": "Dateiformat",
    "ui.data.format.xlsx": "Excel-Arbeitsmappe",
    "ui.data.format.csv": "Einzeldateien",
    "ui.data.uploadWorkbook": "Arbeitsmappe hochladen (.xlsx)",
    "ui.data.uploadFile": "Datei hochladen (.csv oder .xlsx)",
    "ui.data.mapSheet": "Tabellenblatt zuordnen",
    "ui.data.mapColumn": "Spalte zuordnen",
    "ui.data.none": "— keine —",
    "ui.data.edit": "Zuordnung bearbeiten",

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

    // — Data loader (sheet/column mapping) —
    "data.unmappedSheet": "Tabellenblatt „{sheet}“ wurde keiner Datenquelle zugeordnet.",
    "data.unmappedColumn": "Spalte „{column}“ in „{sheet}“ wurde nicht zugeordnet.",

    // — Preprocessing (joins) —
    "join.missingLeft": "Join: Linke Datenquelle „{sheet}“ nicht gefunden.",
    "join.missingRight": "Join: Rechte Datenquelle „{sheet}“ nicht gefunden.",
    "join.missingKey": "Join „{name}“: kein Schlüssel angegeben (`on` bzw. `left_on`/`right_on`).",
    "join.missingColumn": "Join: Spalte „{column}“ in „{sheet}“ nicht gefunden — übersprungen.",
    "join.noMatches": "Join: keine Übereinstimmung zwischen „{left}“ und „{right}“ (Schlüsselwerte passen nicht).",
    "mutation.missingDataset": "Mutation: Datensatz „{dataset}“ nicht gefunden.",
    "mutation.missingColumn": "Mutation: Quellspalte „{column}“ in „{dataset}“ nicht gefunden — alle Zeilen erhalten den else-Wert.",

    // — Renderer —
    "render.kind.chart": "Diagramm",
    "render.kind.table": "Tabelle",
    "render.headingWithLabel": "{kind} „{label}“",
    "render.tbd": "⚠ {heading} — offen: {message}",
    "render.dataSourceNotFound": "Datenquelle „{name}“ nicht gefunden.",

    // — Chart validation —
    "chart.needsBinaryCols":
      "Diagrammtyp „{type}“ benötigt genau 2 verschiedene Werte in der Spaltenachse („{field}“), gefunden: {count}.",
    "chart.pieNoCols":
      "„{type}“-Diagramm unterstützt keine „groupby.cols“-Aufteilung — die Zeilen werden als Segmente dargestellt.",

    // — Wrangled-table value-column headers —
    "agg.valueLabel.count": "Anzahl",
    "agg.valueLabel.share_total": "Anteil (%)",
    "agg.valueLabel.share_group": "Anteil (%)",

    // — Exporter —
    "export.toc": "Inhaltsverzeichnis",
  },

  en: {
    // — App shell / steps —
    "ui.language": "Language",
    "ui.handbuch": "handbuch",
    "ui.step.template": "1. Choose Template",
    "ui.step.data": "2. Load Data Files",
    "ui.step.params": "3. Report Parameters",
    "ui.step.preview": "Report Preview",
    "ui.step.template.info":
      "Choose the report template to generate. Your choice determines which data is requested in the next step.",
    "ui.step.data.info":
      "Upload your file(s) and map their sheets and columns onto the expected fields. Fields with matching names are pre-selected automatically.",
    "ui.step.params.info":
      "Fill in the report parameters. These values feed into the report or override styling presets.",
    "ui.button.continue": "Continue",
    "ui.button.export": "Export as .docx",
    "ui.button.loadValidate": "Load & Validate Data",
    "ui.button.generate": "Generate Report",
    "ui.data.warningsHeading": "Data validation warnings:",
    "ui.data.warningLine": "[{source}] {message}",
    "ui.data.format": "File format",
    "ui.data.format.xlsx": "Excel Workbook",
    "ui.data.format.csv": "Single Files",
    "ui.data.uploadWorkbook": "Upload workbook (.xlsx)",
    "ui.data.uploadFile": "Upload file (.csv or .xlsx)",
    "ui.data.mapSheet": "Map sheet",
    "ui.data.mapColumn": "Map column",
    "ui.data.none": "— none —",
    "ui.data.edit": "Edit mapping",

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

    // — Data loader (sheet/column mapping) —
    "data.unmappedSheet": 'Sheet "{sheet}" was not mapped to a data source.',
    "data.unmappedColumn": 'Column "{column}" in "{sheet}" was not mapped.',

    // — Preprocessing (joins) —
    "join.missingLeft": 'Join: left data source "{sheet}" not found.',
    "join.missingRight": 'Join: right data source "{sheet}" not found.',
    "join.missingKey": 'Join "{name}": no key specified (`on`, or `left_on`/`right_on`).',
    "join.missingColumn": 'Join: column "{column}" not found in "{sheet}" — skipped.',
    "join.noMatches": 'Join: no rows matched between "{left}" and "{right}" (key values do not line up).',
    "mutation.missingDataset": 'Mutation: dataset "{dataset}" not found.',
    "mutation.missingColumn": 'Mutation: source column "{column}" not found in "{dataset}" — every row gets the else value.',

    // — Renderer —
    "render.kind.chart": "Chart",
    "render.kind.table": "Table",
    "render.headingWithLabel": '{kind} "{label}"',
    "render.tbd": "⚠ {heading} — TBD: {message}",
    "render.dataSourceNotFound": 'Data source "{name}" not found.',

    // — Chart validation —
    "chart.needsBinaryCols":
      'Chart type "{type}" needs exactly 2 distinct values in the column axis ("{field}"), found {count}.',
    "chart.pieNoCols":
      '"{type}" chart does not support a "groupby.cols" split — the rows render as its segments.',

    // — Wrangled-table value-column headers —
    "agg.valueLabel.count": "Count",
    "agg.valueLabel.share_total": "Share (%)",
    "agg.valueLabel.share_group": "Share (%)",

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
