/**
 * App orchestration — wires the modular pipeline together:
 *   config (bundled) → template choice → data upload → data validation
 *   (preprocessing, user classifications, warnings) → parameters → render → export
 */
import { loadConfig, dataForTemplate, requiredDataForBlocks, parametersForStep } from "./modules/config";
import {
  parseWorkbook,
  parseTable,
  assembleStore,
  matchName,
  validateUpload,
  SheetTooLargeError,
  NotAWorkbookError,
  WORKBOOK_EXTENSIONS,
  TABLE_EXTENSIONS,
  type SourceTable,
  type DataMapping,
} from "./modules/data-loader";
import { applyPreprocessing, preprocessingForStore } from "./modules/preprocessing";
import { loadTransforms } from "./modules/transforms";
import { runValidation, checkFilterColumns, validationForStore } from "./modules/validation";
import {
  buildParameterForm,
  buildInlineFields,
  buildDataChecklists,
  collectParameterValues,
  applyParameterOverrides,
  type ChecklistSnapshot,
} from "./modules/parameters";
import { parseTemplate } from "./modules/template";
import { renderBlocks, applyDocumentStructure } from "./modules/renderer";
import { exportToDocx } from "./modules/exporter";
import { getPalette } from "./modules/palettes";
import { getFont } from "./modules/fonts";
// setLocale/LOCALES/Locale are only needed by the language selector, which is
// commented out below — restore this import together with it.
// import { t, getLocale, setLocale, LOCALES, type Locale } from "./modules/i18n";
import { t, getLocale } from "./modules/i18n";
import { attachInfo, resolveTooltip, resetInfoControls } from "./modules/info";
import { trustedHtml } from "./modules/shared/trusted-html";
import type { DataStore, ColumnDef, ParameterValues } from "./modules/types";
import type { PreprocessingWarning } from "./modules/preprocessing";
// Import the logo as an asset URL so Vite bundles/hashes it and rewrites the
// path for the deploy base. A raw string path inside innerHTML is invisible to
// the bundler, so the file is never emitted and the link breaks in production.
import logoUrl from "../img/ondatix_Logo_V1_heller_Hintergrund_SVG.svg";

/**
 * Bundled Markdown templates. Every file under `/templates/*.md` is included
 * at build time as a raw string, keyed by absolute path. `config.template.files`
 * references each entry by filename (e.g. `report_template.md`).
 */
