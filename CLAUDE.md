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
- **Chart alt text** is localized too: `generateAltText(spec, data?, locale = getLocale())` keeps its own German/English phrase tables so the Alt Text Module stays self-contained while honouring the selection.
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
  # Lists the bundled Markdown templates the user picks from. Each entry has a
  # `file`, an optional localized `label`, and an optional `id` referenced by
  # the data `include` lists to scope which sheets/columns that template needs.
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

**Templates are generated, not hand-edited.** The files under `templates/` are **build artifacts** (git-ignored). They are produced from a single master, `templates/master.md`, by `scripts/gen-templates.ts` (`npm run gen:templates`, wired as a `predev`/`prebuild`/`pretest` hook). The generator reads `config/template.yaml`, and for every entry with an `id` + `file` writes a filtered copy to `templates/<file>`. Edit `templates/master.md` — not the generated files.

**Section markers** decide which templates a block lands in, reusing the config `include:` vocabulary (HTML comments, so they never render). Unmarked content goes into **every** template:

````markdown
<!-- include: full -->
…only in the template whose id is "full"…
<!-- /include -->
````

The id list is comma/space separated (`<!-- include: full, mandatory -->`); markers must not nest and are stripped from the output. Since the master currently carries no markers, all generated templates are identical until markers are added.

**Chart block:**
````markdown
```chart
data: sales
x: month
y: revenue
type: bar
title: Monthly Revenue
```
````

Supported chart types: `bar`, `line`, `pie`, `doughnut`, `scatter`, `pyramid`, `distance`.

**Grouping (long-form data).** The optional `color` field names a column whose distinct values become the chart's series. Each series is coloured sequentially from the active palette. The renderer pivots long-form rows internally — no pre-aggregation needed — so a single dataset like `(month, region, revenue)` can be plotted as one line per region, one set of grouped bars per region, etc.

| Chart type        | Behaviour with `color`                                                                     |
|-------------------|---------------------------------------------------------------------------------------------|
| `bar`, `line`     | Pivot to wide-form: one series per distinct value; `y` is summed within each `(x, group)`. |
| `scatter`         | One dataset of `{x, y}` points per group; no aggregation.                                  |
| `pie`, `doughnut` | One slice per distinct value; `y` summed (or rows counted if `y` is omitted).              |
| `pyramid`         | `color` is the binary split column (alias for `split`).                                    |

For multi-series `bar` (and `line`) charts, `stacked: true` stacks groups along the value axis instead of placing them side-by-side. Default is dodged (`stacked: false`); pyramid is always stacked regardless of this flag.

````markdown
```chart
data: Stichtag
type: bar
x: QE
y: PersNr
color: Geschlecht
stacked: true
aggregation:
  y: count
```
````

````markdown
```chart
data: sales
x: month
y: revenue
color: region        # one series per distinct region value
type: line
```
````

**Pyramid chart** (population-pyramid layout — horizontal stacked bars mirrored across a central y-axis). Aggregates raw rows internally, so the `data` source contains one row per record (e.g. one row per employee), not pre-summarised values:

````markdown
```chart
data: Stichtag
type: pyramid
y: Entgeltgruppe / Besoldungsgruppe   # category axis
split: Geschlecht                      # column with exactly 2 distinct values
value: Arbeitszeitanteil               # optional — sums this column; omit to count rows
title: Headcount by pay grade and gender
```
````

The `split` field must contain exactly two distinct non-empty values across the dataset; the first encountered renders on the left, the second on the right. Tooltips and x-axis ticks display absolute values, so negative numbers are an implementation detail and not visible to the reader.

**Table block:**
````markdown
```table
data: sales
columns: [month, revenue, growth]
format:
  revenue: currency
  growth: percent
```
````

**Aggregation.** Both chart and table specs accept an `aggregation` field. Supported ops: `identity`, `count`, `sum`, `mean`, `min`, `max`, `median`, `share_total`, `share_group`.
- `count` ignores the field and returns the row count.
- `identity` is the group key (passthrough — used to keep a column verbatim).
- `share_total` returns the group's row count as a percentage of the dataset (after filtering).
- `share_group` interprets the field as a boolean (true / "Ja" / "Yes" / "1" are truthy) and returns the percentage of `true` rows in the group.

