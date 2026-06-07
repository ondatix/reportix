# reportix

Fully client-side web app for automated report generation. Built with Vite.js. No server-side rendering, no backend — all logic runs in the browser.

## Tech Stack

- **Vite.js** — build tool and dev server
- Fully client-side (static output, no SSR)

## Common Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server
npm run build      # production build (output: dist/)
npm run preview    # preview production build locally
```

## Core Utilities

Each utility is a self-contained module usable independently in other projects.

0. **Load config** — parse the YAML config file (see Config File); drives all subsequent steps
1. **Load data** — import data files as specified in `[data]` (e.g. `.xlsx`)
2. **Query parameters** — render a form from the `[parameters]` section and collect user inputs
3. **Load report template** — parse the Markdown template file specified in `[template]` (see Template Format)
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

A single YAML config file (`/config.yaml` in the project root) is the entry point for the app. It is bundled at build time and **not uploaded by the user** — only developers edit it. It declares what to ask the user, where to find the data, and which template to use.

**Top-level sections**

```yaml
parameters:
  # Fields queried from the user before report generation begins.
  # Each entry defines the input type, label, and optional default/validation.

data:
  # Defines expected data sources. Each source declares the sheet names
  # and required columns. Used to validate the uploaded .xlsx file.

template:
  # Points to the Markdown template file and sets rendering options.
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
        columns: [month, revenue, growth]
      - sheet: Quarterly
        columns: [quarter, revenue, target]

template:
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

## Architecture

- Modular: each utility (data loader, parameter UI, template parser, renderers, exporter) is an independent module with no hard coupling to the others
- Fully offline: the app requires no internet connection at runtime — all processing runs client-side
- No sensitive data leaves the browser
- Build output in `dist/` is fully static and deployable to any CDN or static host

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

## Key Conventions

- Keep all processing client-side — do not introduce server-side dependencies
- Each module exposes a clean public API so it can be extracted and reused in isolation
- `.env` and `.env*.local` are gitignored — do not hardcode secrets
- **After any change, check `README.md` and update it if necessary.** The README documents user-facing features (chart types, aggregation ops, callout syntax, config keys, modules, security posture). If a change adds, removes, or renames any of those, the README must be updated in the same commit. CLAUDE.md is the canonical reference for the full schema and behaviour — keep the README's summary aligned with it.
- **Whenever `config.yaml` (or the config schema in `src/modules/config/`) changes, update `CONFIG.md` in the same commit.** `CONFIG.md` is the authoritative per-key handbook and must stay in sync with what the parser accepts. It is **bilingual** — keep **both the English and the German version** aligned: any added, removed, renamed, or re-defaulted key must be reflected in both language sections.
