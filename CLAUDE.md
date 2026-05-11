# autoreportix

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
    label: "Reporting period"
    type: text
    default: "Q1 2026"
  department:
    label: "Department"
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
    show: true
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
- `page_numbers.show` — insert page numbers in the footer (default: `true`)
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
- `alt:` — explicit alt text for charts and images
- `caption:` — visible caption for charts and tables

## Alt Text Module

A dedicated submodule responsible for generating descriptive alt texts for charts and graphics. Fully offline — no network requests. Independent of the renderers and reusable in other projects.

**Inputs**
- The resolved YAML chart spec (chart type, title, axis labels)
- The resolved dataset (used to derive data range and trend)

**Generation strategy**
- Derive alt text from the spec and data: chart type, what is being measured, axis labels, data range (min/max), and overall trend (increasing/decreasing/stable)
- The `alt:` field in the YAML spec always takes precedence and bypasses generation entirely

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
