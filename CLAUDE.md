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

0. **Load config** — parse the TOML/YAML config file (see Config File); drives all subsequent steps
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

A single TOML config file (`/config.toml` in the project root) is the entry point for the app. It is bundled at build time and **not uploaded by the user** — only developers edit it. It declares what to ask the user, where to find the data, and which template to use.

**Top-level sections**

```toml
[parameters]
# Fields queried from the user before report generation begins.
# Each entry defines the input type, label, and optional default/validation.

[data]
# Defines expected data sources. Each source declares the sheet names
# and required columns. Used to validate the uploaded .xlsx file.

[template]
# Points to the Markdown template file and sets rendering options.
```

**Example**

```toml
[parameters]
  [parameters.period]
  label   = "Reporting period"
  type    = "text"
  default = "Q1 2026"

  [parameters.department]
  label   = "Department"
  type    = "select"
  options = ["Sales", "Engineering", "Marketing"]

[data]
  [data.financials]
  [[data.financials.sheets]]
  sheet   = "Monthly"
  columns = ["month", "revenue", "growth"]

  [[data.financials.sheets]]
  sheet   = "Quarterly"
  columns = ["quarter", "revenue", "target"]

[template]
file = "report_template.md"

[export]
filename = "report.docx"
locale   = "de-DE"

  [export.font]
  family          = "Arial"
  size            = 11
  heading_family  = "Arial"

  [export.page]
  width  = 11906   # A4 width in twips
  height = 16838   # A4 height in twips

    [export.page.margin]
    top    = 1417   # ~25 mm
    right  = 1417
    bottom = 1417
    left   = 1417
```

**Supported parameter types:** `text`, `number`, `date`, `select`, `multiselect`, `boolean`

**Export settings:**
- `filename` — output file name (default: `report.docx`)
- `locale` — locale for number/currency formatting
- `font.family` — body text font (default: `Arial`)
- `font.size` — body text size in pt (default: `11`)
- `font.heading_family` — heading font (defaults to `font.family`)
- `page.width` / `page.height` — page dimensions in twips (default: A4)
- `page.margin.*` — top/right/bottom/left margins in twips (default: ~25 mm)

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

All other content is standard Markdown (headings, paragraphs, lists, etc.) and is rendered as text.

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
