/**
 * @vitest-environment jsdom
 *
 * The data-validation step's checklists (`step: data` parameters with
 * `options_from`): offered values, pre-selection, carrying ticks across a
 * rebuild, the DOM-free defaults, and — the reason they exist — that a
 * mutation reading the selection via `from_config` follows the user's ticks.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildDataChecklists,
  dataParameterDefaults,
  distinctValues,
  applyParameterOverrides,
} from "../../src/modules/parameters";
import { parseConfigObject } from "../../src/modules/config";
import { applyPreprocessing } from "../../src/modules/preprocessing";
import { setLocale, DEFAULT_LOCALE } from "../../src/modules/i18n";
import type { DataStore } from "../../src/modules/types";
import { expectNoViolations, mountRoot } from "../a11y/helpers";

const config = parseConfigObject({
  parameters: {
    beamte_groups: {
      label: { de: "Besoldungsgruppen", en: "Pay grades" },
      info: "Angehakte Gruppen zählen als Beamte.",
      type: "multiselect",
      step: "data",
      options_from: { dataset: "Stichtag", column: "Gruppe" },
      default_when: { starts_with: ["A", "B"] },
      bind: "dataParameters.selections.beamte_groups",
    },
    missing: {
      label: "Fehlt",
      type: "multiselect",
      step: "data",
      options_from: { dataset: "Nirgends", column: "X" },
      bind: "dataParameters.selections.missing",
    },
  },
  preprocessing: {
    mutations: [
      {
        dataset: "Stichtag",
        column: "Beamte",
        from: "Gruppe",
        cases: [
          { when: { empty: true }, then: "" },
          { when: { in: { from_config: "dataParameters.selections.beamte_groups" } }, then: "Ja" },
        ],
        else: "Nein",
      },
    ],
  },
});

const store: DataStore = {
  Stichtag: [
    { Gruppe: "A10" },
    { Gruppe: "A9" },
    { Gruppe: "A9" },
    { Gruppe: "E5" },
    { Gruppe: "Beamter" },
    { Gruppe: "" },
  ],
};

function beamte(values: Record<string, string[]>): unknown[] {
  const settings = applyParameterOverrides(config, values) as unknown as Record<string, unknown>;
  return applyPreprocessing(store, config.preprocessing, undefined, settings).store.Stichtag.map(
    (r) => r.Beamte
  );
}

describe("distinctValues / dataParameterDefaults", () => {
  it("lists non-empty values with counts, in natural order", () => {
    expect(distinctValues(store, { dataset: "Stichtag", column: "Gruppe" })).toEqual([
      { value: "A9", count: 2 },
      { value: "A10", count: 1 },
      { value: "Beamter", count: 1 },
      { value: "E5", count: 1 },
    ]);
  });

  it("pre-selects by default_when and skips parameters without data", () => {
    expect(dataParameterDefaults(config.parameters, store)).toEqual({
      beamte_groups: ["A9", "A10", "Beamter"],
    });
  });
});

describe("from_config in a mutation condition", () => {
  it("classifies by the selected list", () => {
    expect(beamte({ beamte_groups: ["A9"] })).toEqual(["Nein", "Ja", "Ja", "Nein", "Nein", ""]);
  });

  it("matches nothing when the reference is unresolved", () => {
    expect(beamte({})).toEqual(["Nein", "Nein", "Nein", "Nein", "Nein", ""]);
  });
});

describe("buildDataChecklists", () => {
  let root: HTMLElement;
  beforeEach(() => {
    setLocale(DEFAULT_LOCALE);
    root = mountRoot();
  });

  it("renders one labelled checkbox per value, pre-selected, without violations", async () => {
    const lists = buildDataChecklists(config.parameters, store, root);
    const boxes = [...root.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    expect(boxes.map((b) => b.value)).toEqual(["A9", "A10", "Beamter", "E5"]);
    expect(lists.collect()).toEqual({ beamte_groups: ["A9", "A10", "Beamter"] });
    expect(root.querySelectorAll("fieldset").length).toBe(1); // "missing" skipped
    expect(root.querySelector(`label[for="${boxes[0].id}"]`)!.textContent).toBe("A9 (2 Personen)");
    expect(root.querySelector(".data-checklist-summary")!.textContent).toContain("4 von 5 Zeilen");
    await expectNoViolations(root);
  });

  it("reports changes, and select-none clears every box", () => {
    let calls = 0;
    const lists = buildDataChecklists(config.parameters, store, root, { onChange: () => calls++ });
    const box = root.querySelector<HTMLInputElement>('input[value="Beamter"]')!;
    box.checked = false;
    box.dispatchEvent(new Event("change"));
    expect(calls).toBe(1);
    expect(lists.collect()).toEqual({ beamte_groups: ["A9", "A10"] });
    const none = [...root.querySelectorAll("button")].find((b) => b.textContent === "Keine auswählen")!;
    none.click();
    expect(calls).toBe(2);
    expect(lists.collect()).toEqual({ beamte_groups: [] });
  });

  it("keeps earlier ticks on rebuild; new values fall back to default_when", () => {
    const previous = { beamte_groups: { options: ["A9", "E5"], selected: ["E5"] } };
    const lists = buildDataChecklists(config.parameters, store, root, { previous });
    // A9 was offered and unticked → stays unticked; E5 stays ticked;
    // A10/Beamter are new → default_when.
    expect(lists.collect()).toEqual({ beamte_groups: ["A10", "Beamter", "E5"] });
  });
});
