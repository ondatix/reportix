/**
 * Parameters module — generates a form from config parameter definitions
 * and collects user input.
 * Usable independently in other projects.
 */
import type { ParameterDef, ParameterValues } from "../types";
import { PALETTES } from "../palettes";
import { FONTS } from "../fonts";

export function buildParameterForm(
  parameters: Record<string, ParameterDef>,
  container: HTMLElement
): HTMLFormElement {
  const form = document.createElement("form");
  form.className = "parameter-form";

  for (const [key, def] of Object.entries(parameters)) {
    // Convention: a select named "palette" renders as an illustrated radio group
    // showing each palette's swatches inline.
    if (key === "palette" && def.type === "select") {
      form.appendChild(buildPaletteField(key, def));
      continue;
    }

    // Convention: a select named "font" renders each option in its own typeface.
    if (key === "font" && def.type === "select") {
      form.appendChild(buildFontField(key, def));
      continue;
    }

    const fieldset = document.createElement("div");
    fieldset.className = "parameter-field";

    const label = document.createElement("label");
    label.htmlFor = `param-${key}`;
    label.textContent = def.label;
    fieldset.appendChild(label);

    let input: HTMLElement;

    switch (def.type) {
      case "select": {
        const sel = document.createElement("select");
        sel.id = `param-${key}`;
        sel.name = key;
        for (const opt of def.options ?? []) {
          const option = document.createElement("option");
          option.value = opt;
          option.textContent = opt;
          if (def.default === opt) option.selected = true;
          sel.appendChild(option);
        }
        input = sel;
        break;
      }

      case "multiselect": {
        const sel = document.createElement("select");
        sel.id = `param-${key}`;
        sel.name = key;
        sel.multiple = true;
        const defaults: string[] = Array.isArray(def.default)
          ? (def.default as string[])
          : [];
        for (const opt of def.options ?? []) {
          const option = document.createElement("option");
          option.value = opt;
          option.textContent = opt;
          if (defaults.includes(opt)) option.selected = true;
          sel.appendChild(option);
        }
        input = sel;
        break;
      }

      case "boolean": {
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = `param-${key}`;
        cb.name = key;
        cb.checked = Boolean(def.default);
        input = cb;
        break;
      }

      case "number": {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.id = `param-${key}`;
        inp.name = key;
        if (def.default !== undefined) inp.value = String(def.default);
        input = inp;
        break;
      }

      case "date": {
        const inp = document.createElement("input");
        inp.type = "date";
        inp.id = `param-${key}`;
        inp.name = key;
        if (def.default !== undefined) inp.value = String(def.default);
        input = inp;
        break;
      }

      default: {
        // "text" and fallback
        const inp = document.createElement("input");
        inp.type = "text";
        inp.id = `param-${key}`;
        inp.name = key;
        if (def.default !== undefined) inp.value = String(def.default);
        input = inp;
        break;
      }
    }

    fieldset.appendChild(input);
    form.appendChild(fieldset);
  }

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Generate Report";
  form.appendChild(submit);

  container.appendChild(form);
  return form;
}

/**
 * Render a palette parameter as a fieldset of radio buttons, each showing
 * the palette's name and a horizontal strip of its actual colour swatches.
 * Falls back gracefully for any option ID that has no matching palette.
 */
function buildPaletteField(key: string, def: ParameterDef): HTMLElement {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "parameter-field palette-field";

  const legend = document.createElement("legend");
  legend.textContent = def.label;
  fieldset.appendChild(legend);

  const defaultId = typeof def.default === "string" ? def.default : undefined;

  for (const opt of def.options ?? []) {
    const optionId = `param-${key}-${opt}`;
    const wrapper = document.createElement("label");
    wrapper.className = "palette-option";
    wrapper.htmlFor = optionId;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.id = optionId;
    radio.name = key;
    radio.value = opt;
    if (defaultId === opt) radio.checked = true;
    wrapper.appendChild(radio);

    const name = document.createElement("span");
    name.className = "palette-name";
    name.textContent = opt;
    wrapper.appendChild(name);

    const swatches = document.createElement("span");
    swatches.className = "palette-swatches";
    swatches.setAttribute("aria-hidden", "true");
    const colors = PALETTES[opt as keyof typeof PALETTES] ?? [];
    for (const c of colors) {
      const dot = document.createElement("span");
      dot.className = "palette-swatch";
      dot.style.background = c;
      swatches.appendChild(dot);
    }
    wrapper.appendChild(swatches);

    fieldset.appendChild(wrapper);
  }

  return fieldset;
}

/**
 * Render a font parameter as a fieldset of radio buttons, each label rendered
 * in the actual typeface so users can compare legibility before choosing.
 */
function buildFontField(key: string, def: ParameterDef): HTMLElement {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "parameter-field font-field";

  const legend = document.createElement("legend");
  legend.textContent = def.label;
  fieldset.appendChild(legend);

  const defaultId = typeof def.default === "string" ? def.default : undefined;

  for (const opt of def.options ?? []) {
    const optionId = `param-${key}-${opt}`;
    const wrapper = document.createElement("label");
    wrapper.className = "font-option";
    wrapper.htmlFor = optionId;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.id = optionId;
    radio.name = key;
    radio.value = opt;
    if (defaultId === opt) radio.checked = true;
    wrapper.appendChild(radio);

    const font = FONTS[opt];
    const sample = document.createElement("span");
    sample.className = "font-sample";
    sample.textContent = font ? font.displayName : opt;
    if (font) sample.style.fontFamily = font.cssStack;
    wrapper.appendChild(sample);

    fieldset.appendChild(wrapper);
  }

  return fieldset;
}

export function collectParameterValues(
  form: HTMLFormElement,
  parameters: Record<string, ParameterDef>
): ParameterValues {
  const formData = new FormData(form);
  const values: ParameterValues = {};

  for (const [key, def] of Object.entries(parameters)) {
    switch (def.type) {
      case "boolean": {
        values[key] = formData.has(key);
        break;
      }
      case "number": {
        values[key] = Number(formData.get(key) ?? def.default ?? 0);
        break;
      }
      case "multiselect": {
        values[key] = formData.getAll(key) as string[];
        break;
      }
      default: {
        values[key] = (formData.get(key) as string) ?? String(def.default ?? "");
        break;
      }
    }
  }

  return values;
}
