# reportix

Fully client-side web app for automated report generation. Built with Vite.js. No server-side rendering, no backend — all logic runs in the browser.

## Tech Stack

- **Vite.js** — build tool and dev server
- Fully client-side (static output, no SSR)

## Common Commands

```bash
npm install         # install dependencies
npm run gen:templates  # generate templates/ from templates/master.md (auto-run by dev/build/test)
npm run dev         # start dev server
npm run build       # production build (output: dist/)
npm run preview     # preview production build locally
```

## Core Utilities

Each utility is a self-contained module usable independently in other projects.

0. **Load config** — parse the YAML config file (see Config File); drives all subsequent steps
1. **Load report template** — parse the Markdown template file specified in `[template]` (see Template Format)
2. **Load data** — the user picks a format (**XLSX** or **CSV**) and maps their actual sheets/columns onto the `[data]`-defined sheets and columns (see Data Loading)
2.5. **Preprocess data** — build derived datasets from `[preprocessing]` (joins; see Data Preprocessing) before rendering
3. **Query parameters** — render a form from the `[parameters]` section and collect user inputs
4. **Generate HTML preview** — render the report in-browser
   - 4.1 Render text (Markdown → HTML)
   - 4.2 Render graphics (YAML chart spec → chart)
   - 4.3 Render tables (YAML table spec → HTML table)
   - 4.4 **Alt text generation** — automatically generate alt texts for charts and graphics (see Alt Text Module)
5. **Export report** — serialize the rendered report to a file (e.g. `.docx`)

## Internationalization (i18n)

The app ships in **German (default)** and **English**, switchable via a language selector at the top of the UI. A self-contained `i18n` module (`src/modules/i18n/`) holds the active locale and a `t(key, params)` lookup with `{placeholder}` interpolation.

- **Every program-authored string** routes through `t()` — step headings, buttons, data-validation warnings, render/chart/aggregation error messages, the per-block "TBD" note, and the DOCX "Table of Contents" heading.
- **Default locale is `de`** (`DEFAULT_LOCALE` in the i18n module). `LOCALES` lists the selectable languages with their native display names.
- **Switching language re-runs `initApp`**, which re-parses the config and re-renders — so all text (including config-driven labels) reflects the new language.
- **Chart alt text** is localized too: `generateAltText(spec, wrangled?, locale = getLocale())` keeps its own German/English phrase tables so the Alt Text Module stays self-contained while honouring the selection.
- **Config labels can be localized**: any `label` (parameters and `template.files`) may be a plain string (same in every language) or a per-locale map `{ de: "…", en: "…" }`, resolved against the active locale at parse time. See Config File.

To add UI text: add the key to both `de` and `en` dictionaries in `src/modules/i18n/index.ts` and call `t("your.key", { ...params })`. Missing keys fall back to the default locale, then to the raw key.

## Config File

The config is the entry point for the app. It is **modular**: `/config.yaml` in the project root is a thin **manifest** with an `include:` list of the per-section files under `config/` (`parameters.yaml`, `data.yaml` — which also carries the `preprocessing:` section, since mutations/joins operate on those sheets — `template.yaml`, `data_protection.yaml`, `export.yaml`, `charts.yaml`). Each section file holds one or more top-level sections; `loadConfig` (in `src/modules/config/`) globs them via `import.meta.glob('/config/*.yaml', { query: '?raw', eager: true })`, parses each, and shallow-merges them (top-level sections are disjoint, so order only documents intent) before `parseConfigObject` builds the `AppConfig`. The files are bundled at build time and **not uploaded by the user** — only developers edit them. The config declares what to ask the user, where to find the data, and which templates to use.

**Top-level sections**

```yaml
parameters:
  # Fields queried from the user before report generation begins.
  # Each entry defines the input type, label, and optional default/validation.

data:
  # Defines expected data sources. Each source declares the sheet names
  # and required columns — these are the **mapping targets** the user maps
  # their uploaded file's actual sheets/columns onto (see Data Loading).
  # Sheets and columns may carry optional metadata: `definition` (German-only)
  # or `info` (bilingual) tooltip text, `notes`, and an `include` list of
  # template ids (omit ⇒ every template). Tooltips also apply to parameters
  # and template options — see the Info Module.

template:
  # `files`: the bundled Markdown templates the user picks from. Each entry has
  # a `file`, an optional localized `label`, and an optional `id` referenced by
  # the data `include` lists to scope which sheets/columns that template needs.
  # `questions`: the question catalog rendered into the templates by
  # `npm run gen:templates` (see Template Format) — ignored at runtime.
```

