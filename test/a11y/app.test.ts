/**
 * @vitest-environment jsdom
 *
 * Accessibility regression tests for the app shell and each interactive step.
 *
 * jsdom is scoped to this suite with the docblock above rather than switched
 * on globally: only these tests need a DOM, and vitest 4 removed
 * `environmentMatchGlobs`.
 *
 * The DOM under test is built by the real `initApp`, driven through the same
 * clicks a user would make, so these break when the markup regresses — not
 * when a fixture drifts.
 */
import { describe, it, beforeEach, expect } from "vitest";
import { initApp } from "../../src/app";
import { setLocale, DEFAULT_LOCALE } from "../../src/modules/i18n";
import {
  expectNoViolations,
  mountRoot,
  goToDataStep,
  goToValidationStep,
  goToParamsStep,
} from "./helpers";

/**
 * Look up the <label for> pointing at `id`. Not `CSS.escape` — jsdom does not
 * implement it, and the generated ids are counter-based anyway.
 */
function labelFor(root: HTMLElement, id: string): HTMLLabelElement | undefined {
  return [...root.querySelectorAll("label")].find((l) => l.htmlFor === id);
}

describe("app shell accessibility", () => {
  let root: HTMLElement;

  beforeEach(() => {
    // The i18n module holds one global locale, so a test that switches
    // language would leak into the next one.
    setLocale(DEFAULT_LOCALE);
    root = mountRoot();
    initApp(root);
  });

  it("has no violations on the template step", async () => {
    await expectNoViolations(root);
  });

  it("exposes the landmark structure", () => {
    expect(root.querySelector("header")).not.toBeNull();
    expect(root.querySelector("main#main-content")).not.toBeNull();
    // <header> must not be nested in <main>, or it loses its banner role.
    expect(root.querySelector("main header")).toBeNull();
    // The skip link has to be the first focusable thing on the page.
    expect(root.firstElementChild?.classList.contains("skip-link")).toBe(true);
    expect(root.querySelector(".skip-link")!.getAttribute("href")).toBe("#main-content");
  });

  it("names every step region from its own heading", () => {
    const sections = root.querySelectorAll<HTMLElement>("main > section.step");
    expect(sections.length).toBe(5);
    for (const section of sections) {
      const id = section.getAttribute("aria-labelledby");
      expect(id, `${section.id} has no aria-labelledby`).toBeTruthy();
      expect(section.querySelector("h2")!.id).toBe(id);
    }
  });

  it("keeps the document language in sync with the locale", () => {
    expect(document.documentElement.lang).toBe("de");
    // The language selector is commented out in the shell for now, so switch
    // the locale the way its change handler did. When it returns, drive it
    // through the select again:
    //   const select = root.querySelector<HTMLSelectElement>("#language-select")!;
    //   select.value = "en";
    //   select.dispatchEvent(new Event("change"));
    setLocale("en");
    initApp(root);
    expect(document.documentElement.lang).toBe("en");
  });

  it("names the template choice group with a legend", () => {
    const fieldset = root.querySelector<HTMLFieldSetElement>("#template-choices")!;
    expect(fieldset.firstElementChild?.tagName).toBe("LEGEND");
    expect(fieldset.firstElementChild?.textContent).toBe("Berichtsvorlage");
  });

  it("has no violations on the data-mapping step", async () => {
    goToDataStep(root);
    expect(root.querySelectorAll(".column-map").length).toBeGreaterThan(0);
    await expectNoViolations(root);
  });

  it("has no violations on the data step in CSV mode", async () => {
    goToDataStep(root);
    const csv = root.querySelector<HTMLInputElement>("#data-format-csv")!;
    csv.checked = true;
    csv.dispatchEvent(new Event("change"));
    expect(root.querySelectorAll('.data-mapping input[type="file"]').length).toBeGreaterThan(0);
    await expectNoViolations(root);
  });

  it("has no violations on the data-validation step, warnings included", async () => {
    goToValidationStep(root);
    const step = root.querySelector<HTMLElement>("#step-validation")!;
    expect(step.hidden).toBe(false);
    expect(document.activeElement).toBe(step.querySelector("h2"));
    // Continuing without an upload is expected to warn; the region must be
    // populated and still clean.
    expect(step.querySelector(".data-warnings")!.textContent).not.toBe("");
    await expectNoViolations(root);
  });

  it("has no violations on the parameters step", async () => {
    goToParamsStep(root);
    expect(root.querySelector<HTMLElement>("#step-params")!.hidden).toBe(false);
    await expectNoViolations(root);
  });

  it("closes the later steps again when the mapping is re-submitted", () => {
    goToParamsStep(root);
    root.querySelector<HTMLButtonElement>(".data-edit-btn")!.click();
    root.querySelector<HTMLButtonElement>(".data-mapping-panel > button")!.click();
    expect(root.querySelector<HTMLElement>("#step-validation")!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>("#step-params")!.hidden).toBe(true);
  });
});

