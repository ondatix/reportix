<img src="img/ondatix_Logo_dunkel.png" alt="Reportix Logo" class="logo" height="80" align="right"/><br><br>

# reportix

Fully client-side web app for automated report generation. Upload an Excel workbook or CSV files, map their sheets/columns to the report's data, fill in a parameter form, and export a styled `.docx` — all in the browser, no server, no network at runtime.

## Why

Many reporting workflows (HR equality reports, internal KPIs, compliance summaries) need to combine sensitive tabular data with a fixed narrative structure. reportix lets a developer ship that structure as a bundled config + template, and lets a non-technical user produce the finished `.docx` themselves without the data ever leaving their machine.

## Features

- **Fully offline** — no backend, no fetch, no third-party CDN at runtime. Browser CSP enforces this.
- **Markdown templates** with embedded chart / table YAML blocks and Pandoc-style callouts.
- **Six chart types**: `bar`, `line`, `pie`, `doughnut`, `scatter`, `pyramid`, `distance` (dumbbell plot).
- **Long-form data support**: `color: <column>` pivots a single dataset into one series per distinct value.
- **Data preprocessing**: `config.yaml` can define **mutations** (derive a new column with a simple if-else rule, e.g. classify `Beamte`/`Tarifbeschäftigte` from the pay grade) and **joins** (enrich one sheet with columns looked up from another by a shared key, e.g. attach `Stichtag` master-data onto each `Zeitraum_*` event by `PersNr`) — applied before rendering.
- **Aggregation**: `count`, `sum`, `mean`, `min`, `max`, `median`, `share_total`, `share_group`, `identity` — for both charts and tables.
- **Row filtering**: `filter: <bool-column>` keeps only matching rows before aggregation.
- **Data protection**: aggregated values below a configurable threshold are masked (`<5` in tables, clamped + masked tooltip in charts) for count-like operations.
- **Accessible by default**: WCAG-AA colour palettes, colorblind-safe defaults, semantic HTML, auto-generated alt text for every chart.
- **Bilingual UI (German / English)**: a language selector switches every program text — labels, buttons, validation warnings, error messages, and auto-generated chart alt text. German is the default; English is the second option.
- **Configurable export**: fonts, page layout, headers/footers, page numbers, callout colours and backgrounds, all driven by `config.yaml`.
- **Per-block error isolation**: a malformed chart or table is replaced with a red "TBD" note; the rest of the report still renders.

## Requirements

**To develop or build:**
- **Node.js ≥ 20** (Vite 8 requires Node 20.19+ or 22.12+)
- **npm** (ships with Node)

