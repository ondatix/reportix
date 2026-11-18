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
    "ui.description": "Willkommen bei <b>reportix</b>! Laden Sie Ihre Daten als Excel- oder CSV-Datei hoch: reportix erstellt daraus alle Tabellen und Grafiken der gewählten Berichtsvorlage und gibt sie in einer vorstrukturierten Microsoft-Word-Datei aus. Alle Daten bleiben in Ihrem Browser.",
    "ui.language": "Sprache",
    "ui.handbuch": "Handbuch",
    "ui.skipToContent": "Zum Inhalt springen",
    "ui.logoAlt": "ondatix Logo",
    "ui.footer.label": "Rechtliches",
    "ui.footer.imprint": "Impressum",
    "ui.footer.accessibility": "Erklärung zur Barrierefreiheit",
    "ui.footer.newTab": "(öffnet in neuem Tab)",
    "ui.step.template": "1. Vorlage wählen",
    "ui.templateChoice.legend": "Berichtsvorlage",
    "ui.step.data": "2. Daten laden",
    "ui.step.validation": "3. Datenvalidierung",
    "ui.step.params": "4. Berichtsparameter",
    "ui.step.preview": "Berichtsvorschau",
    "ui.step.template.info":
      "Wählen Sie die zu erstellende Berichtsvorlage. Die Auswahl der Vorlage bestimmt, welche Daten im nächsten Schritt abgefragt werden.",
    "ui.step.data.info":
      "Laden Sie Ihre Datei(en) hoch und ordnen Sie deren Tabellenblätter und Spalten den erwarteten Feldern zu. Gleichnamige Felder werden automatisch zugeordnet.",
    "ui.step.validation.info":
      "Prüfen Sie hier, wie Ihre Daten eingeordnet werden, und passen Sie die Zuordnung bei Bedarf an. Die Warnungen darunter werden bei jeder Änderung neu berechnet.",
    "ui.step.params.info":
      "Optionale Layout- und Formatierungsmöglichkeiten. Änderungen können, bis auf die Grafiken, auch später noch im Word-Dokument vorgenommen werden.",
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
    "ui.validation.selectAll": "Alle auswählen",
    "ui.validation.selectNone": "Keine auswählen",
    "ui.validation.option": "{value} ({count} Personen)",
    "ui.validation.summary": "{selected} von {values} Werten ausgewählt — {rows} von {total} Zeilen mit Angabe.",
    "ui.validation.noIssues": "Keine Auffälligkeiten in den Daten gefunden.",
    // Accessible name of the ⓘ disclosure button. Kept short on purpose: it
    // becomes part of the accessible name of whatever label/heading hosts it.
    "ui.info.trigger": "Erläuterung: {name}",

    // — Parameter widgets (icon radios) —
    "param.orientation.portrait": "Hochformat",
    "param.orientation.landscape": "Querformat",
    "param.pageNumbers.left": "Links",
    "param.pageNumbers.center": "Zentriert",
    "param.pageNumbers.right": "Rechts",
    "param.pageNumbers.none": "Keine",
    "param.palette.okabe-ito": "Okabe-Ito",
    "param.palette.tol-bright": "Tol – Hell",
    "param.palette.tol-muted": "Tol – Gedeckt",
    "param.palette.ibm": "IBM",
    "param.palette.grayscale": "Graustufen",

    // — Startup / config errors —
    "error.noTemplates":
      "config.template.files ist leer — mindestens eine gebündelte Vorlage angeben.",
    "error.templatesMissing":
      "In config.template.files referenzierte Vorlagendateien sind nicht gebündelt: {names}. Verfügbar in templates/: {available}.",

    // — Data loader (sheet/column mapping) —
    "data.unmappedSheet": "Tabellenblatt „{sheet}“ wurde keiner Datenquelle zugeordnet.",
    "data.unmappedColumn": "Spalte „{column}“ in „{sheet}“ wurde nicht zugeordnet.",

    // — Data loader (upload validation / parse failures) —
    "data.uploadBadType":
      "„{file}“ hat ein nicht unterstütztes Dateiformat. Erlaubt sind: {accepted}.",
    "data.uploadEmpty": "Die Datei „{file}“ ist leer.",
    "data.uploadTooLarge":
      "Die Datei „{file}“ ist mit {size} MB zu groß (Maximum: {max} MB).",
    "data.parseFailed":
      "„{file}“ konnte nicht gelesen werden. Bitte prüfen Sie, ob es sich um eine gültige Excel- bzw. CSV-Datei handelt. ({message})",
    "data.noSheets": "„{file}“ enthält keine lesbaren Tabellenblätter.",
    "data.notWorkbook":
      "„{file}“ ist keine gültige Excel-Arbeitsmappe (.xlsx). Möglicherweise ist die Datei beschädigt oder hat eine falsche Endung — CSV-Dateien laden Sie bitte im CSV-Modus hoch.",
    "data.sheetTooManyRows":
      "Ein Tabellenblatt hat mit {rows} Zeilen zu viele Datenzeilen (Maximum: {max}).",
    "data.sheetTooManyCols":
      "Ein Tabellenblatt hat mit {cols} Spalten zu viele Spalten (Maximum: {max}).",
    "data.sheetTooManyCells":
      "Ein Tabellenblatt enthält mit {cells} Zellen zu viele Zellen (Maximum: {max}).",

    // — Preprocessing (joins) —
    "join.missingLeft": "Join: Linke Datenquelle „{sheet}“ nicht gefunden.",
    "join.missingRight": "Join: Rechte Datenquelle „{sheet}“ nicht gefunden.",
    "join.missingKey": "Join „{name}“: kein Schlüssel angegeben (`on` bzw. `left_on`/`right_on`).",
    "join.missingColumn": "Join: Spalte „{column}“ in „{sheet}“ nicht gefunden — übersprungen.",
    "join.noMatches": "Join: keine Übereinstimmung zwischen „{left}“ und „{right}“ (Schlüsselwerte passen nicht).",
    "mutation.missingDataset": "Mutation: Datensatz „{dataset}“ nicht gefunden.",
    "mutation.missingColumn": "Mutation: Quellspalte „{column}“ in „{dataset}“ nicht gefunden — alle Zeilen erhalten den else-Wert.",
    "mutation.elseHit": "Mutation „{dataset}.{column}“: der else-Zweig wurde bei {count} Zeile(n) verwendet.",
    "agg.suppressed": "n. v.",
    "mutation.missingColumnFn":
      "Mutation: Quellspalte(n) „{column}“ in „{dataset}“ nicht gefunden — die Spalte „{target}“ wird nicht berechnet.",
    "mutation.unknownFn":
      "Mutation: Transformationsfunktion „{fn}“ ist nicht registriert — die Spalte wird nicht erzeugt. Erwartet wird ein benannter Export aus config/functions/.",
    "mutation.fnFailed":
      "Mutation: Transformationsfunktion „{fn}“ ist fehlgeschlagen ({detail}) — die Spalte wird nicht erzeugt.",
    "mutation.fnBadResult":
      "Mutation: Transformationsfunktion „{fn}“ muss ein Array mit {expected} Einträgen liefern (erhalten: {got}) — die Spalte wird nicht erzeugt.",
    "transforms.duplicateFn":
      "Transformationsfunktion „{fn}“ ist mehrfach in config/functions/ definiert — der zuletzt geladene Export gewinnt.",

    // — Validation —
    "validation.missingDataset": "Validierung: Datensatz „{dataset}“ nicht gefunden.",
    "validation.missingColumn": "Validierung: Spalte „{column}“ in „{dataset}“ nicht gefunden.",
    "validation.missingFilterColumn":
      "Filterspalte „{column}“ fehlt in „{dataset}“ — der Filter greift nicht, die betroffenen Abbildungen und Tabellen zeigen den ungefilterten Personenkreis.",
    "validation.ruleFailed": "Validierung „{dataset}.{column}“: {count} Zeile(n) erfüllen die Prüfregel nicht.",

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
    "agg.rowLabel.total": "Gesamt",
    // Header for the row-label column when a table spec omits `groupby.rows`.
    "table.rowHeaderFallback": "Kategorie",

    // — Exporter —
    "export.toc": "Inhaltsverzeichnis",
  },

  en: {
    // — App shell / steps —
    "ui.description": "Welcome to <b>reportix</b>! Upload your data as an Excel or CSV file: reportix builds every table and chart of the chosen report template from it and outputs them in a pre-structured Microsoft Word file. All data stays in your browser.",
    "ui.language": "Language",
    "ui.handbuch": "handbook",
    "ui.skipToContent": "Skip to content",
    "ui.logoAlt": "ondatix logo",
    "ui.footer.label": "Legal",
    "ui.footer.imprint": "Legal notice",
    "ui.footer.accessibility": "Accessibility statement",
    "ui.footer.newTab": "(opens in a new tab, in German)",
    "ui.step.template": "1. Choose Template",
    "ui.templateChoice.legend": "Report template",
    "ui.step.data": "2. Load Data Files",
    "ui.step.validation": "3. Data Validation",
    "ui.step.params": "4. Report Parameters",
    "ui.step.preview": "Report Preview",
    "ui.step.template.info":
      "Choose the report template to generate. The template choice determines which data is requested in the next step.",
    "ui.step.data.info":
      "Upload your file(s) and map their sheets and columns onto the expected fields. Fields with matching names are pre-selected automatically.",
    "ui.step.validation.info":
      "Check how your data is classified and adjust the assignment if needed. The warnings below are recalculated after every change.",
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
    "ui.validation.selectAll": "Select all",
    "ui.validation.selectNone": "Select none",
    "ui.validation.option": "{value} ({count} people)",
    "ui.validation.summary": "{selected} of {values} values selected — {rows} of {total} rows with a value.",
    "ui.validation.noIssues": "No issues found in the data.",
    "ui.info.trigger": "Explanation: {name}",

    // — Parameter widgets (icon radios) —
    "param.orientation.portrait": "Portrait",
    "param.orientation.landscape": "Landscape",
    "param.pageNumbers.left": "Left",
    "param.pageNumbers.center": "Center",
    "param.pageNumbers.right": "Right",
    "param.pageNumbers.none": "None",
    "param.palette.okabe-ito": "Okabe-Ito",
    "param.palette.tol-bright": "Tol – Bright",
    "param.palette.tol-muted": "Tol – Muted",
    "param.palette.ibm": "IBM",
    "param.palette.grayscale": "Grayscale",

    // — Startup / config errors —
    "error.noTemplates":
      "config.template.files is empty — declare at least one bundled template.",
    "error.templatesMissing":
      "Template files referenced in config.template.files are not bundled: {names}. Available in templates/: {available}.",

    // — Data loader (sheet/column mapping) —
    "data.unmappedSheet": 'Sheet "{sheet}" was not mapped to a data source.',
    "data.unmappedColumn": 'Column "{column}" in "{sheet}" was not mapped.',

    // — Data loader (upload validation / parse failures) —
    "data.uploadBadType": '"{file}" has an unsupported file type. Allowed: {accepted}.',
    "data.uploadEmpty": 'The file "{file}" is empty.',
    "data.uploadTooLarge": 'The file "{file}" is too large at {size} MB (maximum: {max} MB).',
    "data.parseFailed":
      '"{file}" could not be read. Please check that it is a valid Excel or CSV file. ({message})',
    "data.noSheets": '"{file}" contains no readable sheets.',
    "data.notWorkbook":
      '"{file}" is not a valid Excel workbook (.xlsx). The file may be damaged or have the wrong extension — please upload CSV files in CSV mode.',
    "data.sheetTooManyRows":
      "A sheet has too many data rows ({rows}; maximum: {max}).",
    "data.sheetTooManyCols":
      "A sheet has too many columns ({cols}; maximum: {max}).",
    "data.sheetTooManyCells":
      "A sheet has too many cells ({cells}; maximum: {max}).",

    // — Preprocessing (joins) —
    "join.missingLeft": 'Join: left data source "{sheet}" not found.',
    "join.missingRight": 'Join: right data source "{sheet}" not found.',
    "join.missingKey": 'Join "{name}": no key specified (`on`, or `left_on`/`right_on`).',
    "join.missingColumn": 'Join: column "{column}" not found in "{sheet}" — skipped.',
    "join.noMatches": 'Join: no rows matched between "{left}" and "{right}" (key values do not line up).',
    "mutation.missingDataset": 'Mutation: dataset "{dataset}" not found.',
    "mutation.missingColumn": 'Mutation: source column "{column}" not found in "{dataset}" — every row gets the else value.',
    "mutation.elseHit": 'Mutation "{dataset}.{column}": the else branch fired for {count} row(s).',
    "agg.suppressed": "n/a",
    "mutation.missingColumnFn":
      'Mutation: source column(s) "{column}" not found in "{dataset}" — the column "{target}" is not computed.',
    "mutation.unknownFn":
      'Mutation: transform function "{fn}" is not registered — the column is not created. Expected a named export from config/functions/.',
    "mutation.fnFailed":
      'Mutation: transform function "{fn}" threw ({detail}) — the column is not created.',
    "mutation.fnBadResult":
      'Mutation: transform function "{fn}" must return an array of {expected} entries (got: {got}) — the column is not created.',
    "transforms.duplicateFn":
      'Transform function "{fn}" is defined more than once in config/functions/ — the last export loaded wins.',

    // — Validation —
    "validation.missingDataset": 'Validation: dataset "{dataset}" not found.',
    "validation.missingColumn": 'Validation: column "{column}" not found in "{dataset}".',
    "validation.missingFilterColumn":
      'Filter column "{column}" is missing from "{dataset}" — the filter has no effect, so the affected charts and tables show the unfiltered population.',
    "validation.ruleFailed": 'Validation "{dataset}.{column}": {count} row(s) fail the check.',

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
    "agg.rowLabel.total": "Total",
    "table.rowHeaderFallback": "Category",

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
