<img src="img/ondatix_Logo_V1_dunkler_Hintergrund_SVG.svg" alt="ondatix Logo" class="logo" height="80" align="right"/><br><br>

# reportix

Fully client-side web app for automated report generation. Upload an Excel workbook or CSV files, map their sheets/columns to the report's data, fill in a parameter form, and export a styled `.docx` — all in the browser, no server, no network at runtime.

## Why

Many reporting workflows (HR equality reports, internal KPIs, compliance summaries) need to combine sensitive tabular data with a fixed narrative structure. reportix lets a developer ship that structure as a bundled config + template, and lets a non-technical user produce the finished `.docx` themselves without the data ever leaving their machine.

The bundled config and template are a **showcase**: the annual report (Schuljahresbericht) of a fictional German secondary school, with a matching sample workbook in `test/alt-text/dummy.xlsx`. Replace `config/` and `templates/master.md` to build a report for your own domain.

## Features

- **Fully offline** — no backend, no fetch, no third-party CDN at runtime. Browser CSP enforces this.
- **Markdown templates** with embedded chart / table YAML blocks and Pandoc-style callouts.
- **Six chart types**: `bar`, `line`, `pie`, `doughnut`, `pyramid`, `distance` (dumbbell plot).
- **Table-first pipeline**: every chart and table block describes one **wrangled crosstab** — `filter` → `groupby` (rows × optional cols) → a single aggregation op — computed once and shared by the table renderer, the chart renderer (rows → categories, cols → series), and the alt-text generator.
- **Question catalog**: the repeated report sections (question, source line, chart, appendix table) are authored as a YAML list in `config/template.yaml` and generated into the templates — see [Templates](#templates).
- **Data preprocessing**: `config.yaml` can define **mutations** (derive a new column with an if/elif/…/else rule, e.g. classify `Unterstufe`/`Mittelstufe`/`Oberstufe` from the year level, with an NA-passthrough case for a missing value) and **joins** (enrich one sheet with columns looked up from another by a shared key, e.g. attach `Schueler` master-data onto each `Zeitraum_*` event by `SchuelerID`) — applied before rendering. A mutation that if/else cannot express (date arithmetic, running totals) instead names a **transform function** with `fn:`; those live in `config/functions/*.ts`, beside the config rather than in `src/`.
- **Data validation**: `config.yaml` can define row-level **validation rules** — each checks one dataset/column against a boolean `check` tree (`and`/`or`/`not` over the same operators as mutations), running after preprocessing; rows that fail surface as a non-blocking warning instead of silently rendering wrong numbers.
- **Aggregation ops**: `count`, `sum`, `mean`, `min`, `max`, `median`, `share_total`, `share_group`.
- **Row filtering**: `filter: <bool-column>` keeps only matching rows before aggregation.
- **Data protection**: aggregated values below a configurable threshold are masked (`<5` in tables and alt texts, clamped + masked tooltip in charts) for count-like operations.
- **Accessible by default**: WCAG-AA colour palettes, colorblind-safe defaults, semantic HTML, auto-generated alt text for every chart.
- **Bilingual UI (German / English)**: a language selector switches every program text — labels, buttons, validation warnings, error messages, and auto-generated chart alt text. German is the default; English is the second option. *(The selector is currently commented out in `src/app.ts`, so the app runs German-only; the English locale stays intact for when it returns.)*
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
- **Static host** (Netlify, Vercel, Cloudflare Pages, S3+CloudFront, nginx, …) — the build output in `dist/` is fully static, no runtime, no environment variables, no secrets.

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

1. **Load config** — `/config.yaml` is a manifest listing the per-section files under `config/`; all are bundled at build time, merged, and parsed on startup.
2. **Choose period and template** — user sets the reporting period (any parameter marked `step: template`, prefilled from `data_parameters`) and picks one of the bundled Markdown templates listed under `template.files` in the config (radio chooser with human-readable labels). The `templates/` files are **generated** at build time from a single master (`templates/master.md`) by `scripts/gen-templates.ts` and bundled — see [Templates](#templates).
3. **Load data** — user picks a format (**XLSX** workbook per source, or **CSV** — one single-table file per sheet, also accepting a single-sheet `.xlsx`) and **maps** their actual sheets/columns onto the config's sheets/columns. The mapping UI shows only the sheets/columns the chosen template needs — the manual `include` scoping plus the columns computed automatically from the template's own chart/table blocks (resolved through mutations and joins back to physical columns). Options pre-select by matching name, so a file that already uses the config names needs no manual mapping. Unmapped names surface as non-blocking warnings in the next step (blocks referencing missing data render as red "TBD" notes); a sheet/column can carry a custom `warning:` text (config) appended to that message.
3a. **Data validation** — a dedicated step between upload and parameters. Parameters marked `step: data` render as checklists of the values actually present in an uploaded column (`options_from`), pre-ticked by a `default_when` condition — e.g. which profiles count as STEM, or which leave reasons count as family-related. Mutations read the selection via `in: { from_config: … }`. Preprocessing, validation and all warnings re-run live on every change.
3b. **Preprocess** — any `preprocessing` defined in the config runs before rendering: `mutations` derive new columns (if/elif/…/else rules), then `joins` enrich one sheet with another's columns by a shared key, or — with `fn:` — compute a column with a function from `config/functions/*.ts`.

3c. **Validate** — any `validation` rules defined in the config run against the preprocessed store: each checks one dataset/column against a boolean condition tree, and failing rows surface as a non-blocking warning alongside the data-loading and preprocessing ones. The same step flags any chart/table block whose `filter:` column is missing from its dataset, since that filter silently has no effect.
4. **Fill parameters** — a form is generated from the config's `parameters` section.
5. **Render preview** — Markdown becomes semantic HTML; chart / table YAML blocks become Chart.js canvases and accessible `<table>`s with auto-generated alt text.
6. **Export DOCX** — the rendered DOM is walked and serialised to a `.docx` file with the configured page layout, fonts, callouts, and chart images.

No step talks to a server. The XLSX/CSV is read in-browser via SheetJS; the DOCX is built in-browser via [docx](https://www.npmjs.com/package/docx) and saved via [FileSaver](https://www.npmjs.com/package/file-saver).

## Configuration (`config.yaml`)

The config is the entry point — a developer edits it, the end user never touches it. It declares:

- **`parameters`** — form fields shown before report generation (`text`, `number`, `date`, `select`, `multiselect`, `boolean`, `color`). Each entry is either **standalone** (template variable, prefilled from `default:`) or **bound** to a config leaf via `bind: <dotted.path>` — bound entries prefill from the path's preset and write the user's value back to that path at runtime, letting most styling and metadata keys be overridden per report. The names `palette`, `font`, `page_orientation`, and `page_numbers` get special UI widgets (illustrated / icon radios — translation-free choices); `gender_color_male` / `gender_color_female` (`type: color`) render native color pickers, bound to `charts.gender.male` / `.female`, and drive every chart's "Geschlecht" coloring consistently except stacked bar charts, which color from `palette` instead. `step: template` moves a field into step 1 beside the template chooser (used for the reporting period); `step: data` turns a `multiselect` with `options_from: { dataset, column }` into a checklist of the uploaded values in the data-validation step (pre-ticked by `default_when`, bound to `dataParameters.selections.*`); everything else defaults to the report-parameters step. A date-valued config leaf may hold a relative token — `last_year_start`, `last_year_end`, `this_year_start`, `this_year_end`, `today` — resolved against the current date at parse time, so a bundled default never ages. Each `label` may be a plain string or a per-locale map `{ de: "…", en: "…" }` resolved to the [selected language](#features). **Bind paths target the parsed config (camelCase)** — e.g. `export.pageNumbers.position`, `export.sectionNumbering`, `dataParameters.smallestGroup` — not the snake_case YAML keys.
- **`data`** — expected data sources, each with sheet names and required columns. These are the **mapping targets**: the user maps their uploaded file's actual sheets/columns onto these names (pre-selected when names match), rather than the upload being hard-validated. Each sheet and column may carry optional `definition` (German-only) or `info` (bilingual) tooltip text, `notes` metadata, and an `include` list of template `id`s — the data step only requests sheets/columns whose `include` contains the selected template's id (omit `include` ⇒ every template). A column is either a plain string or an object (`{ column, definition, info, notes, include }`). The `definition`/`info` text appears as a click-to-open ⓘ tooltip (templates, sheets, columns, and parameters); each workflow step has one too.
- **`preprocessing`** — optional derived columns and datasets built before rendering. **`mutations`** (run first) add a column via a simple if-else rule: where `when` holds for the `from` value the new `column` gets `then`, else `else` (operators: `equals`, `in`, `contains`, `starts_with`, `ends_with`, `matches`, `gt`/`lt`/`gte`/`lte`, `empty`, `truthy`); or `fn: <name>` with `from:` as a list of columns and an optional `options:` block, which computes the column with a named export from `config/functions/*.ts` — a column-wise `(columns, ctx) => unknown[]`, with every failure degrading to a warning). **`joins`** then enrich a `left` sheet with columns from a `right` sheet matched on a key (`on`, or `left_on`/`right_on`); `type` is `left` or `inner`; omit `select` to copy all non-overlapping right columns, or list specific ones (`{column, as}` to rename); `indicator` adds a boolean "matched?" column. Setting `name` = `left` enriches the sheet in place. First-match lookup (left rows are never duplicated).
- **`template.files`** — list of bundled Markdown templates shown as a radio chooser in Step 2. Each entry has a `label` (shown to the user), a `file` (filename within `templates/`), and an optional `id` referenced by the data `include` lists to scope which sheets/columns that template requests. The app hard-fails at startup if any referenced file isn't bundled.
- **`export`** — DOCX styling: filename, locale, document metadata, fonts, heading sizes/colours, paragraph spacing, page size & margins, **page numbers** (`page_numbers.position`: `left`/`center`/`right`/`none`), header/footer text, table borders, **section numbering** (`section_numbering: true` numbers section headings `1.`, `1.1.`, … in both preview and DOCX), **table of contents** (`toc: true` builds one in the preview and as a Word TOC field), **callout box colours and backgrounds** (`definition_box`, `summary_box`). The first `# {{title}}` is treated as the document title (placed before the TOC, not numbered).
- **`charts`** — Chart.js defaults: animation, aspect ratio, fonts, title/legend/tooltip placement, axis grid colours, line/bar element styling. `elements.bar.max_columns` turns a bar chart with more categories than that into horizontal bars that grow in height; past `max_height_ratio` (height ÷ width) such a chart is split into equally big partial plots, each with its own alt text.
- **`data_parameters`** — facts about the dataset: `smallest_group` (privacy threshold for aggregated counts/shares, default 5), `period_start` / `period_end` (the reporting period), and `category_order` (optional fixed value order per column, e.g. `Geschlecht: [männlich, weiblich]`, applied by `wrangleTable` in place of the default natural/first-seen order). Lives in `config/data.yaml`, so the period can be handed to a preprocessing `fn:` by YAML anchor. Formerly `data_protection`, still accepted under that name.

## Template Format

Templates are plain Markdown. Charts and tables are fenced code blocks with a typed language tag and a YAML body. Both share the same **crosstab spec** (`data`, optional `filter`, optional `groupby.rows` — a column name or a list of them, bucketing by the tuple — × optional `groupby.cols`, one `aggregation` op, `value` column for value-ops); a chart block embeds it under `table:` and adds presentation keys (`type`, `stacked`, `title`, `alt`, `alt-intro`, `caption`).

````markdown
# {{title}}

::: {.callout-note title='Definitionen'}
**Geschlecht:** Im Datensatz wird zwischen männlich und weiblich unterschieden.
:::

## Headcount by pay grade

```chart
type: pyramid
title: Pupils per year level and gender
table:
  data: Schueler
  groupby:
    rows: Jahrgangsstufe
    cols: Geschlecht
  aggregation: count
```

```table
data: Schueler
groupby:
  rows: Jahrgangsstufe
  cols: Geschlecht
aggregation: count
caption: Schülerinnen und Schüler je Jahrgangsstufe und Geschlecht.
```
````

Tables render as a crosstab: one row per `groupby.rows` value, sorted naturally — numbers inside labels by value, so `E8` comes before `E10` (or one row per distinct *tuple* — labels joined with ` · ` — when `rows` is a list; or a single "Total" row when `rows` is omitted, e.g. for a one-number summary), one column per `groupby.cols` value in first-seen order (or a single value column when `cols` is omitted). Charts map the same crosstab onto Chart.js: rows become the category axis, cols the series; `pie`/`doughnut` take rows as slices — or `cols` as the slices when `rows` is omitted, since a pie has only one axis — `pyramid`/`distance` require exactly two `cols` values.

Parameters from the form are interpolated as `{{paramName}}` anywhere in the text.

## Modules

Each utility is a self-contained module under `src/modules/` with a clean public API, so it can be extracted and reused independently. There is no hard coupling between modules — they're orchestrated by `src/app.ts`.

| Module | Responsibility |
|---|---|
| `i18n/` | Central translation layer (German / English) with `t(key, params)` lookup; drives all UI text, error messages, and chart alt text. |
| `config/` | Load the modular config — `/config.yaml` manifest + `config/*.yaml` sections (bundled via `?raw`), merged and parsed into a typed `AppConfig`. Also exposes `dataForTemplate` for template-scoped data filtering. |
| `data-loader/` | Parse `.xlsx` workbooks / CSV files via SheetJS; assemble a DataStore from the user's sheet/column mapping (renames to config names). |
| `preprocessing/` | Derive columns and datasets from the loaded sheets before rendering — mutations (if/elif/…/else derived columns) and joins (lookup/enrichment), defined in the config's `preprocessing:` section (in `config/data.yaml`). |
| `transforms/` | Registry of column-transform functions named by a mutation's `fn:`. The implementations live in `config/functions/*.ts` (globbed at build time), so project-specific derivations stay out of `src/`. |
| `validation/` | Row-level checks (`and`/`or`/`not` over the same leaf operators as mutations) run after preprocessing; failing rows surface as non-blocking warnings, defined in the config's `validation:` section. Also reports template blocks whose `filter:` names a column the dataset lacks — such a filter is a no-op, so the block would otherwise render over the unfiltered population. |
| `parameters/` | Render the form from `AppConfig.parameters`, collect typed values. |
| `template/` | Parse Markdown into typed blocks (`text` / `chart` / `table`). |
| `aggregation/` | Aggregation ops, row filtering, and the shared **wrangle** step (`wrangleTable`: filter → groupby → aggregate crosstab with per-cell data-protection flags). |
| `palettes/` | Curated accessible colour palettes (Okabe-Ito, Tol Bright/Muted, IBM, grayscale). |
| `fonts/` | Curated accessible system fonts (Verdana, Tahoma, Arial, Georgia). |
| `renderer/` | Markdown→HTML (`text.ts`), Chart.js (`chart.ts`), HTML tables (`table.ts`), orchestration (`index.ts`). |
| `alt-text/` | Spec-derived chart alt text generation — fully offline, no LLM. |
| `info/` | Click-to-open tooltips (ⓘ trigger + popup) for steps, template options, sheets, columns, and parameters, fed by their `definition`/`info` text. |
| `exporter/` | DOM → docx conversion (paragraphs, headings, lists, tables, callouts, embedded chart images). |

## Security & Privacy

All processing runs entirely in the browser. No data is ever transmitted to a server — uploaded files and generated reports stay local.

### Public Sector Security Guidelines

OWASP (Open Web Application Security Project) Top 10
- [x] A01 Broken Access Control --> not relevant (no Auth)
- [x] A02 Security Misconfiguration --> CSP + Header
- [~] A03 Software Supply Chain Failures --> pinned lockfile + `npm audit` gate
- [x] A04 Cryptographic Failures --> HTTPS, no data in transit
- [x] A05 Injection --> Escaping in Markdown-Rendering, regression test
- [x] A06 Insecure Design --> local processing is secure by design
- [x] A07 Authentication Failures --> not relevant (no Auth)
- [x] A08 Software or Data Integrity Failures --> SRI, lockfile integrity hashes, Audit-Gate
- [x] A09 Security Logging & Alerting Failures --> no data storage, no requests
- [x] A10 Mishandling of Exceptional Conditions --> no data storage, no requests

Further information the penetrations by the Bavarian Office for Security in Information Technology: [LSI Informationsblatt](https://www.lsi.bayern.de/mam/aktuelles/lsi-info_t03_penetrationstest.pdf)

### Subresource Integrity (SRI)

All JavaScript and CSS assets are bundled at build time by Vite. No external CDN scripts are loaded at runtime, so there are no third-party resources to protect against. As an additional layer, `vite-plugin-sri3` appends `integrity=` hashes to every `<script>` and `<link>` tag in the built `index.html`, so a compromised static host cannot silently swap a built asset.

### Content Security Policy (CSP)

Deliver the CSP as an HTTP **response header**, not as a `<meta>` tag: only a header can carry `frame-ancestors`. Configure it on your host (an nginx `add_header`, a Netlify-style `_headers` file, your CDN's header rules, …) and keep exactly one source — an inert second copy reads like protection that isn't there.

The policy the app is built for:

```
default-src 'self'; script-src 'self'; style-src 'self';
img-src 'self' data: blob:; font-src 'self';
connect-src 'none'; object-src 'none';
base-uri 'none'; form-action 'self'; frame-ancestors 'none';
child-src 'none'; upgrade-insecure-requests;
trusted-types reportix-html; require-trusted-types-for 'script'
```

`connect-src 'none'` is intentional: the app makes zero network requests at runtime, so any accidental fetch or XHR is blocked at the browser level.
`img-src data: blob:` is required for Chart.js canvas export and FileSaver file downloads.
No `'unsafe-inline'` anywhere — the bundle carries no inline script, and the app only ever writes styles through the CSSOM, which CSP does not govern.
`base-uri 'none'`, `child-src 'none'` and `object-src 'none'` lock out `<base>`, nested browsing contexts / workers, and plugins — the app uses none.
`require-trusted-types-for 'script'` makes Chromium reject a plain string at any injection sink. The app has exactly two `innerHTML` writes — the shell (`src/app.ts`) and the rendered report (`src/modules/renderer`) — and both go through the single `reportix-html` policy in `src/modules/shared/trusted-html.ts` (named by `trusted-types`; shell via `trustedHtml()`, report via `trustedReportHtml()`); every other clear uses `replaceChildren()`. The policy is a **validator**: it passes trusted structural markup through untouched but throws on a `<script>`/`<iframe>`/`<object>`/`<embed>`/`<base>` element, an inline `on*=` handler, or a `javascript:` URL — a loud failure for anything that slipped past the escaping step below. The report path additionally rejects any `<a>` element: the templates carry no links, so a rendered anchor means a Markdown-link injection through a parameter. Firefox/Safari ignore the directive; jsdom (the a11y tests) has no `trustedTypes`, so only the validation runs there.


Alongside the CSP, send `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, and `Cross-Origin-Opener-Policy`/`Cross-Origin-Resource-Policy: same-origin`. On nginx, `server_tokens off` also keeps the server version out of responses.

### Input handling

Report parameters are user input and are **HTML-escaped before** Markdown rendering (`renderer/text.ts`), because the rendered result is assigned via `innerHTML` and read back by the DOCX exporter — an unescaped value would otherwise execute as markup in the preview and travel into the export. The templates themselves are developer-authored and trusted, so their own HTML still passes through. Everything else the user can influence (sheet and column names from the uploaded file, validation warnings, tooltips, table cells, chart labels) is written with `textContent`. The `innerHTML` assignment itself is minted as `TrustedHTML` through the one `reportix-html` policy (`src/modules/shared/trusted-html.ts`) so it satisfies the `require-trusted-types-for 'script'` CSP directive — the policy validates (rejecting `<script>`, inline handlers, `javascript:` URLs, and — on the report path — any `<a>`) rather than sanitizing, so the primary injection defense stays the escaping above.

Uploads are re-checked in the data-loader module before parsing — extension, non-empty, and a 25 MB cap (`MAX_UPLOAD_BYTES`) — since the `accept` attribute on a file input is only a UI hint. After parsing, a sheet whose real extent exceeds `MAX_UPLOAD_ROWS` / `MAX_UPLOAD_COLS` / `MAX_UPLOAD_CELLS` is rejected the same way — measured from the sheet's actual cells (not its file-supplied `!ref` range) before the full conversion, so a small file with a pathological or understated range can't freeze the tab. A file named `.xlsx` must also carry a real workbook signature (zip, or OLE2 when password-protected) — otherwise SheetJS would read the bytes as plain text and a corrupt or renamed file would load silently as a junk sheet; `.xls` stays exempt because legacy exports often use it for HTML/TSV. Parse failures surface as a localized error next to the input that caused them and reset that source's mapping, rather than failing silently.

### Dependencies

`xlsx` (SheetJS) is installed from **`https://cdn.sheetjs.com/…`, not from the npm registry** — deliberately. The registry copy stops at `0.18.5`, which carries two unfixed high-severity advisories (prototype pollution, ReDoS); SheetJS publishes fixed releases only from its own CDN. The lockfile pins the tarball URL together with an `integrity` hash, so `npm ci` stays reproducible, but note the trade-offs:

- The build needs network access to `cdn.sheetjs.com`.
- **Automated dependency updaters cannot bump URL dependencies.** Bump the pinned version by hand when SheetJS releases.

Before a release, check for high or critical advisories:

```bash
npm audit --audit-level=high   # currently clean
```

### HTTPS

HTTPS must be enforced at the hosting level: redirect `http://` and send `Strict-Transport-Security` exactly once — either from an edge proxy or from the web server, not both. `max-age=31536000; includeSubDomains; preload` also opts the domain into browser preload lists once submitted to [hstspreload.org](https://hstspreload.org).

### Data protection

The `data_parameters.smallest_group` threshold (default 5) masks aggregates that rest on fewer than that many source rows, preventing re-identification of individuals in tables and charts. The criterion is the **group size**, not the value — so a mean salary over two people is suppressed however large it is, while a small average over a large group stays visible. A masked cell shows `<5` only where the number *is* the group count (`count`); for means, sums and shares it shows a neutral placeholder, since `<5` would be untrue. In charts a masked count is clamped to the threshold so a small bar is still drawn; other ops plot nothing.

## Accessibility

The generated report output is built to be accessible:

- **Semantic HTML** — `<h1>`–`<h6>`, `<p>`, `<table>`, `<figure>`/`<figcaption>`. DOM reading order matches visual order.
- **Consistent, colorblind-safe gender coding** — every crosstab in this report is broken down by "Geschlecht", so a category value that normalizes to "männlich"/"weiblich" always renders in its own dedicated color (user-configurable, defaulting to Okabe-Ito's blue/reddish-purple), on any axis, in every chart type except stacked bar charts (which color each stack segment from the palette instead — a stack can have more segments than there are gender colors to spare). The bundled Okabe-Ito (Wong 2011) palette and its alternatives are tested against deuteranopia, protanopia, and tritanopia simulations. Colour is never the sole encoding — chart shapes (e.g. distance plot uses circle + square markers) and labels reinforce it.
- **High-contrast chart shapes** — every bar, slice, and point is drawn with a white contour so adjacent shapes stay visually separated regardless of palette, and every data point is labelled with its value directly on the chart (not just in a hover tooltip), so the number is legible in the static DOCX export too.
- **Alt text on every chart** — auto-derived from the chart spec and the wrangled crosstab the chart is drawn from: chart type, measured field, groupby axes, filter, plus an explicit enumeration of every shown cell (privacy-protected cells enumerate as `<threshold`, matching the visible chart). No network call required. Overridable via `alt:` (full replacement) or `alt-intro:` (introductory sentence prepended to the auto text). Every generated alt text — including explicit `alt:` overrides — ends with a bilingual placeholder prompting the report author to add a short interpretation.
- **Accessible tables** — `<th scope="col">`, `<caption>`, no layout tables. Complex tables get a caption.
- **Curated fonts** — the bundled font picker offers system fonts on accessibility shortlists (Verdana, Tahoma, Arial, Georgia).
- **DOCX exports** preserve alt text, heading structure, and table semantics — header rows are marked as Word repeating header rows (`w:tblHeader`), table captions are kept above their table, and the document language is set from the preview's `lang`. Covered by `test/exporter/`, which unzips a real export and checks the OOXML.


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
    ├── info/             # click-to-open tooltips
    └── exporter/
config.yaml               # manifest: include-list of config/*.yaml sections
config/                   # per-section config files (parameters, data, …)
templates/master.md       # master template — source of truth (tracked)
templates/                # generated Markdown templates (git-ignored, built)
scripts/gen-templates.ts  # generates templates/ from templates/master.md
vite.config.ts            # Vite + SRI plugin
```

## Templates

The bundled report templates in `templates/` are **build artifacts** (git-ignored). They are generated from two sources — the prose skeleton `templates/master.md` and the **question catalog** `template.questions` in `config/template.yaml` — by `scripts/gen-templates.ts`, run via `npm run gen:templates` (also wired as a `predev`/`prebuild`/`pretest` hook, so a fresh checkout produces them automatically).

For each entry in `config/template.yaml` that has an `id` + `file`, the generator writes an assembled template to `templates/<file>`:

- The catalog is a flat, ordered YAML list of **section entries** (`section:` heading + a `definitions:` list whose entries reference the `definition:` texts in `config/data.yaml` — columns, derived columns, or sheets — with `{term, ref}` for renamed terms and `{term, text}` for inline concepts) and **question entries** (`title`, optional `include`/`comment`, `datenquelle`/`personenkreis` source fields, `caption`, optional `text`, the shared `table:` crosstab spec, and `chart:` presentation keys). It is rendered into the master's `{{questions}}` placeholder; the `{{tables}}` placeholder (in the `Anhang → Tabellen` appendix) receives one matching `table` block per question, grouped under the same section headings as the Situationsbeschreibung. A question's `include:` lists the template ids it belongs to (omit ⇒ every template); sections whose questions are all excluded are skipped, and a Fazit callout is appended to each section automatically.
- Prose can still be scoped with section markers — HTML comments reusing the config `include:` vocabulary; unmarked content goes into every template:

```markdown
<!-- include: full -->
…only in the template whose id is "full"…
<!-- /include -->
```

Edit `templates/master.md` and `config/template.yaml`, not the generated files. (Edits during `dev` do not hot-reload the output — re-run `npm run gen:templates`.)
