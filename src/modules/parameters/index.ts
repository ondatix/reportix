/**
 * Parameters module — generates a form from config parameter definitions
 * and collects user input.
 * Usable independently in other projects.
 */
import type { ParameterDef, ParameterValues } from "../types";

export function buildParameterForm(
  parameters: Record<string, ParameterDef>,
  container: HTMLElement
): HTMLFormElement {
  const form = document.createElement("form");
  form.className = "parameter-form";

  for (const [key, def] of Object.entries(parameters)) {
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