*Charts* — `aggregation: { x?, y? }`. Setting `y` to a non-identity op turns on grouping by `x` (and `color`, if set). Defaults: ungrouped charts → `identity` (rows are data points); `color`-grouped or pyramid charts → `sum`.

````markdown
```chart
data: employees
x: department
y: salary
type: bar
aggregation:
  y: mean        # one bar per department, height = average salary
```
````

*Tables* — `aggregation: { <column>: op, ... }`. Columns marked `identity` (or omitted from the map) become group keys; others are aggregated. If the field is absent, rows render verbatim.

````markdown
```table
data: employees
columns: [department, headcount, total_salary]
aggregation:
  department: identity
  headcount: count
  total_salary: sum
format:
  total_salary: currency
```
````

**Row filter (Personenkreis).** Both chart and table specs accept an optional `filter: <column>` that keeps only rows where the column's value is truthy (`true`, `"Ja"`, `"Yes"`, `"true"`, `"1"`). The values `Alle`, `-`, or empty disable the filter. Applied before aggregation.

````markdown
```chart
data: Stichtag
type: bar
x: Geschlecht
y: PersNr
filter: Beurlaubung   # only rows where Beurlaubung is truthy
aggregation: { y: count }
```
````

**Distance plot.** Layout-equivalent to a horizontal grouped bar chart (`indexAxis: 'y'`), used for "X versus Y across categories" comparisons. Requires a `color` field naming the binary group:

````markdown
```chart
data: Stichtag
type: distance
x: Entgeltgruppe / Besoldungsgruppe   # categorical axis (rendered on y)
y: PersNr                              # value axis (rendered on x)
color: Geschlecht                      # binary comparator
aggregation: { y: count }
```
````

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

- **Tables:** affected cells render as `<5` instead of the formatted value.
- **Charts:** affected bars/slices are clamped to the threshold so a small bar is still drawn, and the tooltip displays `<5` instead of the actual number.
- **Applies to** count-like operations (`count`, `sum`, `share_total`, `share_group`). Means/medians/min/max are not masked because they don't reveal group sizes.

## Data Loading

The data step (`src/modules/data-loader/`, driven by `src/app.ts`) does **not** validate the upload against fixed names — instead the user maps their actual data onto the `config.data` sheets/columns. There is no hard schema check; mismatches are resolved by the user, not rejected.

- **Template-scoped definitions** — before rendering the mapping UI, `app.ts` computes `dataForTemplate(config.data, selectedTemplateId)` (exported from `src/modules/config/`), keeping only the sheets/columns whose `include` list contains the selected template's `id` (an omitted/empty `include` ⇒ included in every template). That filtered set drives both the UI and `assembleStore`, so excluded sheets/columns are never requested and produce no warnings. `SheetDef`/`ColumnDef` also carry optional `definition`/`info`/`notes` metadata; `definition`/`info` surface as click-to-open tooltips in the mapping UI (see Info Module). Derived columns (`preprocessing.mutations[]`) likewise accept an optional `definition`.
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

**Why the StMAS templates need both:** the `Zeitraum_*` event sheets (e.g. `Zeitraum_Befoerderung`) carry only event data. Mutations derive the `Beamte`/`Tarifbeschäftigte` classification (from `Entgeltgruppe / Besoldungsgruppe`) on `Stichtag` and the `Beförderung (ja/nein)` / `Höhergruppierung genehmigt` flags (from `Maßnahmenart`) on the event sheet; the `Stichtag → Zeitraum_Befoerderung` join then carries the classification onto each event by `PersNr`. Together they supply every column the Beförderung charts reference in their `filter:` and `y:`.

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
- The resolved YAML chart spec (chart type, title, axis labels, aggregation, filter, optional `altIntro`)
- The resolved dataset (used to enumerate every aggregated data point)

**Generation strategy**
- Derive alt text from the spec and data: chart type, what is being measured (aggregation op + y field), how it is broken down (x axis, color grouping, filter), and when data is provided, an explicit enumeration of every aggregated data point shown in the chart.
- The optional `altIntro` is prepended verbatim.
- The `alt:` field in the YAML spec always takes precedence and bypasses generation entirely.

**Output**
- A plain-text string suitable for an HTML `alt` attribute or DOCX alt text property

**API shape**
```ts
generateAltText(spec: ChartSpec, data?: DataSet): string
```

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
