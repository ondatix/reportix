/**
 * Parameters module — generates a form from config parameter definitions
 * and collects user input.
 *
 * Each parameter is either:
 *   • Standalone — a template variable (e.g. `title`, `office`). The form
 *     default comes from `def.default`. The collected value is consumed
 *     by the template renderer via `paramValues[key]`.
 *   • Bound — `def.bind` is a dotted path into the AppConfig (e.g.
 *     `export.font.size`). The form prefills from the value at that path,
 *     and `applyParameterOverrides` writes the user-entered value back to
 *     the same path so downstream modules (exporter, renderers) read the
 *     overridden value.
 *
 * Usable independently in other projects.
 */
import type { AppConfig, ParameterDef, ParameterValues } from "../types";
import { PALETTES } from "../palettes";
import { FONTS } from "../fonts";
import { t } from "../i18n";

/**
 * Resolve the default value to prefill into the form for a single parameter.
 * Bound parameters read from the config tree at `def.bind`; standalone
 * parameters fall back to `def.default`.
 */
export function resolveParamDefault(
  def: ParameterDef,
  config: AppConfig
): unknown {
  if (def.bind) return getAtPath(config as unknown as Record<string, unknown>, def.bind);
  return def.default;
}

/**
 * Return a new AppConfig with every bound parameter's user-entered value
 * written back to its `bind` path. Standalone parameters are not merged
 * into the config — they remain in `values` for the template renderer.
 * The input config is not mutated.
 */
export function applyParameterOverrides(
  config: AppConfig,
  values: ParameterValues
): AppConfig {
  const clone = structuredClone(config);
  for (const [key, def] of Object.entries(config.parameters)) {
    if (!def.bind) continue;
    const v = values[key];
    if (v === undefined) continue;
    setAtPath(clone as unknown as Record<string, unknown>, def.bind, v);
  }
  return clone;
}

function getAtPath(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function setAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) {
      cur[p] = {};
    }
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function buildParameterForm(
  parameters: Record<string, ParameterDef>,
  container: HTMLElement,
  config: AppConfig
): HTMLFormElement {
  const form = document.createElement("form");
  form.className = "parameter-form";

  for (const [key, def] of Object.entries(parameters)) {
    const initial = resolveParamDefault(def, config);

    // Convention: a select named "palette" renders as an illustrated radio group
    // showing each palette's swatches inline.
    if (key === "palette" && def.type === "select") {
      form.appendChild(buildPaletteField(key, def, initial));
      continue;
    }

    // Convention: a select named "font" renders each option in its own typeface.
    if (key === "font" && def.type === "select") {
      form.appendChild(buildFontField(key, def, initial));
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
          if (initial === opt) option.selected = true;
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
        const defaults: string[] = Array.isArray(initial)
          ? (initial as string[])
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
        cb.checked = Boolean(initial);
        input = cb;
        break;
      }

      case "number": {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.id = `param-${key}`;
        inp.name = key;
        if (initial !== undefined && initial !== null) inp.value = String(initial);
        input = inp;
        break;
      }

      case "date": {
        const inp = document.createElement("input");
        inp.type = "date";
        inp.id = `param-${key}`;
        inp.name = key;
        if (initial !== undefined && initial !== null) inp.value = String(initial);
        input = inp;
        break;
      }

      default: {
        // "text" and fallback
        const inp = document.createElement("input");
        inp.type = "text";
        inp.id = `param-${key}`;
        inp.name = key;
        if (initial !== undefined && initial !== null) inp.value = String(initial);
        input = inp;
        break;
      }
    }

    fieldset.appendChild(input);
    form.appendChild(fieldset);
  }

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = t("ui.button.generate");
  form.appendChild(submit);

  container.appendChild(form);
  return form;
}

/**
 * Render a palette parameter as a fieldset of radio buttons, each showing
 * the palette's name and a horizontal strip of its actual colour swatches.
 * Falls back gracefully for any option ID that has no matching palette.
 */
function buildPaletteField(
  key: string,
  def: ParameterDef,
  initial: unknown
): HTMLElement {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "parameter-field palette-field";

  const legend = document.createElement("legend");
  legend.textContent = def.label;
  fieldset.appendChild(legend);

  const defaultId = typeof initial === "string" ? initial : undefined;

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
function buildFontField(
  key: string,
  def: ParameterDef,
  initial: unknown
): HTMLElement {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "parameter-field font-field";

  const legend = document.createElement("legend");
  legend.textContent = def.label;
  fieldset.appendChild(legend);

  const defaultId = typeof initial === "string" ? initial : undefined;

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
  parameters: Record<string, ParameterDef>,
  config: AppConfig
): ParameterValues {
  const formData = new FormData(form);
  const values: ParameterValues = {};

  for (const [key, def] of Object.entries(parameters)) {
    const fallback = resolveParamDefault(def, config);
    switch (def.type) {
      case "boolean": {
        values[key] = formData.has(key);
        break;
      }
      case "number": {
        const raw = formData.get(key);
        values[key] = raw === null || raw === "" ? Number(fallback ?? 0) : Number(raw);
        break;
      }
      case "multiselect": {
        values[key] = formData.getAll(key) as string[];
        break;
      }
      default: {
        const raw = formData.get(key);
        values[key] = (raw as string | null) ?? String(fallback ?? "");
        break;
      }
    }
  }

  return values;
}
