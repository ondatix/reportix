/**
 * App orchestration — wires the modular pipeline together:
 *   config (bundled) → data upload → template upload → parameters → render → export
 */
import { loadConfig } from "./modules/config";
import { loadDataSources } from "./modules/data-loader";
import {
  buildParameterForm,
  collectParameterValues,
} from "./modules/parameters";
import { parseTemplate } from "./modules/template";
import { renderBlocks } from "./modules/renderer";
import { exportToDocx } from "./modules/exporter";
import { getPalette } from "./modules/palettes";
import { getFont } from "./modules/fonts";
import type { DataStore } from "./modules/types";

export function initApp(root: HTMLElement): void {
  const config = loadConfig();

  root.innerHTML = `
    <h1>ondatix autoreport</h1>
    <div id="step-data" class="step">
      <h2>1. Load Data Files</h2>
      <div id="data-inputs"></div>
    </div>
    <div id="step-template" class="step" hidden>
      <h2>2. Load Template</h2>
      <label>
        Template file (.md):
        <input type="file" id="template-input" accept=".md" />
      </label>
    </div>
    <div id="step-params" class="step" hidden>
      <h2>3. Report Parameters</h2>
      <div id="params-container"></div>
    </div>
    <div id="step-preview" class="step" hidden>
      <h2>Report Preview</h2>
      <div id="report-preview" class="report-preview"></div>
      <button id="export-btn">Export as .docx</button>
    </div>
  `;

  let dataStore: DataStore;
  let templateText: string;

  // Step 1: Data files
  const dataInputs = root.querySelector<HTMLElement>("#data-inputs")!;
  const dataError = document.createElement("p");
  dataError.className = "error";
  dataError.hidden = true;

  for (const [name, def] of Object.entries(config.data)) {
    const expectedSheets = def.sheets.map((s) => s.sheet).join(", ");
    const label = document.createElement("label");
    label.textContent = `${name} (expected sheets: ${expectedSheets}): `;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.dataset.name = name;
    label.appendChild(input);
    dataInputs.appendChild(label);
  }

  dataInputs.appendChild(dataError);

  const loadBtn = document.createElement("button");
  loadBtn.textContent = "Load & Validate Data";
  loadBtn.addEventListener("click", async () => {
    dataError.hidden = true;
    const fileInputs =
      dataInputs.querySelectorAll<HTMLInputElement>("input[type=file]");
    const files = new Map<string, ArrayBuffer>();
    for (const fi of fileInputs) {
      const f = fi.files?.[0];
      if (f) files.set(fi.dataset.name!, await f.arrayBuffer());
    }
    try {
      dataStore = loadDataSources(files, config.data);
      showTemplateStep();
    } catch (err) {
      dataError.textContent = (err as Error).message;
      dataError.hidden = false;
    }
  });
  dataInputs.appendChild(loadBtn);

  // Step 2: Template
  function showTemplateStep() {
    const stepTpl = root.querySelector<HTMLElement>("#step-template")!;
    stepTpl.hidden = false;

    const tplInput = root.querySelector<HTMLInputElement>("#template-input")!;
    tplInput.addEventListener("change", async () => {
      const file = tplInput.files?.[0];
      if (!file) return;
      templateText = await file.text();
      showParamsStep();
    });
  }

  // Step 3: Parameters
  function showParamsStep() {
    const stepParams = root.querySelector<HTMLElement>("#step-params")!;
    const paramsContainer =
      root.querySelector<HTMLElement>("#params-container")!;
    stepParams.hidden = false;

    const form = buildParameterForm(config.parameters, paramsContainer);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const paramValues = collectParameterValues(form, config.parameters);
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

    const blocks = parseTemplate(tplText);
    const palette = getPalette(paramValues.palette as string | undefined);
    const font = getFont(paramValues.font as string | undefined);

    // Apply font to preview (covers tables and inline text via inheritance).
    previewContainer.style.fontFamily = font.cssStack;

    // Override chart and export font with the user's selection.
    const chartDefaults = {
      ...(config.charts ?? {}),
      font: { ...(config.charts?.font ?? {}), family: font.docxName },
    };
    const exportConfig = {
      ...(config.export ?? {}),
      font: {
        ...(config.export?.font ?? {}),
        family: font.docxName,
        headingFamily: font.docxName,
      },
    };

    renderBlocks(blocks, dataStore, paramValues, previewContainer, chartDefaults, palette, config.dataProtection);

    // Export button
    const exportBtn = root.querySelector<HTMLButtonElement>("#export-btn")!;
    exportBtn.onclick = () => exportToDocx(previewContainer, exportConfig);
  }
}