**Example**

```yaml
parameters:
  period:
    label: "Reporting period"   # plain string: same label in every language
    type: text
    default: "Q1 2026"
  department:
    label:                      # or a per-locale map, resolved to the active language
      de: "Abteilung"
      en: "Department"
    type: select
    options:
      - Sales
      - Engineering
      - Marketing

data:
  financials:
    sheets:
      - sheet: Monthly
        definition: "One row per month"     # optional metadata
        include: [full]                     # optional; omit ⇒ every template
        columns:
          - month                           # plain string, or…
          - column: revenue                 # …object with optional metadata
            definition: "Net revenue"
            include: [full, mandatory]
          - growth
      - sheet: Quarterly
        columns: [quarter, revenue, target]

template:
  files:
    - id: full                              # referenced by data `include` lists
      label: Full report
      file: report_template.md

export:
  filename: report.docx
  locale: de-DE

  document:
    title: Report
    subject: ""
    creator: ""
    description: ""
    keywords: ""

  font:
    family: Arial
    size: 11        # pt
    heading_family: Arial
    color: "1A1A1A"  # hex without #

  headings:
    color: "1F3864"  # hex without #
    h1_size: 20      # pt
    h2_size: 16
    h3_size: 13
    h4_size: 12

  paragraph:
    alignment: left          # left | center | right | justify
    spacing_before: 0        # twips
    spacing_after: 120       # twips
    line_spacing: 276        # twips (276 ≈ single at 11 pt)

  page:
    orientation: portrait    # portrait | landscape
    width: 11906             # A4 width in twips
    height: 16838            # A4 height in twips
    margin:
      top: 1417      # ~25 mm
      right: 1417
      bottom: 1417
      left: 1417
      header: 709    # ~12 mm from top edge to header
      footer: 709    # ~12 mm from bottom edge to footer

  page_numbers:
    position: center # left | center | right | none (footer page-number placement)
    start: 1
    format: decimal  # decimal | upperRoman | lowerRoman | upperLetter | lowerLetter

  header:
    text: ""         # static text in the page header

  footer:
    text: ""         # static text left of the page numbers

  table:
    border_style: single    # single | double | dashed | dotted | thick | none
    border_color: "AAAAAA"  # hex without #
    border_size: 4          # eighths of a point
    cell_padding: 80        # twips (~1.5 mm)

charts:
  animation: false         # disable animation (recommended for reports)
  aspect_ratio: 2.0        # width:height ratio of every chart

  font:
    family: Arial
    size: 12               # pt
    color: "555555"        # hex without #

  title:
    position: top          # top | bottom | left | right
    align: center          # start | center | end
    color: "1A1A1A"

  legend:
    display: true
    position: top
    align: center

  tooltip:
    enabled: true

  scales:
    x:
      begin_at_zero: false
      grid_display: true
      grid_color: "rgba(0,0,0,0.08)"
      tick_color: "888888"
    y:
      begin_at_zero: true
      grid_display: true
      grid_color: "rgba(0,0,0,0.08)"
      tick_color: "888888"

  elements:
    line:
      tension: 0.0          # 0 = straight, ~0.4 = smooth curves
      point_radius: 3
    bar:
      border_radius: 0      # rounded corners in px
      bar_percentage: 0.9   # fraction of category slot (0–1)
```

**Supported parameter types:** `text`, `number`, `date`, `select`, `multiselect`, `boolean`

**Localized labels:** every `label` (parameter labels and `template.files` labels) accepts either a plain string or a per-locale map `{ de: "…", en: "…" }`. The active language (see Internationalization) selects the entry, falling back to the default locale and then to any provided entry.

**Bind paths target the parsed `AppConfig` (camelCase), not the raw YAML keys.** Most leaves are spelled the same in both (`export.font.size`, `export.page.orientation`), but multi-word keys differ: bind to `export.pageNumbers.position`, `export.sectionNumbering`, `dataProtection.smallestGroup` — **not** the snake_case `export.page_numbers.show` etc. A bind to a non-existent path silently no-ops (the override never reaches the consumer). The parser maps snake_case YAML → camelCase in `src/modules/config/`.

**Special parameter widgets** (special-cased by key in `src/modules/parameters/`): `palette` and `font` render as illustrated radios; `page_orientation` and `page_numbers` render as CSS-drawn **icon radios** (page shapes / footer-number positions) so the choices need no translated option text — captions come from the i18n module.