describe("form control naming", () => {
  let root: HTMLElement;

  beforeEach(() => {
    // The i18n module holds one global locale, so a test that switches
    // language would leak into the next one.
    setLocale(DEFAULT_LOCALE);
    root = mountRoot();
    initApp(root);
    goToDataStep(root);
  });

  /**
   * The regression this suite exists for: with an info button present, a
   * <label> that wrapped its own <select> bound to the *button* instead (the
   * first labelable descendant in tree order), leaving the select with no
   * accessible name at all. Nearly every mapping control was affected, since
   * config/data.yaml supplies a `definition` for almost all of them.
   */
  it("gives every mapping select a label of its own", () => {
    const selects = root.querySelectorAll<HTMLSelectElement>(".data-mapping select");
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) {
      expect(select.id, "select has no id to be labelled by").toBeTruthy();
      const label = labelFor(root, select.id);
      expect(label, `no <label for="${select.id}">`).toBeDefined();
      expect(label!.textContent!.trim().length).toBeGreaterThan(0);
      // The label must not contain the info button, or its text leaks back in.
      expect(label!.querySelector(".info-trigger")).toBeNull();
    }
  });

  it("keeps the info trigger's accessible name short", () => {
    const triggers = root.querySelectorAll<HTMLElement>(".info-trigger");
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      const name = trigger.getAttribute("aria-label")!;
      expect(name).toMatch(/^Erläuterung: /);
      // The long definition belongs in the popup, not in the button's name.
      const popup = trigger.parentElement!.querySelector(".info-popup")!;
      expect(popup.textContent!.length).toBeGreaterThan(0);
      expect(name.length).toBeLessThan(popup.textContent!.length + 20);
      expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    }
  });

  /**
   * A <label> may contain no interactive content other than the control it
   * labels. Wrapping a single <input> is therefore fine (the file pickers and
   * the format radios do this); a <button>, <select> or link inside is not —
   * that was the defect, since <button> is labelable and so stole the
   * association from the <select> that followed it.
   */
  it("never contains interactive content beyond its own control", () => {
    for (const label of root.querySelectorAll("label")) {
      const illegal = label.querySelectorAll("button, a[href], select, textarea");
      expect(
        illegal.length,
        `<label> contains ${illegal.length} illegal interactive descendant(s): ${label.textContent?.trim().slice(0, 40)}`
      ).toBe(0);
      expect(
        label.querySelectorAll("input").length,
        `<label> wraps more than one control: ${label.textContent?.trim().slice(0, 40)}`
      ).toBeLessThanOrEqual(1);
    }
  });
});

describe("workflow-step partitioning", () => {
  beforeEach(() => setLocale(DEFAULT_LOCALE));

  // Skipped: `period_start`/`period_end` are currently commented out of
  // config/parameters.yaml (not needed right now), so step 1 has no
  // `step: template` parameters to render. Re-enable when they come back.
  it.skip("asks the `step: template` parameters in step 1, labelled, and not again in step 3", () => {
    const root = mountRoot();
    initApp(root);

    // Step 1 now covers both the period and the template choice.
    expect(root.querySelector("#h-step-template")!.textContent).toContain("Zeitraum und Vorlage");

    const host = root.querySelector<HTMLElement>("#template-params")!;
    const inputs = [...host.querySelectorAll("input")];
    expect(inputs.map((i) => i.name)).toEqual(["period_start", "period_end"]);
    expect(inputs.every((i) => i.type === "date")).toBe(true);

    // Prefilled from the config's `data_parameters` period, which is a
    // relative token — so this tracks the calendar rather than a fixed year.
    const lastYear = new Date().getFullYear() - 1;
    expect(inputs[0].value).toBe(`${lastYear}-01-01`);
    expect(inputs[1].value).toBe(`${lastYear}-12-31`);

    // Each field carries a real <label for>, like the step-3 fields.
    for (const input of inputs) {
      expect(host.querySelector(`label[for="${input.id}"]`), `label for ${input.id}`).not.toBeNull();
    }

    // They must not be rendered twice — duplicate names would collide on submit.
    expect(root.querySelector("#params-container [name='period_start']")).toBeNull();

    // Step 1 continues with its own Continue button; the parameter form's
    // "generate report" submit must not appear here.
    expect(host.querySelector("button[type='submit']")).toBeNull();
    expect(host.querySelector("form")).toBeNull();

    // The two date fields share one row container.
    expect(inputs[0].closest(".inline-fields")).toBe(inputs[1].closest(".inline-fields"));
  });
});
