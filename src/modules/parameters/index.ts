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
import type { AppConfig, DataStore, ParameterDef, ParameterValues } from "../types";
import { PALETTES } from "../palettes";
import { FONTS } from "../fonts";
import { t } from "../i18n";
import { attachInfo, resolveTooltip } from "../info";
import { getAtPath } from "../shared/path";
import { asStr, matchesLeafCondition } from "../shared/condition";

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

/**
 * The step-1 fields (parameters marked `step: template`), rendered as a plain
 * inline row rather than through `buildParameterForm`.
 *
 * Deliberately *not* the parameter form: that form ends in a "Bericht
 * erstellen" submit button, which is the wrong action for step 1 — the step
 * continues with its own Continue button. It is also a vertical stack, while
 * a from/to date pair reads as one control and belongs side by side.
 *
 * Returns the fields' container plus a `collect()` that reads the current
 * values, keyed like `collectParameterValues` so both steps' results merge.
 */
export interface InlineFields {
  element: HTMLElement;
  collect(): ParameterValues;
}

export function buildInlineFields(
  parameters: Record<string, ParameterDef>,
  container: HTMLElement,
  config: AppConfig
): InlineFields {
  const row = document.createElement("div");
  row.className = "inline-fields";
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();

  for (const [key, def] of Object.entries(parameters)) {
    const initial = resolveParamDefault(def, config);

    const field = document.createElement("div");
    field.className = "parameter-field";

    // Same shape as a normal parameter field: the ⓘ trigger hangs off a
    // wrapper, never inside the <label>, or it would capture the control's
    // accessible name (see the Info module).
    const head = document.createElement("span");
    head.className = "field-head";
    const label = document.createElement("label");
    label.htmlFor = `param-${key}`;
    label.textContent = def.label;
    head.appendChild(label);
    attachInfo(
      head,
      resolveTooltip(def.info, def.definition),
      t("ui.info.trigger", { name: def.label })
    );
    field.appendChild(head);

    let input: HTMLInputElement | HTMLSelectElement;
    if (def.type === "select") {
      const sel = document.createElement("select");
      for (const opt of def.options ?? []) {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        if (initial === opt) option.selected = true;
        sel.appendChild(option);
      }
      input = sel;
    } else {
      const inp = document.createElement("input");
      // `date` and `number` map to native inputs; anything else is text.
      inp.type = def.type === "date" || def.type === "number" ? def.type : "text";
      if (initial !== undefined && initial !== null) inp.value = String(initial);
      input = inp;
    }
    input.id = `param-${key}`;
    input.name = key;

    field.appendChild(input);
    row.appendChild(field);
    inputs.set(key, input);
  }

  container.appendChild(row);

  return {
    element: row,
    collect() {
      const values: ParameterValues = {};
      for (const [key, def] of Object.entries(parameters)) {
        const raw = inputs.get(key)?.value ?? "";
        const fallback = resolveParamDefault(def, config);
        values[key] =
          def.type === "number"
            ? raw === ""
              ? Number(fallback ?? 0)
              : Number(raw)
            : raw === "" && fallback != null
              ? String(fallback)
              : raw;
      }
      return values;
    },
  };
}

/**
 * The data-validation step's fields (parameters marked `step: data` with an
 * `options_from:` source): one checklist per parameter, listing the distinct
 * values that column holds in the uploaded data, each with its row count.
 *
 * Checkboxes rather than a `<select multiple>`: the multiple select needs
 * Ctrl/Shift to extend a selection with keyboard or mouse, and screen readers
 * announce its selection state inconsistently.
 *
 * Pre-selection: a value keeps the choice from `previous` (the last build —
 * re-mapping in the data step rebuilds this step) when it was offered then;
 * a value seen for the first time is ticked iff it matches `defaultWhen`.
 * Parameters whose dataset/column is missing or empty are skipped, so the
 * binding never receives an empty list for data that simply isn't there.
 */
export interface DataChecklists {
  element: HTMLElement;
  /** The ticked values, keyed by parameter — merge into the parameter values. */
  collect(): ParameterValues;
  /** Offered + ticked values per parameter, to hand back as `previous`. */
  snapshot(): ChecklistSnapshot;
}

export type ChecklistSnapshot = Record<string, { options: string[]; selected: string[] }>;

/** Distinct non-empty values of a column with their row counts, naturally sorted (A9 before A10). */
export function distinctValues(
  store: DataStore,
  source: { dataset: string; column: string }
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of store[source.dataset] ?? []) {
    const v = asStr(row[source.column]);
    if (v !== "") counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, "de", { numeric: true }));
}