**To use the built app:**
- A modern evergreen browser (Chrome, Firefox, Safari, Edge — anything supporting ES2022 and the Canvas 2D API)
- An `.xlsx` workbook or CSV files with the data — sheet/column names need **not** match `config.yaml`; you map them in the UI
- A Markdown template (see [Template Format](#template-format))

**To deploy:**
- Any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3+CloudFront, nginx, …). The build output in `dist/` is fully static — no runtime, no environment variables, no secrets.

## Quick Start
Open a terminal/shell in the repository root to use these commands, when you need them.

```bash
npm install         # install dependencies
npm run dev         # start the dev server (http://localhost:5173)
npm run build       # production build (output: dist/)
npm run preview     # preview the production build locally
```

The dev server reloads on save. The production build under `dist/` is a fully static bundle deployable to any CDN or static host.

## How It Works

The app runs a strict pipeline:

1. **Load config** — `/config.yaml` is bundled at build time and parsed on startup.
2. **Choose template** — user picks one of the bundled Markdown templates listed under `template.files` in the config (radio chooser with human-readable labels). Templates live in `templates/` and are bundled at build time.
3. **Load data** — user picks a format (**XLSX** workbook per source, or **CSV** — one single-table file per sheet, also accepting a single-sheet `.xlsx`) and **maps** their actual sheets/columns onto the config's sheets/columns. Options pre-select by matching name, so a file that already uses the config names needs no manual mapping. Unmapped names surface as non-blocking warnings on Continue (blocks referencing missing data render as red "TBD" notes).
3b. **Preprocess** — any `preprocessing` defined in the config runs before rendering: `mutations` derive new columns (if-else rules), then `joins` enrich one sheet with another's columns by a shared key.
4. **Fill parameters** — a form is generated from the config's `parameters` section.
5. **Render preview** — Markdown becomes semantic HTML; chart / table YAML blocks become Chart.js canvases and accessible `<table>`s with auto-generated alt text.
6. **Export DOCX** — the rendered DOM is walked and serialised to a `.docx` file with the configured page layout, fonts, callouts, and chart images.

No step talks to a server. The XLSX/CSV is read in-browser via SheetJS; the DOCX is built in-browser via [docx](https://www.npmjs.com/package/docx) and saved via [FileSaver](https://www.npmjs.com/package/file-saver).

## Configuration (`config.yaml`)

The config is the entry point — a developer edits it, the end user never touches it. It declares:

- **`parameters`** — form fields shown before report generation (`text`, `number`, `date`, `select`, `multiselect`, `boolean`). Each entry is either **standalone** (template variable, prefilled from `default:`) or **bound** to a config leaf via `bind: <dotted.path>` — bound entries prefill from the path's preset and write the user's value back to that path at runtime, letting most styling and metadata keys be overridden per report. The names `palette`, `font`, `page_orientation`, and `page_numbers` get special UI widgets (illustrated / icon radios — translation-free choices). Each `label` may be a plain string or a per-locale map `{ de: "…", en: "…" }` resolved to the [selected language](#features). **Bind paths target the parsed config (camelCase)** — e.g. `export.pageNumbers.position`, `export.sectionNumbering`, `dataProtection.smallestGroup` — not the snake_case YAML keys.
- **`data`** — expected data sources, each with sheet names and required columns. These are the **mapping targets**: the user maps their uploaded file's actual sheets/columns onto these names (pre-selected when names match), rather than the upload being hard-validated.
- **`preprocessing`** — optional derived columns and datasets built before rendering. **`mutations`** (run first) add a column via a simple if-else rule: where `when` holds for the `from` value the new `column` gets `then`, else `else` (operators: `equals`, `in`, `contains`, `starts_with`, `ends_with`, `matches`, `gt`/`lt`/`gte`/`lte`, `empty`, `truthy`). **`joins`** then enrich a `left` sheet with columns from a `right` sheet matched on a key (`on`, or `left_on`/`right_on`); `type` is `left` or `inner`; omit `select` to copy all non-overlapping right columns, or list specific ones (`{column, as}` to rename); `indicator` adds a boolean "matched?" column. Setting `name` = `left` enriches the sheet in place. First-match lookup (left rows are never duplicated).
- **`template.files`** — list of bundled Markdown templates shown as a radio chooser in Step 2. Each entry has a `label` (shown to the user) and a `file` (filename within `templates/`). The app hard-fails at startup if any referenced file isn't bundled.
- **`export`** — DOCX styling: filename, locale, document metadata, fonts, heading sizes/colours, paragraph spacing, page size & margins, **page numbers** (`page_numbers.position`: `left`/`center`/`right`/`none`), header/footer text, table borders, **section numbering** (`section_numbering: true` numbers section headings `1.`, `1.1.`, … in both preview and DOCX), **table of contents** (`toc: true` builds one in the preview and as a Word TOC field), **callout box colours and backgrounds** (`definition_box`, `summary_box`). The first `# {{title}}` is treated as the document title (placed before the TOC, not numbered).
- **`charts`** — Chart.js defaults: animation, aspect ratio, fonts, title/legend/tooltip placement, axis grid colours, line/bar element styling.
- **`data_protection.smallest_group`** — privacy threshold for aggregated counts/shares (default 5).

## Template Format

Templates are plain Markdown. Charts and tables are fenced code blocks with a typed language tag and a YAML body.

````markdown
# {{title}}

::: {.callout-note title='Definitionen'}
**Geschlecht:** Im Datensatz wird zwischen männlich und weiblich unterschieden.
:::

## Headcount by pay grade

```chart
data: Stichtag
type: pyramid
y: Entgeltgruppe / Besoldungsgruppe
color: Geschlecht
title: Headcount by pay grade and gender
aggregation:
  y: count
```

```table
data: Stichtag
columns: [Entgeltgruppe / Besoldungsgruppe, PersNr]
aggregation:
  Entgeltgruppe / Besoldungsgruppe: identity
  PersNr: count
```
````

Parameters from the form are interpolated as `{{paramName}}` anywhere in the text.

## Modules

Each utility is a self-contained module under `src/modules/` with a clean public API, so it can be extracted and reused independently. There is no hard coupling between modules — they're orchestrated by `src/app.ts`.

| Module | Responsibility |
|---|---|
| `i18n/` | Central translation layer (German / English) with `t(key, params)` lookup; drives all UI text, error messages, and chart alt text. |
| `config/` | Parse `/config.yaml` (bundled via `?raw` import) into a typed `AppConfig`. |
| `data-loader/` | Parse `.xlsx` workbooks / CSV files via SheetJS; assemble a DataStore from the user's sheet/column mapping (renames to config names). |
| `preprocessing/` | Derive columns and datasets from the loaded sheets before rendering — mutations (if-else derived columns) and joins (lookup/enrichment), defined in `config.yaml`. |
| `parameters/` | Render the form from `AppConfig.parameters`, collect typed values. |
| `template/` | Parse Markdown into typed blocks (`text` / `chart` / `table`). |
| `aggregation/` | Aggregation ops, row filtering, data-protection helpers. |
| `palettes/` | Curated accessible colour palettes (Okabe-Ito, Tol Bright/Muted, IBM, grayscale). |
| `fonts/` | Curated accessible system fonts (Verdana, Tahoma, Arial, Georgia). |
| `renderer/` | Markdown→HTML (`text.ts`), Chart.js (`chart.ts`), HTML tables (`table.ts`), orchestration (`index.ts`). |
| `alt-text/` | Spec-derived chart alt text generation — fully offline, no LLM. |
| `exporter/` | DOM → docx conversion (paragraphs, headings, lists, tables, callouts, embedded chart images). |

## Security & Privacy

All processing runs entirely in the browser. No data is ever transmitted to a server — uploaded files and generated reports stay local.

### Subresource Integrity (SRI)

All JavaScript and CSS assets are bundled at build time by Vite. No external CDN scripts are loaded at runtime, so there are no third-party resources to protect against. As an additional layer, `vite-plugin-sri3` appends `integrity=` hashes to every `<script>` and `<link>` tag in the built `index.html`, so a compromised static host cannot silently swap a built asset.

### Content Security Policy (CSP)

A strict CSP is applied in two complementary ways:

**1. `<meta>` tag (`index.html`)** — enforced by the browser for all deployments:

```
default-src 'self'; script-src 'self'; style-src 'self';
img-src 'self' data: blob:; font-src 'self';
connect-src 'none'; object-src 'none';
base-uri 'self'; form-action 'self';
```

`connect-src 'none'` is intentional: the app makes zero network requests at runtime, so any accidental fetch or XHR is blocked at the browser level.
`img-src data: blob:` is required for Chart.js canvas export and FileSaver file downloads.

**2. HTTP response header (`public/_headers`)** — used by Netlify and compatible static hosts. Extends the meta policy with `frame-ancestors 'none'` (which `<meta>` cannot set) and adds hardening headers:

```
Content-Security-Policy: ... frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
```

For other hosts, translate `public/_headers` to the equivalent config (e.g. `vercel.json` `headers`, nginx `add_header`).

### HTTPS

HTTPS must be enforced at the hosting level. Enable "Force HTTPS" in your hosting provider's dashboard (Netlify, Vercel, Cloudflare Pages, and GitHub Pages all provide free automatic TLS). The `Strict-Transport-Security` header in `public/_headers` instructs browsers to always use HTTPS for this domain and opts the domain into browser preload lists once submitted to [hstspreload.org](https://hstspreload.org).

### Data protection

The `data_protection.smallest_group` threshold (default 5) masks small aggregated counts/sums/shares to prevent re-identification of individuals in tables and charts. Means, medians, min and max are not masked because they do not reveal group sizes.

## Accessibility

The generated report output is built to be accessible:

- **Semantic HTML** — `<h1>`–`<h6>`, `<p>`, `<table>`, `<figure>`/`<figcaption>`. DOM reading order matches visual order.
- **Colorblind-safe palettes** — the default Okabe-Ito (Wong 2011) palette and all bundled alternatives are tested against deuteranopia, protanopia, and tritanopia simulations. Colour is never the sole encoding — chart shapes (e.g. distance plot uses circle + square markers) and labels reinforce it.
- **Alt text on every chart** — auto-derived from the chart spec and the resolved data: chart type, axes, aggregation op, filter, plus an explicit enumeration of every aggregated data point. No network call required. Overridable via `alt:` (full replacement) or `alt-intro:` (introductory sentence prepended to the auto text).
- **Accessible tables** — `<th scope="col">`, `<caption>`, no layout tables. Complex tables get a caption.
- **Curated fonts** — the bundled font picker offers system fonts on accessibility shortlists (Verdana, Tahoma, Arial, Georgia).
- **DOCX exports** preserve alt text, heading structure, and table semantics.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

## Project Layout

```
src/
├── app.ts                # pipeline orchestration
├── main.ts               # entry point
├── style.css             # preview styling
└── modules/
    ├── config/
    ├── data-loader/
    ├── parameters/
    ├── template/
    ├── aggregation/
    ├── palettes/
    ├── fonts/
    ├── renderer/         # text, chart, table, index
    ├── alt-text/
    └── exporter/
config.yaml               # bundled at build time
templates/                # example Markdown templates
public/_headers           # Netlify / static-host security headers
vite.config.ts            # Vite + SRI plugin
```
