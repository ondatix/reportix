/**
 * App orchestration — wires the modular pipeline together:
 *   config (bundled) → data upload → template choice → parameters → render → export
 */
import { loadConfig } from "./modules/config";
import {
  parseWorkbook,
  parseTable,
  assembleStore,
  matchName,
  type SourceTable,
  type DataMapping,
} from "./modules/data-loader";
import { applyPreprocessing } from "./modules/preprocessing";
import {
  buildParameterForm,
  collectParameterValues,
  applyParameterOverrides,
} from "./modules/parameters";
import { parseTemplate } from "./modules/template";
import { renderBlocks, applyDocumentStructure } from "./modules/renderer";
import { exportToDocx } from "./modules/exporter";
import { getPalette } from "./modules/palettes";
import { getFont } from "./modules/fonts";
import { t, getLocale, setLocale, LOCALES, type Locale } from "./modules/i18n";
import type { DataStore } from "./modules/types";

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

export function initApp(root: HTMLElement): void {
  const config = loadConfig();

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

  root.innerHTML = `
    <img src="../img/ondatix_Logo_hell.png" alt="Reportix Logo" class="logo" height="80" align="right"/><br>
    <h1>reportix - Gleichstellungskonzept</h1>
    <div id="language-bar" class="language-bar">
      <label for="language-select">${t("ui.language")}: </label>
      <select id="language-select"></select>
    </div>
    <div id="step-template" class="step">
      <h2>${t("ui.step.template")}</h2>
      <div id="template-choices"></div>
      <button id="template-continue" type="button">${t("ui.button.continue")}</button>
    </div>
    <div id="step-data" class="step" hidden>
      <h2>${t("ui.step.data")}</h2>
      <div id="data-inputs"></div>
    </div>
    <div id="step-params" class="step" hidden>
      <h2>${t("ui.step.params")}</h2>
      <div id="params-container"></div>
    </div>
    <div id="step-preview" class="step" hidden>
      <h2>${t("ui.step.preview")}</h2>
      <div id="report-preview" class="report-preview"></div>
      <button id="export-btn">${t("ui.button.export")}</button>
    </div>
  `;

  // Language selector — switching the locale re-initialises the app so every
  // program text (labels, buttons, error messages) reflects the new language.
  const languageSelect = root.querySelector<HTMLSelectElement>("#language-select")!;
  for (const { code, label } of LOCALES) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = label;
    if (code === getLocale()) option.selected = true;
    languageSelect.appendChild(option);
  }
  languageSelect.addEventListener("change", () => {
    setLocale(languageSelect.value as Locale);
    initApp(root);
  });

  let dataStore: DataStore;
  let templateText: string;

  showTemplateStep();

  // Step 1: Template choice — radio group over the bundled templates
  function showTemplateStep() {
    const stepTpl = root.querySelector<HTMLElement>("#step-template")!;
    const choices = root.querySelector<HTMLElement>("#template-choices")!;
    const continueBtn = root.querySelector<HTMLButtonElement>("#template-continue")!;
    stepTpl.hidden = false;
    choices.innerHTML = "";

    config.template.files.forEach((opt, i) => {
      const wrapper = document.createElement("label");
      wrapper.className = "template-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "template-choice";
      radio.value = opt.file;
      if (i === 0) radio.checked = true;
      wrapper.appendChild(radio);

      const name = document.createElement("span");
      name.className = "template-name";
      name.textContent = opt.label;
      wrapper.appendChild(name);

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
      showDataLoadingStep();
    };
  }

  // Step 2: Data — pick a format, then map the user's sheets/columns onto the
  // config-defined sheets and columns. No rigid validation; unmapped names
  // surface as warnings on Continue.
  function showDataLoadingStep() {
    const stepData = root.querySelector<HTMLElement>("#step-data")!;
    const container = root.querySelector<HTMLElement>("#data-inputs")!;
    stepData.hidden = false;
    container.innerHTML = "";

    let dataFormat: "xlsx" | "csv" = "xlsx";

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
    const toggle = document.createElement("div");
    toggle.className = "data-format-toggle";
    const formatLabel = document.createElement("span");
    formatLabel.className = "data-format-label";
    formatLabel.textContent = `${t("ui.data.format")}:`;
    toggle.appendChild(formatLabel);
    const formatButtons = new Map<"xlsx" | "csv", HTMLButtonElement>();
    for (const fmt of ["xlsx", "csv"] as const) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t(`ui.data.format.${fmt}`);
      b.addEventListener("click", () => {
        if (dataFormat === fmt) return;
        dataFormat = fmt;
        renderBody();
      });
      formatButtons.set(fmt, b);
      toggle.appendChild(b);
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
      editBtn.hidden = true;
    });
    container.appendChild(editBtn);

    const dataWarnings = document.createElement("div");
    dataWarnings.className = "data-warnings";
    dataWarnings.hidden = true;
    container.appendChild(dataWarnings);

    renderBody();

    // ── Rendering ──
    function renderBody() {
      for (const [fmt, b] of formatButtons) b.classList.toggle("active", fmt === dataFormat);
      body.innerHTML = "";
      sheetSelects.clear();
      columnSelects.clear();
      workbooks.clear();
      sheetFiles.clear();

      for (const [source, def] of Object.entries(config.data)) {
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
      fileInput.accept = ".xlsx,.xls";
      const fileLabel = document.createElement("label");
      fileLabel.textContent = t("ui.data.uploadWorkbook");
      fileLabel.appendChild(fileInput);
      group.appendChild(fileLabel);

      for (const sheetDef of def.sheets) {
        const sheetRow = document.createElement("div");
        sheetRow.className = "sheet-map";

        const lbl = document.createElement("label");
        lbl.className = "sheet-map-head";
        const nameSpan = document.createElement("span");
        nameSpan.className = "sheet-map-name";
        nameSpan.textContent = `${sheetDef.sheet} — ${t("ui.data.mapSheet")}`;
        const sheetSel = makeSelect();
        lbl.append(nameSpan, sheetSel);
        sheetRow.appendChild(lbl);
        sheetSelects.set(sheetDef.sheet, sheetSel);

        const colSelMap = new Map<string, HTMLSelectElement>();
        columnSelects.set(sheetDef.sheet, colSelMap);
        const colsWrap = document.createElement("div");
        colsWrap.className = "column-maps";
        for (const col of sheetDef.columns) {
          const { row, select } = buildColumnRow(col);
          colSelMap.set(col, select);
          colsWrap.appendChild(row);
        }
        sheetRow.appendChild(colsWrap);
        group.appendChild(sheetRow);

        // Re-fill the column options when the chosen sheet changes.
        sheetSel.addEventListener("change", () => {
          const table = workbooks.get(source)?.[sheetSel.value];
          for (const col of sheetDef.columns) {
            fillSelect(colSelMap.get(col)!, table?.columns ?? [], col);
          }
        });
      }

      fileInput.addEventListener("change", async () => {
        const f = fileInput.files?.[0];
        if (!f) return;
        const tables = parseWorkbook(await f.arrayBuffer());
        workbooks.set(source, tables);
        const sheetNames = Object.keys(tables);
        for (const sheetDef of def.sheets) {
          const sheetSel = sheetSelects.get(sheetDef.sheet)!;
          fillSelect(sheetSel, sheetNames, sheetDef.sheet);
          const table = tables[sheetSel.value];
          const colSelMap = columnSelects.get(sheetDef.sheet)!;
          for (const col of sheetDef.columns) {
            fillSelect(colSelMap.get(col)!, table?.columns ?? [], col);
          }
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
        sheetRow.appendChild(head);

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".csv,.xlsx,.xls";
        const fileLabel = document.createElement("label");
        fileLabel.textContent = t("ui.data.uploadFile");
        fileLabel.appendChild(fileInput);
        sheetRow.appendChild(fileLabel);

        const colSelMap = new Map<string, HTMLSelectElement>();
        columnSelects.set(sheetDef.sheet, colSelMap);
        const colsWrap = document.createElement("div");
        colsWrap.className = "column-maps";
        for (const col of sheetDef.columns) {
          const { row, select } = buildColumnRow(col);
          colSelMap.set(col, select);
          colsWrap.appendChild(row);
        }
        sheetRow.appendChild(colsWrap);
        group.appendChild(sheetRow);

        fileInput.addEventListener("change", async () => {
          const f = fileInput.files?.[0];
          if (!f) return;
          const table = parseTable(await f.arrayBuffer(), f.name, sheetDef.sheet);
          sheetFiles.set(sheetDef.sheet, table);
          for (const col of sheetDef.columns) {
            fillSelect(colSelMap.get(col)!, table.columns, col);
          }
        });
      }
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

    function buildColumnRow(col: string): { row: HTMLElement; select: HTMLSelectElement } {
      const row = document.createElement("label");
      row.className = "column-map";
      const name = document.createElement("span");
      name.className = "column-map-name";
      name.textContent = col;
      const select = makeSelect();
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
      for (const [source, def] of Object.entries(config.data)) {
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
          for (const col of sheetDef.columns) columns[col] = colSelMap?.get(col)?.value ?? "";
          mapping[sheetDef.sheet] = { table, columns };
        }
      }

      const result = assembleStore(config.data, mapping);
      // Build derived datasets (mutations + joins) before rendering; surface
      // their warnings alongside the mapping ones.
      const pre = applyPreprocessing(result.store, config.preprocessing);
      dataStore = pre.store;

      const warnings = [...result.warnings, ...pre.warnings];
      dataWarnings.innerHTML = "";
      if (warnings.length > 0) {
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
        dataWarnings.hidden = false;
      } else {
        dataWarnings.hidden = true;
      }

      // Collapse the mapping panel to keep the page tractable; warnings stay
      // visible and the "edit" button re-opens it.
      panel.hidden = true;
      editBtn.hidden = false;

      showParamsStep();
    }
  }

  // Step 3: Parameters
  function showParamsStep() {
    const stepParams = root.querySelector<HTMLElement>("#step-params")!;
    const paramsContainer =
      root.querySelector<HTMLElement>("#params-container")!;
    stepParams.hidden = false;
    paramsContainer.innerHTML = ""; // Continue may be pressed again after re-mapping

    const form = buildParameterForm(config.parameters, paramsContainer, config);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const paramValues = collectParameterValues(form, config.parameters, config);
      generatePreview(templateText, paramValues);
    });
  }

  // Step 4: Render preview
  function generatePreview(
    tplText: string,
    paramValues: Record<string, string | number | boolean | string[]>
  ) {
    const stepPreview = root.querySelector<HTMLElement>("#step-preview")!;
    const previewContainer =
      root.querySelector<HTMLElement>("#report-preview")!;
    previewContainer.innerHTML = "";
    stepPreview.hidden = false;

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

    renderBlocks(blocks, dataStore, paramValues, previewContainer, chartDefaults, palette, resolved.dataProtection);

    // Section numbering + table of contents (preview), mirroring the .docx.
    applyDocumentStructure(previewContainer, {
      sectionNumbering: resolved.export?.sectionNumbering,
      toc: resolved.export?.toc,
    });

    // Export button
    const exportBtn = root.querySelector<HTMLButtonElement>("#export-btn")!;
    exportBtn.onclick = () => exportToDocx(previewContainer, exportConfig);
  }
}