const BUNDLED_TEMPLATES = import.meta.glob("/templates/*.md", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>;

function getBundledTemplate(filename: string): string | undefined {
  return BUNDLED_TEMPLATES[`/templates/${filename}`];
}

/** Message of a thrown value, whatever it turns out to be. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function initApp(root: HTMLElement): void {
  const config = loadConfig();
  // Column transforms named by `fn:` in the config's mutations. Bundled from
  // `config/functions/*.ts` at build time, so project-specific derivations
  // live beside the config rather than in `src/`.
  const transforms = loadTransforms();

  // Keep the document language in sync with the selected locale — a screen
  // reader picks its voice from this. It belongs here rather than in
  // `setLocale`: that is never called on startup (the i18n module initialises
  // `current` directly), and it would put a DOM side-effect into a module that
  // is deliberately DOM-independent. Switching the language re-runs initApp,
  // so this covers both the initial render and every switch.
  document.documentElement.lang = getLocale();

  // The DOM built below replaces whatever a previous run left behind, so drop
  // the info module's reference to the popup that was open in it.
  resetInfoControls();

  // Hard-fail at startup if any template referenced in config isn't bundled.
  // Surfaces developer mistakes (typo in filename, file not added to templates/)
  // immediately instead of letting them propagate into an empty preview.
  if (config.template.files.length === 0) {
    throw new Error(t("error.noTemplates"));
  }
  const missing = config.template.files.filter(
    (tpl) => getBundledTemplate(tpl.file) === undefined
  );
  if (missing.length > 0) {
    const names = missing.map((m) => `"${m.file}"`).join(", ");
    const available =
      Object.keys(BUNDLED_TEMPLATES)
        .map((k) => k.replace("/templates/", ""))
        .join(", ") || "(none)";
    throw new Error(t("error.templatesMissing", { names, available }));
  }

  // Landmark structure: the skip link is the first focusable thing on the
  // page, <header> stays *outside* <main> (nesting it would cost it its banner
  // role), and each step is a <section> named by its own heading so the steps
  // show up as navigable regions. None of this reaches the DOCX exporter — it
  // is only ever handed #report-preview, which sits below.
  root.innerHTML = trustedHtml(`
    <a class="skip-link" href="#main-content">${t("ui.skipToContent")}</a>
    <header>
      <a class="link" href="https://www.ondatix.org/" target="_blank" rel="noopener">
        <img src="${logoUrl}" alt="${t("ui.logoAlt")}" class="logo" height="80" />
      </a>
      <h1>reportix</h1>
      <div id="language-bar" class="language-bar">
        <!-- Language selector: disabled for now (German only), kept for later.
             To restore, uncomment it here, its wiring further down in initApp,
             the full i18n import at the top of this file, and the
             language-switch test in test/a11y/app.test.ts.
        <label for="language-select">${t("ui.language")}</label>
        <select id="language-select"></select>
        -->
        <!-- Handbuch link disabled in the public build (no handbook is deployed):
        <a id="handbuch-link" class="handbuch-link" href="/handbuch/" target="_blank" rel="noopener">${t("ui.handbuch")}</a>
        -->
      </div>
      <p class="description">${t("ui.description")}</p>
    </header>
    <main id="main-content">
      <section id="step-template" class="step" aria-labelledby="h-step-template">
        <h2 id="h-step-template" tabindex="-1">${t("ui.step.template")}</h2>
        <div id="template-params"></div>
        <fieldset id="template-choices"></fieldset>
        <button id="template-continue" type="button">${t("ui.button.continue")}</button>
      </section>
      <section id="step-data" class="step" aria-labelledby="h-step-data" hidden>
        <h2 id="h-step-data" tabindex="-1">${t("ui.step.data")}</h2>
        <div id="data-inputs"></div>
      </section>
      <section id="step-validation" class="step" aria-labelledby="h-step-validation" hidden>
        <h2 id="h-step-validation" tabindex="-1">${t("ui.step.validation")}</h2>
        <div id="validation-container"></div>
      </section>
      <section id="step-params" class="step" aria-labelledby="h-step-params" hidden>
        <h2 id="h-step-params" tabindex="-1">${t("ui.step.params")}</h2>
        <div id="params-container"></div>
      </section>
      <section id="step-preview" class="step" aria-labelledby="h-step-preview" hidden>
        <h2 id="h-step-preview" tabindex="-1">${t("ui.step.preview")}</h2>
        <button id="export-btn-start">${t("ui.button.export")}</button>
        <!-- <article>: the report is a self-contained composition, which gives
             screen readers an entry/exit boundary around it and explains the
             <h1> the template renders inside this step. (It does *not* reset
             heading levels — no sectioning element does; the HTML outline
             algorithm was dropped from the spec and never implemented.)
             Deliberately unlabelled: an aria-label inside this lang="de"
             subtree would be voiced by a German synthesiser under the English
             UI, and the enclosing <section> already names the region.

             lang="de" because the bundled templates are German-only, so the
             report stays German even when the UI is switched to English (WCAG
             3.1.2, Language of Parts). Set here rather than at render time:
             clearing the preview with replaceChildren() removes children, not
             this attribute.

             The DOCX exporter is handed this element and walks its *children*
             — it never reads the container's own tag — so the swap from <div>
             is invisible to the export. -->
        <article id="report-preview" class="report-preview" lang="de"></article>
        <button id="export-btn-end">${t("ui.button.export")}</button>
      </section>
    </main>
    <!-- Legal footer (imprint, accessibility statement) disabled in the public
         build: those pages belong to a deployment, not to the source. To
         restore, re-add a <footer class="site-footer"> with a <nav
         aria-label="${t("ui.footer.label")}"> linking to your own pages. -->
  `);

  // Language selector — disabled for now together with its markup above.
  // Switching the locale re-initialises the app so every program text
  // (labels, buttons, error messages) reflects the new language.
  // const languageSelect = root.querySelector<HTMLSelectElement>("#language-select")!;
  // for (const { code, label } of LOCALES) {
  //   const option = document.createElement("option");
  //   option.value = code;
  //   option.textContent = label;
  //   if (code === getLocale()) option.selected = true;
  //   languageSelect.appendChild(option);
  // }
  // languageSelect.addEventListener("change", () => {
  //   setLocale(languageSelect.value as Locale);
  //   initApp(root);
  //   // initApp rebuilt the DOM, destroying the select that was focused. Put
  //   // focus back on its replacement so a keyboard user isn't dumped at the top
  //   // of the page after changing the language.
  //   root.querySelector<HTMLSelectElement>("#language-select")?.focus();
  // });

  // Per-step explanatory tooltips on each step heading (text lives in i18n,
  // under `<labelKey>.info`).
  for (const [stepId, labelKey] of [
    ["step-template", "ui.step.template"],
    ["step-data", "ui.step.data"],
    ["step-validation", "ui.step.validation"],
    ["step-params", "ui.step.params"],
  ] as const) {
    const h2 = root.querySelector<HTMLElement>(`#${stepId} > h2`);
    if (h2) {
      // A button is valid inside a heading, but the heading's name is computed
      // from its contents — including the button's — so heading navigation
      // would read the whole explanation. An explicit aria-label pins the name
      // to the heading text. Both strings come from the same key, so they
      // cannot drift apart.
      h2.setAttribute("aria-label", t(labelKey));
      attachInfo(h2, t(`${labelKey}.info`), t("ui.info.trigger", { name: t(labelKey) }));
    }
  }

  let dataStore: DataStore;
  let templateText: string;
  let selectedTemplateId: string | undefined;

  /**
   * Unhide a step and, when it was opened by a user action, move focus to its
   * heading. Announcing via a live region alone would leave the tab cursor
   * behind on the previous step's button — often inside a panel that just
   * collapsed — so the user would tab forward blind. The headings carry
   * `tabindex="-1"` to be focusable without joining the tab order.
   */
  function revealStep(step: HTMLElement, moveFocus: boolean): void {
    step.hidden = false;
    if (moveFocus) focusStepHeading(step);
  }

  function focusStepHeading(step: HTMLElement): void {
    step.querySelector<HTMLElement>("h2")?.focus();
  }

  // Parameters answered in step 1 rather than step 3 (`step: template` in the
  // config) — the reporting period, which describes the report rather than its
  // layout. Their values are held here until the preview is generated.
  // Declared before the call below: `showTemplateStep` reads them, and a
  // `const` is in its temporal dead zone until this point.
  const templateParams = parametersForStep(config.parameters, "template");
  const reportParams = parametersForStep(config.parameters, "parameters");
  let templateParamValues: ParameterValues = {};
  // Parameters answered in the data-validation step (`step: data`) — value
  // lists picked from the uploaded data, e.g. which profiles count as
  // STEM. They exist before preprocessing runs, so mutations read them via
  // `from_config`. The snapshot carries the ticks across a re-mapping.
  const dataParams = parametersForStep(config.parameters, "data");
  let dataParamValues: ParameterValues = {};
  let checklistSnapshot: ChecklistSnapshot | undefined;

  showTemplateStep();

  // Step 1: Reporting period + template choice
  function showTemplateStep() {
    const stepTpl = root.querySelector<HTMLElement>("#step-template")!;
    const choices = root.querySelector<HTMLElement>("#template-choices")!;
    const paramHost = root.querySelector<HTMLElement>("#template-params")!;
    const continueBtn = root.querySelector<HTMLButtonElement>("#template-continue")!;
    // No focus move: this runs during initApp, so it would steal focus on page
    // load and again on every language switch.
    revealStep(stepTpl, false);
    // A real <legend> rather than aria-labelledby on the step heading: both
    // name the group, but HTML_CodeSniffer (H71) and BITV audits expect the
    // legend. Built here, not in the shell, because replaceChildren() would
    // wipe it — and it must stay the fieldset's first child.
    const legend = document.createElement("legend");
    legend.className = "template-legend";
    legend.textContent = t("ui.templateChoice.legend");
    choices.replaceChildren(legend);
    paramHost.replaceChildren();

    // Not the step-3 parameter form: that one ends in a "Bericht erstellen"
    // submit button, which is the wrong action here — step 1 continues with
    // its own Continue button — and stacks its fields vertically, where a
    // from/to date pair belongs in one row.
    const periodFields =
      Object.keys(templateParams).length > 0
        ? buildInlineFields(templateParams, paramHost, config)
        : undefined;

    config.template.files.forEach((opt, i) => {
      // The wrapper is a plain <div>, not a <label>: a <label> may not contain
      // interactive content other than the control it labels, and the info
      // button below is exactly that. The label now points at the radio by id
      // and holds nothing but the visible text.
      const wrapper = document.createElement("div");
      wrapper.className = "template-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.id = `template-choice-${i}`;
      radio.name = "template-choice";
      radio.value = opt.file;
      if (i === 0) radio.checked = true;
      wrapper.appendChild(radio);

      const name = document.createElement("label");
      name.className = "template-name";
      name.htmlFor = radio.id;
      name.textContent = opt.label;
      wrapper.appendChild(name);
      attachInfo(
        wrapper,
        resolveTooltip(opt.info, opt.definition),
        t("ui.info.trigger", { name: opt.label })
      );

      choices.appendChild(wrapper);
    });

    continueBtn.onclick = () => {
      const selected = choices.querySelector<HTMLInputElement>(
        "input[name='template-choice']:checked"
      );
      if (!selected) return;
      const bundled = getBundledTemplate(selected.value);
      if (bundled === undefined) return; // startup guard already ruled this out
      templateText = bundled;
      selectedTemplateId = config.template.files.find((f) => f.file === selected.value)?.id;
      templateParamValues = periodFields ? periodFields.collect() : {};
      showDataLoadingStep();
    };
  }

  // Step 2: Data — pick a format, then map the user's sheets/columns onto the
  // config-defined sheets and columns. No rigid validation; unmapped names
  // surface as warnings on Continue.
  function showDataLoadingStep() {
    const stepData = root.querySelector<HTMLElement>("#step-data")!;
    const container = root.querySelector<HTMLElement>("#data-inputs")!;
    revealStep(stepData, true);
    container.replaceChildren();

    // Only request the sheets/columns the selected template actually uses:
    // first the manual `include:` scoping from data.yaml, then the columns
    // computed from the template's own chart/table blocks (resolved through
    // mutations and joins back to physical columns).
    const defs = requiredDataForBlocks(
      parseTemplate(templateText),
      dataForTemplate(config.data, selectedTemplateId),
      config.preprocessing
    );

    let dataFormat: "xlsx" | "csv" = "xlsx";

    // Backs the ids that connect each <label for> to its <select>. A counter
    // rather than a slug of the sheet/column name: those come from config, so
    // they repeat across sheets and contain spaces and umlauts. It keeps
    // climbing across renderBody() rebuilds, which is harmless — the stale ids
    // are discarded with the nodes that carried them.
    let fieldSeq = 0;

    // Parsed source tables.
    const workbooks = new Map<string, Record<string, SourceTable>>(); // xlsx: source → its sheets
    const sheetFiles = new Map<string, SourceTable>();                // csv: config sheet → its file

    // Live <select> references, keyed by config sheet name.
    const sheetSelects = new Map<string, HTMLSelectElement>();
    const columnSelects = new Map<string, Map<string, HTMLSelectElement>>();

    // The mapping UI lives in a collapsible panel; after Continue it folds away
    // (warnings stay visible) and an "edit" button re-opens it for changes.
    const panel = document.createElement("div");
    panel.className = "data-mapping-panel";
    container.appendChild(panel);

    // ── Format toggle ──
    // Native radios in a <fieldset>, not two buttons with an `.active` class:
    // this is one choice out of two, so it wants radio semantics. It also
    // brings arrow-key navigation for free (from the shared `name`) and gives
    // the group an accessible name, which the old <span> label never did.
    // The name lives on the fieldset rather than in a <legend> because a
    // legend is not laid out as a flex item, which would break the one-line
    // row; the visible <span> below carries the identical string.
    const toggle = document.createElement("fieldset");
    toggle.className = "data-format-toggle";
    toggle.setAttribute("aria-label", t("ui.data.format"));
    const formatLabel = document.createElement("span");
    formatLabel.className = "data-format-label";
    formatLabel.textContent = `${t("ui.data.format")}:`;
    formatLabel.setAttribute("aria-hidden", "true"); // duplicates the fieldset's name
    toggle.appendChild(formatLabel);
    const formatRadios = new Map<"xlsx" | "csv", HTMLInputElement>();
    for (const fmt of ["xlsx", "csv"] as const) {
      const optionId = `data-format-${fmt}`;
      const option = document.createElement("label");
      option.className = "data-format-option";
      option.htmlFor = optionId;

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.id = optionId;
      radio.name = "data-format";
      radio.value = fmt;
      radio.checked = fmt === dataFormat;
      radio.addEventListener("change", () => {
        if (!radio.checked || dataFormat === fmt) return;
        dataFormat = fmt;
        renderBody();
      });

      const caption = document.createElement("span");
      caption.textContent = t(`ui.data.format.${fmt}`);
      option.append(radio, caption);
      formatRadios.set(fmt, radio);
      toggle.appendChild(option);
    }
    panel.appendChild(toggle);

    const body = document.createElement("div");
    body.className = "data-mapping";
    panel.appendChild(body);

    const continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.textContent = t("ui.button.continue");
    continueBtn.addEventListener("click", onContinue);
    panel.appendChild(continueBtn);

    // Re-open the collapsed panel to make changes.
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "data-edit-btn";
    editBtn.textContent = t("ui.data.edit");
    editBtn.hidden = true;
    editBtn.addEventListener("click", () => {
      panel.hidden = false;
      // Move focus into the panel *before* hiding the button that currently
      // holds it — hiding the focused element drops focus to <body> and the
      // keyboard user loses their place (WCAG 2.4.3).
      panel.querySelector<HTMLElement>("button, select, input")?.focus();
      editBtn.hidden = true;
    });
    container.appendChild(editBtn);

    renderBody();

    // ── Rendering ──
    function renderBody() {
      for (const [fmt, r] of formatRadios) r.checked = fmt === dataFormat;
      body.replaceChildren();
      sheetSelects.clear();
      columnSelects.clear();
      workbooks.clear();
      sheetFiles.clear();

      for (const [source, def] of Object.entries(defs)) {
        const group = document.createElement("div");
        group.className = "source-group";
        const h = document.createElement("h3");
        h.textContent = source;
        group.appendChild(h);
        if (dataFormat === "xlsx") renderXlsxSource(source, def, group);
        else renderCsvSource(def, group);
        body.appendChild(group);
      }
    }

    // XLSX: one workbook per source; map each config sheet → a workbook sheet,
    // each config column → a column of the chosen sheet.
    function renderXlsxSource(
      source: string,
      def: (typeof config.data)[string],
      group: HTMLElement
    ) {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = WORKBOOK_EXTENSIONS.join(",");
      const fileLabel = document.createElement("label");
      fileLabel.textContent = t("ui.data.uploadWorkbook");
      fileLabel.appendChild(fileInput);
      group.appendChild(fileLabel);
      const showUploadError = makeErrorSlot(group);

      for (const sheetDef of def.sheets) {
        const sheetRow = document.createElement("div");
        sheetRow.className = "sheet-map";

        // <div>, not <label>: with the info button present, the label's
        // "labeled control" resolved to the *button* (the first labelable
        // descendant in tree order) and left this <select> with no accessible
        // name at all. An explicit for/id pairing fixes that.
        const head = document.createElement("div");
        head.className = "sheet-map-head";
        const nameSpan = document.createElement("span");
        nameSpan.className = "sheet-map-name";
        const sheetSel = makeSelect();
        sheetSel.id = `sheet-sel-${++fieldSeq}`;
        const lbl = document.createElement("label");
        lbl.htmlFor = sheetSel.id;
        lbl.textContent = `${sheetDef.sheet} — ${t("ui.data.mapSheet")}`;
        nameSpan.appendChild(lbl);
        attachInfo(
          nameSpan,
          resolveTooltip(sheetDef.info, sheetDef.definition),
          t("ui.info.trigger", { name: sheetDef.sheet })
        );
        head.append(nameSpan, sheetSel);
        sheetRow.appendChild(head);
        sheetSelects.set(sheetDef.sheet, sheetSel);

        const colSelMap = new Map<string, HTMLSelectElement>();
        columnSelects.set(sheetDef.sheet, colSelMap);
        const colsWrap = document.createElement("div");
        colsWrap.className = "column-maps";
        for (const col of sheetDef.columns) {
          const { row, select } = buildColumnRow(col);
          colSelMap.set(col.name, select);
          colsWrap.appendChild(row);
        }
        sheetRow.appendChild(colsWrap);
        group.appendChild(sheetRow);

        // Re-fill the column options when the chosen sheet changes.
        sheetSel.addEventListener("change", () => {
          const table = workbooks.get(source)?.[sheetSel.value];
          for (const col of sheetDef.columns) {
            fillSelect(colSelMap.get(col.name)!, table?.columns ?? [], col.name);
          }
        });
      }

      // Drop everything parsed from this source and blank its selects, so a
      // rejected upload can never leave the previous file's mapping in place
      // while the user believes the new file was loaded.
      function resetSource() {
        workbooks.delete(source);
        for (const sheetDef of def.sheets) {
          fillSelect(sheetSelects.get(sheetDef.sheet)!, [], sheetDef.sheet);
          const colSelMap = columnSelects.get(sheetDef.sheet)!;
          for (const col of sheetDef.columns) {
            fillSelect(colSelMap.get(col.name)!, [], col.name);
          }
        }
      }

      fileInput.addEventListener("change", async () => {
        const f = fileInput.files?.[0];
        if (!f) return;
        showUploadError();

        const invalid = validateUpload(f, WORKBOOK_EXTENSIONS);
        if (invalid) return rejectUpload(invalid);

        let tables: Record<string, SourceTable>;
        try {
          tables = parseWorkbook(await f.arrayBuffer(), f.name);
        } catch (err) {
          if (err instanceof SheetTooLargeError || err instanceof NotAWorkbookError) {
            return rejectUpload(err.message);
          }
          return rejectUpload(
            t("data.parseFailed", { file: f.name, message: errorMessage(err) })
          );
        }
        if (Object.keys(tables).length === 0) {
          return rejectUpload(t("data.noSheets", { file: f.name }));
        }

        workbooks.set(source, tables);
        const sheetNames = Object.keys(tables);
        for (const sheetDef of def.sheets) {
          const sheetSel = sheetSelects.get(sheetDef.sheet)!;
          fillSelect(sheetSel, sheetNames, sheetDef.sheet);
          const table = tables[sheetSel.value];
          const colSelMap = columnSelects.get(sheetDef.sheet)!;
          for (const col of sheetDef.columns) {
            fillSelect(colSelMap.get(col.name)!, table?.columns ?? [], col.name);
          }
        }

        function rejectUpload(message: string) {
          fileInput.value = "";
          resetSource();
          showUploadError(message);
        }
      });
    }

    // CSV: one single-table file (CSV or XLSX) per config sheet; map columns only.
    function renderCsvSource(def: (typeof config.data)[string], group: HTMLElement) {
      for (const sheetDef of def.sheets) {
        const sheetRow = document.createElement("div");
        sheetRow.className = "sheet-map";

        const head = document.createElement("h4");
        head.textContent = sheetDef.sheet;
        head.setAttribute("aria-label", sheetDef.sheet); // see the step headings above
        attachInfo(
          head,
          resolveTooltip(sheetDef.info, sheetDef.definition),
          t("ui.info.trigger", { name: sheetDef.sheet })
        );
        sheetRow.appendChild(head);

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = TABLE_EXTENSIONS.join(",");
        const fileLabel = document.createElement("label");
        fileLabel.textContent = t("ui.data.uploadFile");
        fileLabel.appendChild(fileInput);
        sheetRow.appendChild(fileLabel);
        const showUploadError = makeErrorSlot(sheetRow);

        const colSelMap = new Map<string, HTMLSelectElement>();
        columnSelects.set(sheetDef.sheet, colSelMap);
        const colsWrap = document.createElement("div");
        colsWrap.className = "column-maps";
        for (const col of sheetDef.columns) {
          const { row, select } = buildColumnRow(col);
          colSelMap.set(col.name, select);
          colsWrap.appendChild(row);
        }
        sheetRow.appendChild(colsWrap);
        group.appendChild(sheetRow);

        fileInput.addEventListener("change", async () => {
          const f = fileInput.files?.[0];
          if (!f) return;
          showUploadError();

          const invalid = validateUpload(f, TABLE_EXTENSIONS);
          if (invalid) return rejectUpload(invalid);

          let table: SourceTable;
          try {
            table = parseTable(await f.arrayBuffer(), f.name, sheetDef.sheet);
          } catch (err) {
            if (err instanceof SheetTooLargeError || err instanceof NotAWorkbookError) {
              return rejectUpload(err.message);
            }
            return rejectUpload(
              t("data.parseFailed", { file: f.name, message: errorMessage(err) })
            );
          }
          if (table.columns.length === 0) {
            return rejectUpload(t("data.noSheets", { file: f.name }));
          }

          sheetFiles.set(sheetDef.sheet, table);
          for (const col of sheetDef.columns) {
            fillSelect(colSelMap.get(col.name)!, table.columns, col.name);
          }

          function rejectUpload(message: string) {
            fileInput.value = "";
            sheetFiles.delete(sheetDef.sheet);
            for (const col of sheetDef.columns) {
              fillSelect(colSelMap.get(col.name)!, [], col.name);
            }
            showUploadError(message);
          }
        });
      }
    }

    // ── Upload error slot ──
    /**
     * Attach an inline, screen-reader-announced error line to a file input's
     * container and return a setter for it. Upload problems belong next to the
     * input that caused them — without this, a rejected or unparsable file
     * failed silently (an unhandled rejection in the change handler).
     */
    function makeErrorSlot(parent: HTMLElement): (message?: string) => void {
      const el = document.createElement("p");
      el.className = "upload-error";
      el.setAttribute("role", "alert");
      parent.appendChild(el);
      // Setting the text is the whole update — the slot is never `hidden`,
      // because a live region that is hidden when its content changes is
      // routinely missed. `.upload-error:empty` collapses it when idle.
      return (message) => {
        el.textContent = message ?? "";
      };
    }

    // ── Select helpers ──
    function makeSelect(): HTMLSelectElement {
      const sel = document.createElement("select");
      const none = document.createElement("option");
      none.value = "";
      none.textContent = t("ui.data.none");
      sel.appendChild(none);
      return sel;
    }

    function buildColumnRow(col: ColumnDef): { row: HTMLElement; select: HTMLSelectElement } {
      // See the sheet row above for why this is a <div> with an explicit
      // for/id pairing rather than a <label> wrapping the <select>.
      const row = document.createElement("div");
      row.className = "column-map";
      const select = makeSelect();
      select.id = `col-sel-${++fieldSeq}`;
      const name = document.createElement("span");
      name.className = "column-map-name";
      const lbl = document.createElement("label");
      lbl.htmlFor = select.id;
      lbl.textContent = col.name;
      name.appendChild(lbl);
      attachInfo(
        name,
        resolveTooltip(col.info, col.definition),
        t("ui.info.trigger", { name: col.name })
      );
      row.append(name, select);
      return { row, select };
    }

    /** Replace a select's options with `(none)` + `options`, pre-selecting the name matching `configName`. */
    function fillSelect(sel: HTMLSelectElement, options: string[], configName: string) {
      while (sel.options.length > 1) sel.remove(1);
      for (const o of options) {
        const opt = document.createElement("option");
        opt.value = o;
        opt.textContent = o;
        sel.appendChild(opt);
      }
      sel.value = matchName(configName, options) ?? "";
    }

    // ── Continue: assemble the store and proceed ──
    function onContinue() {
      const mapping: DataMapping = {};
      for (const [source, def] of Object.entries(defs)) {
        for (const sheetDef of def.sheets) {
          let table: SourceTable | undefined;
          if (dataFormat === "xlsx") {
            const sel = sheetSelects.get(sheetDef.sheet);
            if (sel?.value) table = workbooks.get(source)?.[sel.value];
          } else {
            table = sheetFiles.get(sheetDef.sheet);
          }
          const columns: Record<string, string> = {};
          const colSelMap = columnSelects.get(sheetDef.sheet);
          for (const col of sheetDef.columns) columns[col.name] = colSelMap?.get(col.name)?.value ?? "";
          mapping[sheetDef.sheet] = { table, columns };
        }
      }

      const result = assembleStore(defs, mapping);

      // Collapse the mapping panel to keep the page tractable; the "edit"
      // button re-opens it. Focus is on the Continue button inside this panel,
      // so hiding it drops focus to <body> — showValidationStep() immediately
      // re-homes it on the next step's heading, which is why nothing extra is
      // needed here. Keep that call last.
      panel.hidden = true;
      editBtn.hidden = false;

      showValidationStep(result.store, result.warnings);
    }
  }

  // Step 3: Data validation — the user-driven classifications (`step: data`
  // checklists, built from the raw uploaded values), then preprocessing and
  // every data warning. Preprocessing re-runs on each checklist change, so the
  // warnings always describe the store the report will be rendered from.
  function showValidationStep(rawStore: DataStore, mappingWarnings: PreprocessingWarning[]) {
    const stepValidation = root.querySelector<HTMLElement>("#step-validation")!;
    const container = root.querySelector<HTMLElement>("#validation-container")!;
    // A new upload/mapping invalidates everything after this step; close it
    // until the user continues again.
    root.querySelector<HTMLElement>("#step-params")!.hidden = true;
    root.querySelector<HTMLElement>("#step-preview")!.hidden = true;
    revealStep(stepValidation, true);
    container.replaceChildren();

    const checklists = buildDataChecklists(dataParams, rawStore, container, {
      previous: checklistSnapshot,
      onChange: runPipeline,
    });

    // A live region has to be present and *not* hidden before its content
    // changes, or NVDA and JAWS routinely miss the update. It is attached (and
    // the step unhidden) before runPipeline() first fills it, and it is never
    // toggled with `hidden`. `status` (polite) rather than `alert` — these are
    // warnings, and the pipeline continues.
    const dataWarnings = document.createElement("div");
    dataWarnings.className = "data-warnings";
    dataWarnings.setAttribute("role", "status");
    container.appendChild(dataWarnings);

    const continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.textContent = t("ui.button.continue");
    continueBtn.addEventListener("click", showParamsStep);
    container.appendChild(continueBtn);

    runPipeline();

    function runPipeline() {
      dataParamValues = checklists.collect();
      checklistSnapshot = checklists.snapshot();

      // Build derived datasets (mutations + joins) before rendering; surface
      // their warnings alongside the mapping ones. Steps for sheets the
      // template didn't request are dropped, not warned about.
      // Step 1's answers and this step's checklists are merged into the config
      // first, so a mutation reading `{ from_config: … }` sees what the *user*
      // chose, not the bundled default.
      const pre = applyPreprocessing(
        rawStore,
        preprocessingForStore(rawStore, config.preprocessing),
        transforms.registry,
        applyParameterOverrides(config, {
          ...templateParamValues,
          ...dataParamValues,
        }) as unknown as Record<string, unknown>
      );
      dataStore = pre.store;

      // Row-level checks run on the fully preprocessed store, so a rule can
      // target either a raw column or a mutation/join-derived one. Rules for
      // datasets the template never requested are dropped, not warned about.
      const validationWarnings = runValidation(
        pre.store,
        validationForStore(pre.store, config.validation)
      );

      // A `filter:` naming a column the dataset lacks is a silent no-op in
      // `applyFilter` — the block renders over the unfiltered population.
      const filterWarnings = checkFilterColumns(
        parseTemplate(templateText)
          .filter((b) => b.type === "chart" || b.type === "table")
          .map((b) => (b.type === "chart" ? b.spec.table : b.spec)),
        pre.store
      );

      const warnings = [
        ...mappingWarnings,
        // A name defined twice in config/functions/ is a config error: the
        // mutation referencing it may silently get the wrong implementation.
        ...transforms.duplicates.map((fn) => ({
          source: "config/functions",
          message: t("transforms.duplicateFn", { fn }),
        })),
        ...pre.warnings,
        ...filterWarnings,
        ...validationWarnings,
      ];
      dataWarnings.replaceChildren();
      dataWarnings.classList.toggle("data-warnings-ok", warnings.length === 0);
      if (warnings.length === 0) {
        const ok = document.createElement("p");
        ok.textContent = t("ui.validation.noIssues");
        dataWarnings.appendChild(ok);
        return;
      }
      const heading = document.createElement("strong");
      heading.textContent = t("ui.data.warningsHeading");
      dataWarnings.appendChild(heading);
      const list = document.createElement("ul");
      for (const w of warnings) {
        const li = document.createElement("li");
        li.textContent = t("ui.data.warningLine", { source: w.source, message: w.message });
        list.appendChild(li);
      }
      dataWarnings.appendChild(list);
    }
  }

  // Step 4: Parameters
  function showParamsStep() {
    const stepParams = root.querySelector<HTMLElement>("#step-params")!;
    const paramsContainer =
      root.querySelector<HTMLElement>("#params-container")!;
    revealStep(stepParams, true);
    paramsContainer.replaceChildren(); // Continue may be pressed again after re-mapping

    const form = buildParameterForm(reportParams, paramsContainer, config);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // Step 1's and step 3's answers are merged back in, so the
      // renderer and `applyParameterOverrides` see one complete set.
      const paramValues = {
        ...templateParamValues,
        ...dataParamValues,
        ...collectParameterValues(form, reportParams, config),
      };
      generatePreview(templateText, paramValues);
    });
  }

  // Step 5: Render preview
  function generatePreview(
    tplText: string,
    paramValues: Record<string, string | number | boolean | string[]>
  ) {
    const stepPreview = root.querySelector<HTMLElement>("#step-preview")!;
    const previewContainer =
      root.querySelector<HTMLElement>("#report-preview")!;
    previewContainer.replaceChildren();
    // Unhide before rendering, without moving focus yet: Chart.js sizes each
    // canvas from its laid-out box, which is zero while the step is hidden.
    // Focus moves at the end of this function, once there is a report to land in.
    revealStep(stepPreview, false);

    // Merge user-entered values into the config tree at each parameter's
    // `bind:` path. Standalone params (no bind) remain in paramValues for
    // the template renderer to consume.
    const resolved = applyParameterOverrides(config, paramValues);

    const blocks = parseTemplate(tplText);
    const palette = getPalette(resolved.charts?.palette);
    const font = getFont(paramValues.font as string | undefined);

    // Apply font to preview (covers tables and inline text via inheritance).
    previewContainer.style.fontFamily = font.cssStack;

    // The `font` parameter is curated (CSS stack + DOCX name + display name)
    // and not a 1:1 string override, so it bypasses the bind mechanism: inject
    // the resolved docxName into the chart/export font fields here.
    const chartDefaults = {
      ...(resolved.charts ?? {}),
      font: { ...(resolved.charts?.font ?? {}), family: font.docxName },
    };
    const exportConfig = {
      ...(resolved.export ?? {}),
      font: {
        ...(resolved.export?.font ?? {}),
        family: font.docxName,
        headingFamily: font.docxName,
      },
    };

    renderBlocks(blocks, dataStore, paramValues, previewContainer, chartDefaults, palette, resolved.dataParameters);

    // Section numbering + table of contents (preview), mirroring the .docx.
    applyDocumentStructure(previewContainer, {
      sectionNumbering: resolved.export?.sectionNumbering,
      toc: resolved.export?.toc,
    });

    // Export button
    const exportBtnStart = root.querySelector<HTMLButtonElement>("#export-btn-start")!;
    const exportBtnEnd = root.querySelector<HTMLButtonElement>("#export-btn-end")!;
    exportBtnStart.onclick = () => exportToDocx(previewContainer, exportConfig);
    exportBtnEnd.onclick = () => exportToDocx(previewContainer, exportConfig);

    // Land on the step heading rather than inside the report: the boundary is
    // a more useful starting point than the middle of a long document.
    focusStepHeading(stepPreview);
  }
}