**Structure features (preview + DOCX):**
- The first `# {{title}}` (an `<h1>`) is treated as the **document title** — rendered as a centred title, excluded from the TOC and from section numbering, and placed before the TOC.
- `section_numbering: true` numbers section headings starting at `<h2>` (`1.`, `1.1.`, `1.1.1.`) — in the preview via CSS counters and in the DOCX via per-heading multilevel numbering.
- `toc: true` inserts a table of contents **just before the first `<h2>`** — a Word TOC field in the DOCX and a `<nav class="report-toc">` in the preview (skipped by the exporter so it isn't duplicated).

**Export settings:**
- `filename` — output file name (default: `report.docx`)
- `locale` — locale for number/currency formatting
- `document.*` — metadata written into .docx file properties (title, subject, creator, description, keywords)
- `font.family` — body text font (default: `Arial`)
- `font.size` — body text size in pt (default: `11`)
- `font.heading_family` — heading font (defaults to `font.family`)
- `font.color` — body text color as 6-digit hex without `#` (default: `1A1A1A`)
- `headings.color` — color applied to all headings (default: `000000`)
- `headings.h1_size`–`h4_size` — heading sizes in pt
- `paragraph.alignment` — default text alignment: `left`, `center`, `right`, `justify`
- `paragraph.spacing_before` / `spacing_after` — space around paragraphs in twips
- `paragraph.line_spacing` — line height in twips (276 ≈ single)
- `page.orientation` — `portrait` or `landscape`; auto-swaps A4 dimensions
- `page.width` / `page.height` — page dimensions in twips (default: A4)
- `page.margin.*` — top/right/bottom/left margins plus `header`/`footer` offset from page edge
- `page_numbers.position` — footer page-number placement: `left`, `center`, `right`, or `none` (hides it). Default: `center`. The number is rendered plain (e.g. `1`), without a total. (Legacy `page_numbers.show: false` is still honoured as `position: none`.)
- `page_numbers.start` — starting page number
- `page_numbers.format` — number style: `decimal`, `upperRoman`, `lowerRoman`, `upperLetter`, `lowerLetter`
- `header.text` — static text rendered in the page header
- `footer.text` — static text rendered left of the page numbers in the footer
- `table.border_style` / `border_color` / `border_size` — default table borders
- `table.cell_padding` — default cell padding in twips

**Chart settings (`[charts]`):**
- `animation` — set to `false` to disable chart animation (default: `false`)
- `aspect_ratio` — width:height ratio for all charts (default: `2.0`)
- `font.*` — global font family, size (pt), and color (hex) for all chart text
- `title.position` / `align` / `color` — chart title placement and style
- `legend.display` / `position` / `align` — legend visibility and placement
- `tooltip.enabled` — show/hide hover tooltips
- `scales.x.*` / `scales.y.*` — per-axis: `begin_at_zero`, `grid_display`, `grid_color`, `tick_color`
- `elements.line.tension` — line smoothness: `0` = straight, `~0.4` = curves
- `elements.line.point_radius` — data point marker size in px
- `elements.bar.border_radius` — rounded bar corners in px
- `elements.bar.bar_percentage` — fraction of category slot occupied by bars (0–1)

The config is imported at build time via Vite's `?raw` import and parsed on app startup. When the user uploads an `.xlsx` file, the data-loader validates that the expected sheets exist and contain the required columns before proceeding. The DataStore is keyed by **sheet name** (e.g. `Monthly`), which is what template chart/table blocks reference via their `data:` field.

## Template Format

Templates are Markdown files. Charts and tables are defined as fenced code blocks with a typed language tag. The block body is a YAML specification describing the data binding and formatting.

**Templates are generated, not hand-edited.** The files under `templates/` are **build artifacts** (git-ignored). They are assembled from two sources by `scripts/gen-templates.ts` (`npm run gen:templates`, wired as a `predev`/`prebuild`/`pretest` hook; pure logic in `scripts/gen-templates-lib.ts`):

1. **The prose skeleton** `templates/master.md` — front/back matter plus two generation-time placeholders: `{{questions}}` (inside `## Situationsbeschreibung`) and `{{tables}}` (inside `## Anhang → ### Tabellen`). The generator throws if either is missing. Runtime parameter placeholders such as `{{title}}`/`{{office}}` pass through untouched.
2. **The question catalog** `template.questions` in `config/template.yaml` — a flat, ordered YAML list consumed only by the generator (the runtime config parser ignores the key). For every entry in `template.files` with an `id` + `file`, the generator renders the catalog for that id and writes `templates/<file>`.

Edit `templates/master.md` and `config/template.yaml` — not the generated files.

**Question catalog.** Two entry types, discriminated by their first key:

```yaml
template:
  questions:
    - section: Leistungskomponenten        # emits "### …" + a Definitionen callout;
      definitions:                         # a Fazit callout is appended automatically
                                           #   after the section's last question.
        # Entries reference the definition texts in data.yaml (single source
        # of truth — columns, mutation-derived columns, and sheets by name):
        - "Höhe Leistungskomponente (LK = Leistungsprämien/-entgelt, LOB)"
        - term: Beförderung                # displayed term ≠ data.yaml name
          ref: "Beförderung (ja/nein)"
        - term: LK erhalten                # concept without a data.yaml entry
          text: "Gibt an, ob …"            #   → verbatim text

    - title: "Wie viele Frauen und Männer in den Entgelt-/Besoldungsgruppen erhalten LK?"
      include: full            # template id(s); scalar or list; omit ⇒ every template
      comment: Optional        # italic status line under the heading; omit ⇒ none
      datenquelle: "PVS, Eigene Liste"
      personenkreis: Alle
      caption: "Anteil der Frauen und Männer, die LK erhalten haben."
      text:                    # omit/null ⇒ default freetext placeholder
      table:                   # the crosstab spec shared by chart + appendix table
        data: Zeitraum_Leistungskomponente
        filter: Alle           # optional truthy-row filter
        groupby:
          rows: "Entgeltgruppe / Besoldungsgruppe"
          cols: Geschlecht     # optional
        aggregation: count     # default count
        # value: <column>      # required by sum/mean/min/max/median/share_group
        # format: currency     # optional cell format for the appendix table
      chart:                   # presentation only
        type: bar              # bar | line | pie | doughnut | pyramid | distance
        stacked: true          # bar/line: stack the series
        title: Personen mit LK je Entgelt-/Besoldungsgruppe
```

Per question the generator emits `#### title`, the italic `comment`, a source blockquote `> Datenquelle: {datenquelle} · Personenkreis: {personenkreis} · Datensatz: {table.data}`, a ` ```chart ` block (presentation keys + the nested `table:`; the question `caption` becomes the chart caption unless `chart.caption` overrides it), and the freetext paragraph. Into `{{tables}}` it emits `#### title` + a ` ```table ` block with the same spec and `caption` (falling back to `chart.title`). Sections whose questions are all excluded for a template id are skipped entirely (heading, Definitionen, Fazit). The generator validates the catalog (exactly one of `section`/`title`; `table.data` + `groupby.rows` required; value-ops require `value:`; include ids checked against `template.files[].id`) and fails/warns loudly.

**Definitions resolve against data.yaml.** The generator builds a name → definition lookup from `config/data.yaml` — sheet columns (document order, first wins), then mutation-derived columns, then whole sheets by sheet name — via `buildDefinitionLookup` in `scripts/gen-templates-lib.ts`. A section's `definitions:` entries render as `**term**: text` paragraphs: a plain string looks itself up, `{term, ref}` displays `term` but resolves `ref`, `{term, text}` is verbatim (for concepts with no data.yaml counterpart). A dangling `ref` fails the build. The definition **wording** therefore lives in exactly one place: the `definition:` fields in data.yaml (which also feed the mapping-UI tooltips).

**Section markers** scope remaining **prose** to specific templates, reusing the config `include:` vocabulary (HTML comments, so they never render). Unmarked content goes into **every** template:

````markdown
<!-- include: full -->
…only in the template whose id is "full"…
<!-- /include -->
````

The id list is comma/space separated (`<!-- include: full, mandatory -->`); markers must not nest and are stripped from the output. Questions are scoped via their catalog `include:` field, not markers.

**The crosstab spec (wrangled table).** Chart and table blocks share a single data-shaping description; it is turned into a `WrangledTable` by `wrangleTable(spec, data, threshold)` in the aggregation module (filter → group by `groupby.rows` × optional `groupby.cols`, first-seen order, empty keys skipped → `aggregation` op per cell, with per-cell data-protection flags). The table renderer, the chart renderer, and the alt-text generator all consume this one structure, so they can never disagree.

**Table block** — renders the crosstab as an accessible HTML table (`<th scope="col">` header row: the `groupby.rows` column name plus one header per `cols` value or the value column; `<th scope="row">` per row):

````markdown
```table
data: Stichtag
filter: Tarifbeschäftigte        # optional
groupby:
  rows: Befristet / Unbefristet
  cols: Geschlecht               # optional; omit ⇒ single value column
aggregation: count               # count | sum | mean | min | max | median | share_total | share_group
# value: <column>                # required by sum/mean/min/max/median/share_group
# format: integer | decimal | percent | currency   # optional; default derives from the op
caption: Befristete und unbefristete Arbeitsverhältnisse nach Geschlecht.
```
````

Default cell formatting: share ops render as `x %` (one decimal), whole numbers plainly, other values with two decimals; `format: currency` uses EUR.

**Chart block** — embeds the same spec under `table:` and adds presentation keys:

````markdown
```chart
type: bar                        # bar | line | pie | doughnut | pyramid | distance
stacked: true                    # bar/line only; pyramid is always stacked
title: Tarifbeschäftigte vs. Beamte
caption: …                       # figcaption; alt / alt-intro as below
table:
  data: Stichtag
  groupby:
    rows: Beamte / Tarifbeschäftigte
    cols: Geschlecht
  aggregation: count
```
````

How the crosstab maps onto each chart type:

| Chart type        | Mapping                                                                                       |
|-------------------|-----------------------------------------------------------------------------------------------|
| `bar`, `line`     | rows → category axis, one series per `cols` value. Without `cols`: one series, per-category palette colors, no legend. `stacked: true` stacks the series. |
| `pie`, `doughnut` | rows → slices; `cols` is not supported (error).                                                |
| `pyramid`         | Population-pyramid layout: rows → categories, `cols` must hold exactly 2 distinct values (left = first-seen). Tooltips/ticks show absolute values. |
| `distance`        | Dumbbell plot (`indexAxis: 'y'`): rows → categories, `cols` must hold exactly 2 distinct values; markers + connecting line colored by the leading value. |

**Aggregation.** One op per block: `count` (rows per cell; ignores `value`), `sum` / `mean` / `min` / `max` / `median` (over `value`), `share_total` (cell row count as % of the filtered dataset), `share_group` (interprets `value` as a boolean — true / "Ja" / "Yes" / "1" are truthy — and returns the % of true rows within the cell). Omitting `aggregation` defaults to `count` (normalized by the template parser).

**Row filter (Personenkreis).** The optional `filter: <column>` keeps only rows where the column's value is truthy (`true`, `"Ja"`, `"Yes"`, `"true"`, `"1"`). The values `Alle`, `-`, or empty disable the filter; a missing column is a silent no-op. Applied before grouping/aggregation.

**Callouts.** Pandoc-style fenced divs render as styled boxes (preview + DOCX). Recognised classes: `callout` (generic), `callout-note`, `callout-tip`, `callout-warning`, `callout-caution`, `callout-important`. Optional `title='…'`. Inner content is parsed as Markdown.

````markdown
::: {.callout-note title='Definitionen'}
**Geschlecht:** Im Datensatz wird zwischen männlich und weiblich unterschieden.
:::
````

## Data Protection

Aggregated values smaller than `data_protection.smallest_group` are masked to avoid revealing identifiable individuals (default threshold: 5). Configured globally:

```yaml
data_protection:
  smallest_group: 5
```

The protection flag is computed once per cell in `wrangleTable` (the cell keeps its raw value plus `protected: true`); each consumer applies its own presentation:

- **Tables:** affected cells render as `<5` instead of the formatted value.
- **Charts:** affected bars/slices are clamped to the threshold so a small bar is still drawn, and the tooltip displays `<5` instead of the actual number.
- **Alt texts:** affected cells enumerate as `<5`, matching what the chart shows.
- **Applies to** count-like operations (`count`, `sum`, `share_total`, `share_group`). Means/medians/min/max are not masked because they don't reveal group sizes.

## Data Loading

The data step (`src/modules/data-loader/`, driven by `src/app.ts`) does **not** validate the upload against fixed names — instead the user maps their actual data onto the `config.data` sheets/columns. There is no hard schema check; mismatches are resolved by the user, not rejected.

- **Template-scoped definitions** — before rendering the mapping UI, `app.ts` filters `config.data` in two passes (both exported from `src/modules/config/`): `dataForTemplate(config.data, selectedTemplateId)` applies the manual `include` lists (an omitted/empty `include` ⇒ every template), then `requiredDataForBlocks(parseTemplate(templateText), defs, config.preprocessing)` keeps only the sheets/columns the selected template's chart/table blocks actually reference. Each block's needs (`groupby.rows`/`cols`, `value`, real `filter` columns on its `data` dataset) are resolved back to physical columns through the preprocessing pipeline: mutation-derived columns require their `from` column, join-supplied columns require the right sheet's column plus the join keys on both sides (honouring `select`/`as`/`prefix`); unresolvable references are ignored (they no-op at render time too). The filtered set drives both the UI and `assembleStore`, so unneeded sheets/columns are never requested and produce no warnings. `SheetDef`/`ColumnDef` also carry optional `definition`/`info`/`notes` metadata; `definition`/`info` surface as click-to-open tooltips in the mapping UI (see Info Module) and the `definition` texts double as the source for the templates' Definitionen callouts (see Template Format). Derived columns (`preprocessing.mutations[]`) likewise accept an optional `definition`.
- **Format choice** — two buttons: **XLSX** (one workbook per data source; map each config sheet → a workbook sheet) or **CSV** (one single-table file per config sheet — the per-sheet input also accepts a single-sheet `.xlsx`).
- **Mapping UI** — the config's source→sheets→columns hierarchy is rendered with a `<select>` per sheet (XLSX only) and per column. Options come from the parsed file; the option whose **normalized name** (NFC, trimmed, lower-cased) matches the config name is **pre-selected** (`matchName`). Any choice may be left "(none)".
- **Module API** — `parseWorkbook(buffer)` → `Record<sheet, SourceTable>`; `parseTable(buffer, filename, preferSheet?)` → one `SourceTable` (CSV decoded as text, XLSX prefers the named sheet then the first); `assembleStore(definitions, mapping)` builds the `DataStore` **keyed by config sheet name**, copying each row with the chosen source columns **renamed to the config column names** (only mapped columns are kept). `SourceTable = { columns, rows }`, `DataMapping = Record<configSheet, { table?, columns: Record<configCol, sourceCol> }>`.
- **Warnings, not errors** — on Continue, unmapped sheets/columns produce non-blocking warnings (`data.unmappedSheet` / `data.unmappedColumn`) shown alongside preprocessing warnings; the pipeline proceeds and blocks referencing missing data render as "TBD" notes.

## Data Preprocessing

The `preprocessing` module (`src/modules/preprocessing/`) runs **between data load and rendering**, deriving additional columns and datasets from the loaded sheets. It is config-driven, self-contained, and never throws — structural problems surface as non-blocking warnings shown alongside the data-validation ones. Two operations: **mutations** (derived columns) run first, then **joins**.

### Mutations (derived columns)

A mutation adds a column to a dataset using a **simple if-else rule**: where the condition holds for the `from` value, the new `column` gets `then`, otherwise `else` (default `""`). This is how the StMAS reports derive the `Beamte`/`Tarifbeschäftigte` classification from `Entgeltgruppe / Besoldungsgruppe`, and event flags like `Beförderung (ja/nein)` from `Maßnahmenart`.

```yaml
preprocessing:
  mutations:
    - dataset: Stichtag                          # dataset to add the column to
      column: Beamte                             # new (or overwritten) column
      definition: "…"                            # optional metadata for the derived column
      from: "Entgeltgruppe / Besoldungsgruppe"   # source column the condition tests
      when: { starts_with: [A, B, R, W] }        # condition (omit → "value is truthy")
      then: "Ja"
      else: "Nein"                               # optional (default "")
```

**Condition operators** (inside `when`, combined with AND; scalar ops also accept a list = "any of"): `equals`, `not_equals`, `in`, `contains`, `starts_with`, `ends_with`, `matches` (regex), `gt`/`gte`/`lt`/`lte` (numeric), `empty` (bool), `truthy` (bool — `true`/`Ja`/`Yes`/`1`). String comparisons are NFC + trimmed. Omitting `when` means "the `from` value is truthy".

### Joins

Each join looks up matching rows in `right` by a shared key and copies its columns onto each `left` row, storing the result under `name`. The DataStore is keyed by dataset name, so template `data:` blocks reference a join output exactly like a sheet. Setting `name` equal to `left` **enriches the source in place** — existing `data: <left>` blocks then pick up the added columns with no template change.

```yaml
preprocessing:
  joins:
    - name: Zeitraum_Befoerderung   # output dataset (= left → enrich in place)
      left: Zeitraum_Befoerderung   # base; one output row per left row (left join)
      right: Stichtag               # looked-up sheet
      on: PersNr                    # shared key (or left_on / right_on for different names)
      type: left                    # left (keep unmatched) | inner (drop unmatched)
      # select: omitted → copy every right column not already on the left
      # select: [Beamte, {column: Org, as: Organisationseinheit}]   # explicit
      # prefix: "ST_"               # prepended to copied column names
      # indicator: "matched"        # bool column: did the left row match?
```

**Semantics:**
- **First-match lookup**, not a SQL cross-product — a left row appears at most once even if several right rows share its key (keeps counts/shares stable).
- `type: left` keeps unmatched left rows (copied columns blank, `indicator` false); `type: inner` drops them.
- `select` omitted → enrichment: copy every right column except the key and any already present on the left. Explicit `select` validates each name against the right schema (missing → warning, skipped).
- Joins run **in order, after all mutations**; a later join may reference an earlier join's output, and joins propagate mutation-derived columns.
- Keys are matched after NFC + whitespace normalization (so `PersNr` numbers/strings line up).

**Why the StMAS templates need both:** the `Zeitraum_*` event sheets (e.g. `Zeitraum_Befoerderung`) carry only event data. Mutations derive the `Beamte`/`Tarifbeschäftigte` classification (from `Entgeltgruppe / Besoldungsgruppe`) on `Stichtag` and the `Beförderung (ja/nein)` / `Höhergruppierung genehmigt` flags (from `Maßnahmenart`) on the event sheet; the `Stichtag → Zeitraum_Befoerderung` join then carries the classification onto each event by `PersNr`. Together they supply every column the Beförderung blocks reference in their `filter:` and `value:`.

## Architecture

- Modular: each utility (data loader, parameter UI, template parser, renderers, exporter) is an independent module with no hard coupling to the others
- Fully offline: the app requires no internet connection at runtime — all processing runs client-side
- No sensitive data leaves the browser
- Build output in `dist/` is fully static and deployable to any CDN or static host

## Deployment & handbuch

The app deploys two ways:

- **Static host** — `dist/` is a self-contained static bundle (no runtime/secrets).
- **Docker container** — the multi-stage `Dockerfile` (tracked; the original `.gitignore` wrongly ignored it, so it must stay un-ignored) builds the webapp **and** renders the Quarto handbuch, then serves both from one nginx image. `nginx.conf` maps `/` → webapp (SPA fallback to `/index.html`) and `/handbuch/` → the handbuch (its own `/handbuch/index.html` fallback). This is what `.github/workflows/zerodeploy.yml` (mittwald) deploys — committing the `Dockerfile` switches the deploy from mittwald's autodetect buildpack to a Dockerfile build.

**handbuch** (`handbuch/`) — a [Quarto](https://quarto.org) **book** (German), vendored from its own repo (`ondatix/stmas-reportix-Handbuch`) via `git subtree` (no `--squash`, full history). Update with `git subtree pull --prefix handbuch <url> main`. The only locally-changed file inside `handbuch/` is `_quarto.yml` (we set `output-dir: _site` — books default to `_book/` — and `execute: freeze: auto`); keep edits there minimal to avoid subtree-pull conflicts.

- **Render pipeline.** The `Dockerfile` `handbuch` stage installs only the Quarto CLI (official release tarball, arch-aware via `TARGETARCH`) — **no R/Python**. Pages that execute code are served from the committed `handbuch/_freeze/` cache, produced by rendering **locally** (`cd handbuch && quarto render`). This is the mechanism that lets dynamic (R) handbuch content stay out of the deploy build. `handbuch/_site` and `handbuch/.quarto` are git-ignored; `handbuch/_freeze` is **committed**.
- **Webapp link.** The header has a Handbuch/handbuch button (`#handbuch-link` in `src/app.ts`, label via i18n key `ui.handbuch`) pointing at `/handbuch/`.
- **Single source of truth (planned, not yet built).** The intent is for the handbuch to consume the app's `templates/master.md` and `config/*.yaml` so docs can't drift. Such references (`{{< include ../templates/master.md >}}`, R reading `../config/*.yaml`) resolve only inside this monorepo — they break the standalone handbuch repo and must not be pushed back upstream via `git subtree push`. Keep them in monorepo-only files when implemented.

## Accessibility

The generated report output must be accessible. The following measures apply across all rendering modules:

**Text & Structure**
- Rendered HTML uses semantic elements (`<h1>`–`<h6>`, `<p>`, `<table>`, `<figure>`, etc.)
- Reading order in the DOM matches the visual order
- Sufficient color contrast for all text (WCAG AA minimum: 4.5:1 for normal text, 3:1 for large text)

**Charts & Graphics**
- Every chart includes a descriptive `alt` text — auto-generated by the Alt Text Module, overridable via an explicit `alt:` field in the YAML spec
- Charts are wrapped in `<figure>` with a `<figcaption>` for visible context
- Color palettes are colorblind-safe by default (e.g. avoid red/green combinations); palette overrides should be validated against colorblindness simulation
- Data conveyed by color is also conveyed by shape, pattern, or label — color is never the sole encoding

**Tables**
- Tables use `<th>` with `scope` attributes for row and column headers
- Complex tables include `<caption>`
- No layout tables — `<table>` is only used for data

**Export (e.g. DOCX)**
- Exported files preserve alt texts and heading structure where the format supports it

**Template YAML fields supporting accessibility**
- `alt:` — explicit alt text for charts (bypasses auto-generation entirely)
- `alt-intro:` (alias `altIntro:`) — optional introductory sentence prepended to the auto-generated alt text; useful for describing the chart's role in the surrounding document
- `caption:` — visible caption for charts and tables

## Alt Text Module

A dedicated submodule responsible for generating descriptive alt texts for charts and graphics. Fully offline — no network requests. Independent of the renderers and reusable in other projects.

**Inputs**
- The resolved YAML chart spec (chart type, title, the embedded `table:` crosstab spec, optional `altIntro`)
- The already-wrangled crosstab (`WrangledTable`, the same structure the chart is drawn from — used to enumerate every shown cell)

**Generation strategy**
- Derive alt text from the spec: chart type, what is being measured (aggregation op + `value` column, or the row axis for plain counts/shares), how it is broken down (`groupby.rows`, `groupby.cols`, filter).
- When the wrangled table is provided, append an explicit enumeration of every cell shown in the chart. Privacy-protected cells enumerate as `<threshold`, matching the rendered chart and tables.
- The optional `altIntro` is prepended verbatim.
- The `alt:` field in the YAML spec always takes precedence and bypasses generation entirely.

**Output**
- A plain-text string suitable for an HTML `alt` attribute or DOCX alt text property

**API shape**
```ts
generateAltText(spec: ChartSpec, wrangled?: WrangledTable, locale?: Locale): string
```

**Golden tests** — `test/alt-text/` holds two golden suites (spec-only and with-data) generated against `templates/template_full.md` and the `dummy.xlsx` fixture (run through the real config preprocessing). After intentional output changes, regenerate with `npm run test:bootstrap-alt-text` and review the diff.

## Info Module

A small self-contained module (`src/modules/info/`) that renders **click-to-open tooltips**. A clickable `ⓘ` trigger is placed next to a label/heading; clicking it opens a popup with the text, dismissed by clicking outside or pressing Escape (one popup open at a time). It takes plain strings and returns DOM nodes — no dependency on the rest of the app.

**Two text fields** drive tooltips on config entities (parameters, template options, sheets, columns):
- `definition` — German-only plain string.
- `info` — bilingual `{ de, en }` (or plain string), resolved to the active locale at parse time like `label` (config is re-parsed on locale switch, so tooltips follow the language). `info` wins over `definition`.

**API:** `resolveTooltip(info?, definition?)` picks the text (info first); `createInfoControl(text)` builds the trigger+popup; `attachInfo(target, text?)` appends a control when `text` is non-empty (no-op otherwise). Each workflow **step** heading (template, data, parameters) also gets a tooltip whose text comes from i18n keys `ui.step.<x>.info`. Consumers: `src/app.ts` (steps, template options, sheet/column names) and `src/modules/parameters/` (parameter labels/legends).

## Key Conventions

- Keep all processing client-side — do not introduce server-side dependencies
- Each module exposes a clean public API so it can be extracted and reused in isolation
- `.env` and `.env*.local` are gitignored — do not hardcode secrets
- **After any change, check `README.md` and update it if necessary.** The README documents user-facing features (chart types, aggregation ops, callout syntax, config keys, modules, security posture). If a change adds, removes, or renames any of those, the README must be updated in the same commit. CLAUDE.md is the canonical reference for the full schema and behaviour — keep the README's summary aligned with it.
- **Whenever `config.yaml` (or the config schema in `src/modules/config/`) changes, update `CONFIG.md` in the same commit.** `CONFIG.md` is the authoritative per-key handbuch and must stay in sync with what the parser accepts. It is **bilingual** — keep **both the English and the German version** aligned: any added, removed, renamed, or re-defaulted key must be reflected in both language sections.
