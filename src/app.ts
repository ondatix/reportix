/**
 * App orchestration — wires the modular pipeline together:
 *   config (bundled) → data upload → template choice → parameters → render → export
 */
import { loadConfig } from "./modules/config";
import { loadDataSources } from "./modules/data-loader";
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
    <h1>reportix</h1>
    <div id="language-bar" class="language-bar">
      <label for="language-select">${t("ui.language")}: </label>
      <select id="language-select"></select>
    </div>
    <div id="step-data" class="step">
      <h2>${t("ui.step.data")}</h2>
      <div id="data-inputs"></div>
    </div>
    <div id="step-template" class="step" hidden>
      <h2>${t("ui.step.template")}</h2>
      <div id="template-choices"></div>
      <button id="template-continue" type="button">${t("ui.button.continue")}</button>
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

  // Step 1: Data files
  const dataInputs = root.querySelector<HTMLElement>("#data-inputs")!;
  const dataWarnings = document.createElement("div");
  dataWarnings.className = "data-warnings";
  dataWarnings.hidden = true;

  for (const [name, def] of Object.entries(config.data)) {
    const expectedSheets = def.sheets.map((s) => s.sheet).join(", ");
    const label = document.createElement("label");
    label.textContent = t("ui.data.expectedSheets", { name, sheets: expectedSheets });
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.dataset.name = name;
    label.appendChild(input);
    dataInputs.appendChild(label);
  }

  dataInputs.appendChild(dataWarnings);

  const loadBtn = document.createElement("button");
  loadBtn.textContent = t("ui.button.loadValidate");
  loadBtn.addEventListener("click", async () => {
    dataWarnings.hidden = true;
    dataWarnings.innerHTML = "";
    const fileInputs =
      dataInputs.querySelectorAll<HTMLInputElement>("input[type=file]");
    const files = new Map<string, ArrayBuffer>();
    for (const fi of fileInputs) {
      const f = fi.files?.[0];
      if (f) files.set(fi.dataset.name!, await f.arrayBuffer());
    }
    const result = loadDataSources(files, config.data);
    dataStore = result.store;
    if (result.warnings.length > 0) {
      const heading = document.createElement("strong");
      heading.textContent = t("ui.data.warningsHeading");
      dataWarnings.appendChild(heading);
      const list = document.createElement("ul");
      for (const w of result.warnings) {
        const li = document.createElement("li");
        li.textContent = t("ui.data.warningLine", { source: w.source, message: w.message });
        list.appendChild(li);
      }
      dataWarnings.appendChild(list);
      dataWarnings.hidden = false;
    }
    showTemplateStep();
  });
  dataInputs.appendChild(loadBtn);

  // Step 2: Template choice — radio group over the bundled templates
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
      showParamsStep();
    };
  }

  // Step 3: Parameters
  function showParamsStep() {
    const stepParams = root.querySelector<HTMLElement>("#step-params")!;
    const paramsContainer =
      root.querySelector<HTMLElement>("#params-container")!;
    stepParams.hidden = false;

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