/**
 * The pre-selection of every `step: data` checklist without building any DOM:
 * per parameter, the offered values that match its `defaultWhen`. What the
 * app's checklists start from — and what a headless pipeline (tests, the
 * alt-text goldens) should feed to preprocessing to match an untouched step.
 * Parameters without values in `store` are omitted, as in the checklist.
 */
export function dataParameterDefaults(
  parameters: Record<string, ParameterDef>,
  store: DataStore
): ParameterValues {
  const out: ParameterValues = {};
  for (const [key, def] of Object.entries(parameters)) {
    if (!def.optionsFrom) continue;
    const values = distinctValues(store, def.optionsFrom);
    if (values.length === 0) continue;
    out[key] = values.map((v) => v.value).filter((v) => isDefaultSelected(def, v));
  }
  return out;
}

function isDefaultSelected(def: ParameterDef, value: string): boolean {
  return def.defaultWhen !== undefined && matchesLeafCondition(value, def.defaultWhen);
}

export function buildDataChecklists(
  parameters: Record<string, ParameterDef>,
  store: DataStore,
  container: HTMLElement,
  opts: { previous?: ChecklistSnapshot; onChange?: () => void } = {}
): DataChecklists {
  const wrapper = document.createElement("div");
  wrapper.className = "data-checklists";
  const groups = new Map<string, { options: string[]; boxes: HTMLInputElement[] }>();

  for (const [key, def] of Object.entries(parameters)) {
    if (!def.optionsFrom) continue;
    const values = distinctValues(store, def.optionsFrom);
    if (values.length === 0) continue;
    const prev = opts.previous?.[key];
    const total = values.reduce((n, v) => n + v.count, 0);

    // The legend hosts the ⓘ button (legal inside a <legend>), so the
    // fieldset's name is pinned with aria-label — otherwise it would include
    // the button's name as well (see the Info module).
    const fieldset = document.createElement("fieldset");
    fieldset.className = "data-checklist";
    fieldset.setAttribute("aria-label", def.label);
    const legend = document.createElement("legend");
    const legendText = document.createElement("span");
    legendText.textContent = def.label;
    legend.appendChild(legendText);
    attachInfo(legend, resolveTooltip(def.info, def.definition), t("ui.info.trigger", { name: def.label }));
    fieldset.appendChild(legend);

    const actions = document.createElement("div");
    actions.className = "data-checklist-actions";
    const summary = document.createElement("p");
    summary.className = "data-checklist-summary";

    const grid = document.createElement("div");
    grid.className = "data-checklist-options";
    const boxes: HTMLInputElement[] = [];
    const updateSummary = () => {
      const rows = values.reduce((n, v, i) => n + (boxes[i].checked ? v.count : 0), 0);
      summary.textContent = t("ui.validation.summary", {
        selected: boxes.filter((b) => b.checked).length,
        values: values.length,
        rows,
        total,
      });
    };
    const changed = () => {
      updateSummary();
      opts.onChange?.();
    };

    values.forEach(({ value, count }, i) => {
      const option = document.createElement("div");
      option.className = "data-checklist-option";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.id = `param-${key}-${i}`;
      box.name = key;
      box.value = value;
      box.checked =
        prev && prev.options.includes(value)
          ? prev.selected.includes(value)
          : isDefaultSelected(def, value);
      box.addEventListener("change", changed);
      const label = document.createElement("label");
      label.htmlFor = box.id;
      label.textContent = t("ui.validation.option", { value, count });
      option.append(box, label);
      grid.appendChild(option);
      boxes.push(box);
    });

    for (const [labelKey, state] of [
      ["ui.validation.selectAll", true],
      ["ui.validation.selectNone", false],
    ] as const) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = t(labelKey);
      btn.addEventListener("click", () => {
        for (const b of boxes) b.checked = state;
        changed();
      });
      actions.appendChild(btn);
    }

    updateSummary();
    fieldset.append(actions, grid, summary);
    wrapper.appendChild(fieldset);
    groups.set(key, { options: values.map((v) => v.value), boxes });
  }

  container.appendChild(wrapper);

  return {
    element: wrapper,
    collect() {
      const out: ParameterValues = {};
      for (const [key, g] of groups) out[key] = g.boxes.filter((b) => b.checked).map((b) => b.value);
      return out;
    },
    snapshot() {
      const out: ChecklistSnapshot = {};
      for (const [key, g] of groups) {
        out[key] = { options: g.options, selected: g.boxes.filter((b) => b.checked).map((b) => b.value) };
      }
      return out;
    },
  };
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

    // Convention: "page_orientation" renders as page-shape icons (translation-free).
    if (key === "page_orientation" && def.type === "select") {
      form.appendChild(buildOrientationField(key, def, initial));
      continue;
    }

    // Convention: "page_numbers" renders as footer page-number position icons.
    if (key === "page_numbers" && def.type === "select") {
      form.appendChild(buildPageNumberField(key, def, initial));
      continue;
    }

    const fieldset = document.createElement("div");
    fieldset.className = "parameter-field";

    // The info button hangs off a wrapper rather than the <label> itself: a
    // <label> may only contain the control it labels, and a button inside it
    // also leaks into the labelled control's accessible name.
    const head = document.createElement("span");
    head.className = "field-head";
    const label = document.createElement("label");
    label.htmlFor = `param-${key}`;
    label.textContent = def.label;
    head.appendChild(label);
    attachInfo(
      head,
      resolveTooltip(def.info, def.definition),
      t("ui.info.trigger", { name: def.label })
    );
    fieldset.appendChild(head);

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

      case "color": {
        const inp = document.createElement("input");
        inp.type = "color";
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
  // aria-label wins over the <legend> when naming the group. Without it the
  // group name absorbs the legend's info button, and screen readers repeat the
  // group name on entry *and* alongside every radio option — so the noise is
  // multiplied here rather than heard once. Same string as the legend below.
  fieldset.setAttribute("aria-label", def.label);

  const legend = document.createElement("legend");
  legend.textContent = def.label;
  attachInfo(
    legend,
    resolveTooltip(def.info, def.definition),
    t("ui.info.trigger", { name: def.label })
  );
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
    name.textContent = t(`param.palette.${opt}`);
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
  fieldset.setAttribute("aria-label", def.label); // see buildPaletteField

  const legend = document.createElement("legend");
  legend.textContent = def.label;
  attachInfo(
    legend,
    resolveTooltip(def.info, def.definition),
    t("ui.info.trigger", { name: def.label })
  );
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

/**
 * Generic illustrated radio group: each option is a CSS-drawn icon plus a
 * localized caption. Used for translation-free choices like page orientation
 * and page-number position. The selected value is the option string.
 */
function buildIconRadioField(
  key: string,
  def: ParameterDef,
  initial: unknown,
  fieldClass: string,
  optionClass: string,
  iconClassFor: (opt: string) => string,
  labelFor: (opt: string) => string,
  fallbackOptions: string[]
): HTMLElement {
  const fieldset = document.createElement("fieldset");
  fieldset.className = `parameter-field ${fieldClass}`;
  fieldset.setAttribute("aria-label", def.label); // see buildPaletteField

  const legend = document.createElement("legend");
  legend.textContent = def.label;
  attachInfo(
    legend,
    resolveTooltip(def.info, def.definition),
    t("ui.info.trigger", { name: def.label })
  );
  fieldset.appendChild(legend);

  const defaultId = typeof initial === "string" ? initial : undefined;
  const options = def.options && def.options.length > 0 ? def.options : fallbackOptions;

  for (const opt of options) {
    const optionId = `param-${key}-${opt}`;
    const wrapper = document.createElement("label");
    wrapper.className = optionClass;
    wrapper.htmlFor = optionId;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.id = optionId;
    radio.name = key;
    radio.value = opt;
    if (defaultId === opt) radio.checked = true;
    wrapper.appendChild(radio);

    const icon = document.createElement("span");
    icon.className = iconClassFor(opt);
    icon.setAttribute("aria-hidden", "true");
    wrapper.appendChild(icon);

    const caption = document.createElement("span");
    caption.className = "icon-option-caption";
    caption.textContent = labelFor(opt);
    wrapper.appendChild(caption);

    fieldset.appendChild(wrapper);
  }

  return fieldset;
}

/** Page orientation as portrait/landscape page-shape icons. */
function buildOrientationField(key: string, def: ParameterDef, initial: unknown): HTMLElement {
  return buildIconRadioField(
    key, def, initial,
    "orientation-field", "orientation-option",
    (opt) => `orientation-icon orientation-${opt}`,
    (opt) => t(`param.orientation.${opt}`),
    ["portrait", "landscape"]
  );
}

/** Page-number footer position as left/center/right/none page icons. */
function buildPageNumberField(key: string, def: ParameterDef, initial: unknown): HTMLElement {
  return buildIconRadioField(
    key, def, initial,
    "page-numbers-field", "page-number-option",
    (opt) => `page-number-icon page-number-${opt}`,
    (opt) => t(`param.pageNumbers.${opt}`),
    ["left", "center", "right", "none"]
  );
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
