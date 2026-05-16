<img src="img/ondatix_Logo_dunkel.png" alt="Reportix Logo" class="logo" height="80" align="right"/><br><br>

# reportix — `config.yaml` handbook

`config.yaml` is the single entry point that tells the app **what to ask the user, where to find the data, which templates to ship, and how to style the output**. It lives at the repo root, is bundled at build time via Vite's `?raw` import, and is **not uploaded by end users** — only developers edit it.

This document is the authoritative reference for every key. Each section opens with a minimal YAML snippet, then enumerates every field.

---

## Contents

- [reportix — `config.yaml` handbook](#reportix--configyaml-handbook)
  - [Contents](#contents)
  - [Top-level layout](#top-level-layout)
  - [`parameters:`](#parameters)
    - [Standalone vs. bound parameters](#standalone-vs-bound-parameters)
    - [Parameter types](#parameter-types)
    - [Special parameter keys (`palette`, `font`)](#special-parameter-keys-palette-font)
  - [`data:`](#data)
  - [`template:`](#template)
  - [`data_protection:`](#data_protection)
  - [`export:`](#export)
    - [Top-level](#top-level)
    - [`document.*` — DOCX metadata](#document--docx-metadata)
    - [`font.*` — body text](#font--body-text)
    - [`headings.*`](#headings)
    - [`paragraph.*`](#paragraph)
    - [`page.*`](#page)
    - [`page_numbers.*`](#page_numbers)
    - [`header.text`, `footer.text`](#headertext-footertext)
    - [`table.*`](#table)
    - [`definition_box.*` and `summary_box.*`](#definition_box-and-summary_box)
  - [`charts:`](#charts)
  - [Recipes](#recipes)
    - [Expose a config field as a user-overridable parameter](#expose-a-config-field-as-a-user-overridable-parameter)
    - [Add a new bundled template](#add-a-new-bundled-template)
    - [Make all sections decimal-numbered with a TOC](#make-all-sections-decimal-numbered-with-a-toc)
    - [Make smallest-group masking a per-report choice](#make-smallest-group-masking-a-per-report-choice)
    - [Force landscape page orientation without exposing it to the user](#force-landscape-page-orientation-without-exposing-it-to-the-user)
  - [Cross-references](#cross-references)

---

## Top-level layout

```yaml
parameters:        # form fields shown before report generation
data:              # expected sheets/columns in uploaded .xlsx files
template:          # bundled Markdown templates the user can pick from
data_protection:   # masking threshold for aggregated counts
export:            # DOCX styling and metadata
charts:            # global chart rendering defaults
```

All sections are optional except `parameters:`, `data:`, and `template:`, but in practice you'll want `export:` and `charts:` for any non-trivial report.

---

## `parameters:`

The `parameters` section drives the form rendered in Step 3 ("Report Parameters"). Each entry is one form field.

```yaml
parameters:
  title:
    label: "Title"
    type: text
    default: "Report"
  font_size:
    label: "Body font size (pt)"
    type: number
    bind: export.font.size
```

### Standalone vs. bound parameters

A parameter is either **standalone** (a template variable, prefilled from `default:`) or **bound** to a leaf elsewhere in `config.yaml` via `bind:`.

| | Standalone | Bound |
|---|---|---|
| Has `default:` | Yes — the preset | No — the preset is the bound leaf |
| Has `bind:` | No | Yes (dotted path, e.g. `export.font.size`) |
| Used by | Template substitution (`{{title}}`) | Renderers / exporter (after the bound leaf is overridden) |

**Resolution rule.** At runtime, every bound parameter's user-entered value is written back to its `bind:` path before the renderers and exporter see the config. Standalone parameters stay in the parameter map and are interpolated into the Markdown template as `{{key}}`.

**Why use `bind:`?** It lets you expose any config leaf as a per-report user toggle without duplicating the value or hand-wiring the override. For example, by binding `font_size` to `export.font.size`, the developer controls the default in the config and the user can override per report.

### Parameter types

| `type:` | Renders as | Collected value |
|---|---|---|
| `text` | text input | string |
| `number` | number input | number |
| `date` | date picker | ISO date string |
| `select` | dropdown (or radio for `palette`/`font`) | string |
| `multiselect` | multi-select listbox | `string[]` |
| `boolean` | checkbox | boolean |

`select` and `multiselect` require an `options:` list:

```yaml
page_orientation:
  label: "Page orientation"
  type: select
  bind: export.page.orientation
  options: [portrait, landscape]
```

### Special parameter keys (`palette`, `font`)

Two parameter keys get bespoke UI widgets:

- **`palette`** — radio group; each option shows the palette name plus a horizontal strip of its actual colour swatches. Bound to `charts.palette`. Options must match palette IDs registered in [src/modules/palettes/](src/modules/palettes/index.ts) (`okabe-ito`, `tol-bright`, `tol-muted`, `ibm`, `grayscale`).
- **`font`** — radio group; each option label is rendered in the actual typeface. Bound to nothing (curated theme — maps a font ID to a CSS stack, DOCX family, and display name via [src/modules/fonts/](src/modules/fonts/index.ts)). Options must match font IDs (`verdana`, `tahoma`, `arial`, `georgia`).

Both keys still follow the standard schema; only their UI rendering is special.

---

## `data:`

Declares the data sources the app expects the user to upload, each with one or more `.xlsx` sheets and their required columns.

```yaml
data:
  Dataset:
    sheets:
      - sheet: Sheet 1
        columns: [Col 1, Col 2]
      - sheet: Sheet 2
        columns: [Col A, Col B]
```

| Field | Type | Notes |
|---|---|---|
| `<source name>` | object | Top-level key is the source identifier shown in the upload UI. |
| `.sheets[].sheet` | string | Excel sheet name as it appears in the workbook. |
| `.sheets[].columns` | `string[]` | Required column headers (compared after Unicode NFC + whitespace normalisation). |

**Validation behavior.** Mismatches between the uploaded file and the declared shape (missing source file, missing sheet, missing columns) surface as **non-blocking warnings** in a yellow banner. The pipeline continues; any chart or table that references missing data renders as a red "TBD" note in the preview, leaving the rest of the report intact.

**DataStore keying.** Internally each loaded sheet is stored under its sheet name. Chart and table blocks reference data via this key — e.g. `data: Sheet 1` in a chart block looks up `DataStore["Sheet 1"]`.

---

## `template:`

Lists the bundled Markdown templates the user picks from in Step 2.

```yaml
template:
  files:
    - label: "Standard Report"
      file: report_template.md
    - label: "Quick Summary"
      file: summary_template.md
```

| Field | Type | Notes |
|---|---|---|
| `files[].label` | string | Human-readable name shown in the radio chooser. |
| `files[].file` | string | Filename inside the bundled `templates/` directory (no path). |

**Bundling.** Every `.md` file under `/templates/` is included in the JS bundle at build time via `import.meta.glob`. There is no runtime fetch (the CSP forbids `connect-src`), so the file must exist at build time.

**Hard-fail behavior.** If any `file:` referenced here isn't present in the bundle, the app throws at startup listing what's missing and what's available. This catches typos and forgotten files early.

**Minimum: one entry.** An empty `files:` list also hard-fails.

---

## `data_protection:`

```yaml
data_protection:
  smallest_group: 5   # bound by parameters.smallest_group (if exposed)
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `smallest_group` | number | `5` | Aggregated values strictly below this and greater than zero are masked. |

**Where it applies.** Count-like aggregation operations only (`count`, `sum`, `share_total`, `share_group`). Means, medians, min, and max are not masked because they don't reveal group sizes.

- **Tables:** affected cells render as `<5` (or the configured threshold).
- **Charts:** affected bars/slices are clamped to the threshold so a small bar is still drawn, and the tooltip displays `<5`.

---

## `export:`

DOCX styling and metadata. Every leaf here is a candidate for a `bind:` exposure in `parameters:`.

```yaml
export:
  filename: report.docx
  locale: de-DE
  section_numbering: false
  toc: false

  document:
    title: Report
    subject: ""
    creator: ""
    description: ""
    keywords: ""

  font:
    family: Arial
    size: 11
    heading_family: Arial
    color: "1A1A1A"

  headings:
    color: "1F3864"
    h1_size: 20
    h2_size: 16
    h3_size: 13
    h4_size: 12

  paragraph:
    alignment: left
    spacing_before: 0
    spacing_after: 120
    line_spacing: 276

  page:
    orientation: portrait
    width: 11906
    height: 16838
    margin:
      top: 1418
      right: 1418
      bottom: 1418
      left: 1418
      header: 709
      footer: 709

  page_numbers:
    show: true
    start: 1
    format: decimal

  header:
    text: ""

  footer:
    text: ""

  table:
    border_style: single
    border_color: "AAAAAA"
    border_size: 4
    cell_padding: 80

  definition_box:
    color: "1F77B4"
    background: true
  summary_box:
    color: "2CA02C"
    background: true
```

### Top-level

| Field | Type | Default | Notes |
|---|---|---|---|
| `filename` | string | `report.docx` | Output filename. |
| `locale` | string | `en-US` | BCP-47 locale used for number/currency formatting. |
| `section_numbering` | boolean | `false` | Auto-numbers headings as `1.`, `1.1.`, `1.1.1.`, `1.1.1.1.` via a multilevel decimal scheme. |
| `toc` | boolean | `false` | Inserts a Word table-of-contents field at the start. Word prompts to "update fields" the first time the document opens; entries materialise then. |

### `document.*` — DOCX metadata

Written into the .docx file properties (Title / Subject / Author / Description / Keywords).

### `font.*` — body text

| Field | Type | Default | Notes |
|---|---|---|---|
| `family` | string | `Arial` | Body font (overridden at runtime by the `font` parameter). |
| `size` | number (pt) | `11` | Body text size. |
| `heading_family` | string | inherits `family` | Optional override for heading typeface. |
| `color` | hex w/o `#` | `1A1A1A` | Body text colour. |

### `headings.*`

| Field | Type | Default | Notes |
|---|---|---|---|
| `color` | hex w/o `#` | `1F3864` | Applied to all heading levels unless overridden. |
| `h1_size`–`h4_size` | number (pt) | `20`, `16`, `13`, `12` | Per-level sizes. |

### `paragraph.*`

| Field | Type | Default | Notes |
|---|---|---|---|
| `alignment` | enum | `left` | `left` \| `center` \| `right` \| `justify` |
| `spacing_before` | twips | `0` | Space before paragraph. |
| `spacing_after` | twips | `120` (≈6 pt) | Space after paragraph. |
| `line_spacing` | twips | `276` | `276` ≈ single at 11 pt; `360` ≈ 1.5×; `480` ≈ double. |

### `page.*`

| Field | Type | Default | Notes |
|---|---|---|---|
| `orientation` | enum | `portrait` | `portrait` \| `landscape`; auto-swaps A4 dimensions. |
| `width`, `height` | twips | A4 (11906 × 16838) | Override only if non-A4. |
| `margin.top` / `.right` / `.bottom` / `.left` | twips | `1418` (~25 mm) | |
| `margin.header` / `.footer` | twips | `709` (~12 mm) | Distance from page edge to header/footer content. |

> **Twips refresher.** 1 mm ≈ 56.7 twips. 1 inch = 1440 twips. 1 pt = 20 twips.

### `page_numbers.*`

| Field | Type | Default | Notes |
|---|---|---|---|
| `show` | boolean | `true` | Renders page numbers in the footer. |
| `start` | number | `1` | Starting page number. |
| `format` | enum | `decimal` | `decimal` \| `upperRoman` \| `lowerRoman` \| `upperLetter` \| `lowerLetter`. |

### `header.text`, `footer.text`

Static strings rendered in the page header (left-aligned) and footer (left of the page numbers).

### `table.*`

| Field | Type | Default | Notes |
|---|---|---|---|
| `border_style` | enum | `single` | `single` \| `double` \| `dashed` \| `dotted` \| `thick` \| `none`. |
| `border_color` | hex w/o `#` | `999999` | |
| `border_size` | eighths of pt | `4` | |
| `cell_padding` | twips | `80` (~1.5 mm) | |

### `definition_box.*` and `summary_box.*`

Style overrides for callout blocks. `definition_box` styles `::: {.callout-note} … :::`; `summary_box` styles `::: {.callout-tip} … :::`.

| Field | Type | Default | Notes |
|---|---|---|---|
| `color` | hex w/o `#` | `1F77B4` / `2CA02C` | Drives the left border and title colour. |
| `background` | boolean | `true` | When `true`, fills the cell with a pale tint derived from `color`; when `false`, no fill. |

---

## `charts:`

Global Chart.js defaults applied to every chart in every template.

```yaml
charts:
  palette: okabe-ito
  animation: false
  aspect_ratio: 2.0

  font:
    family: Arial
    size: 12
    color: "555555"

  title:
    position: top
    align: center
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
      tension: 0.0
      point_radius: 3
    bar:
      border_radius: 0
      bar_percentage: 0.9
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `palette` | palette ID | `okabe-ito` | Resolved at render time via the palettes module. Overridable by `parameters.palette`. |
| `animation` | boolean | `false` | Disable for reports — animations don't translate to .docx. |
| `aspect_ratio` | number | `2.0` | width:height. Affects on-screen rendering and the embedded image size. |
| `font.family` | string | `Arial` | Overridden at runtime by the `font` parameter. |
| `font.size` | number (pt) | `12` | Used for tick labels and legend. |
| `font.color` | hex w/o `#` | `555555` | |
| `title.position` | enum | `top` | `top` \| `bottom` \| `left` \| `right`. |
| `title.align` | enum | `center` | `start` \| `center` \| `end`. |
| `title.color` | hex w/o `#` | `1A1A1A` | |
| `legend.display` | boolean | `true` | |
| `legend.position` / `.align` | enums | `top` / `center` | Same vocab as `title.*`. |
| `tooltip.enabled` | boolean | `true` | |
| `scales.x.begin_at_zero` / `scales.y.begin_at_zero` | boolean | `false` / `true` | |
| `scales.{x,y}.grid_display` | boolean | `true` | |
| `scales.{x,y}.grid_color` | CSS color | `rgba(0,0,0,0.08)` | Accepts hex or `rgba(…)`. |
| `scales.{x,y}.tick_color` | hex w/o `#` | `888888` | |
| `elements.line.tension` | number 0–1 | `0.0` | `0` = straight; `~0.4` = smooth curves. |
| `elements.line.point_radius` | px | `3` | |
| `elements.bar.border_radius` | px | `0` | Rounded bar corners. |
| `elements.bar.bar_percentage` | number 0–1 | `0.9` | Fraction of category slot used by bars. |

---

## Recipes

### Expose a config field as a user-overridable parameter

Add a `parameters:` entry whose `bind:` points at the dotted path:

```yaml
parameters:
  body_font_size:
    label: "Body font size (pt)"
    type: number
    bind: export.font.size      # no `default:` — preset is at the bound leaf

export:
  font:
    size: 11                    # this is the form's prefill
```

The user's value is written back to `export.font.size` at runtime; the rest of the pipeline sees the override.

### Add a new bundled template

1. Drop a `.md` file into [templates/](templates/) (e.g. `templates/quarterly.md`).
2. Add a new entry under `template.files:`:

   ```yaml
   template:
     files:
       - label: "Standard Report"
         file: report_template.md
       - label: "Quarterly Snapshot"
         file: quarterly.md
   ```

3. Restart `npm run dev` (Vite picks up new template files only on dev-server start).

### Make all sections decimal-numbered with a TOC

```yaml
export:
  section_numbering: true
  toc: true
```

When `toc: true`, Word will prompt **"This document contains references that may refer to other files. Do you want to update them?"** on first open — clicking *Yes* materialises the TOC entries. This is standard `docx`-package behavior.

### Make smallest-group masking a per-report choice

Already bound in the shipped config:

```yaml
parameters:
  smallest_group:
    label: "Smallest group threshold"
    type: number
    bind: data_protection.smallest_group

data_protection:
  smallest_group: 5
```

The number field appears in Step 3; the user can raise it for stricter masking or lower it (down to 1, disabling masking) when working with non-sensitive data.

### Force landscape page orientation without exposing it to the user

Remove the `page_orientation` parameter entry but keep the preset:

```yaml
export:
  page:
    orientation: landscape
```

The exporter auto-swaps A4 width/height based on `orientation`, so margins/page numbers continue to lay out correctly.

---

## Cross-references

- [CLAUDE.md](CLAUDE.md) — full app spec, template syntax (chart/table YAML blocks, callouts, aggregation), accessibility rules
- [README.md](README.md) — user-facing summary
- [src/modules/config/](src/modules/config/index.ts) — config parser; the schema is exactly what's parsed there
- [src/modules/parameters/](src/modules/parameters/index.ts) — form builder, `bind:` resolution
- [src/modules/exporter/](src/modules/exporter/index.ts) — consumer of `export.*`
- [src/modules/renderer/chart.ts](src/modules/renderer/chart.ts) — consumer of `charts.*`
