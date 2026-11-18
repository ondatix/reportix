/**
 * @vitest-environment jsdom
 *
 * Accessibility of the workflow *with data*: the states `app.test.ts` never
 * reaches because it continues without an upload — the step-3 checklists
 * (built from uploaded values), the upload error slot, the rendered report
 * preview — plus the behaviour axe cannot judge: where focus lands, how the
 * ⓘ disclosure responds to mouse and keyboard, that live regions are never
 * hidden, and that the English UI is as clean as the German one.
 *
 * Charts: jsdom has no 2D canvas context, so Chart.js declines to draw (and
 * logs that it could not acquire one). The <figure>/<canvas>/<figcaption>
 * markup `renderChart` builds around it is still there, and that markup is
 * what a screen reader — and the DOCX exporter — consume.
 */
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { initApp } from "../../src/app";
import { setLocale, DEFAULT_LOCALE } from "../../src/modules/i18n";
import {
  expectNoViolations,
  mountRoot,
  goToDataStep,
  continueFromData,
  continueFromValidation,
  pickFile,
  uploadFixture,
} from "./helpers";

/**
 * Headroom for the suites that upload the fixture, render the report and run
 * axe over it: ~1–2.5 s locally, but CI runners are several times slower and
 * the 5 s default is not a budget these were designed against.
 */
const FLOW_TIMEOUT = 20_000;

/** Silence the canvas noise: jsdom's "not implemented" and Chart.js's follow-up. */
function muteCanvas(): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
}

function heading(root: HTMLElement, stepId: string): HTMLElement {
  return root.querySelector<HTMLElement>(`#${stepId} > h2`)!;
}

/** Template → data → upload fixture → validation step. */
async function goToValidationWithData(root: HTMLElement): Promise<void> {
  goToDataStep(root);
  await uploadFixture(root);
  continueFromData(root);
}

/** …→ parameters → submit, rendering the report preview. */
async function goToPreview(root: HTMLElement): Promise<void> {
  await goToValidationWithData(root);
  continueFromValidation(root);
  root.querySelector<HTMLFormElement>("#params-container form")!.requestSubmit();
}

describe("workflow with uploaded data", { timeout: FLOW_TIMEOUT }, () => {
  let root: HTMLElement;

  beforeEach(() => {
    setLocale(DEFAULT_LOCALE);
    muteCanvas();
    root = mountRoot();
    initApp(root);
  });

  afterEach(() => vi.restoreAllMocks());

  it("moves focus to the data step and keeps the mapped state clean", async () => {
    goToDataStep(root);
    expect(document.activeElement).toBe(heading(root, "step-data"));
    await uploadFixture(root);
    await expectNoViolations(root);
  });

  it("renders the step-3 checklists as named groups of labelled checkboxes", async () => {
    await goToValidationWithData(root);
    expect(document.activeElement).toBe(heading(root, "step-validation"));

    const groups = root.querySelectorAll<HTMLFieldSetElement>("fieldset.data-checklist");
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      const legend = group.querySelector(":scope > legend");
      expect(legend?.textContent?.trim(), "checklist without a legend").toBeTruthy();
      const boxes = group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        // Wrapped or for/id — either way the browser must resolve a label.
        expect(box.labels?.length, `checkbox ${box.value} has no label`).toBe(1);
        expect(box.labels![0].textContent!.trim()).not.toBe("");
      }
    }
    await expectNoViolations(root);
  });

  it("updates the warnings live region in place when a checklist changes", async () => {
    await goToValidationWithData(root);
    const region = root.querySelector<HTMLElement>(".data-warnings")!;
    expect(region.getAttribute("role")).toBe("status");

    const box = root.querySelector<HTMLInputElement>("fieldset.data-checklist input[type='checkbox']")!;
    box.click();

    // Same node, still attached and never toggled with `hidden` — a region
    // that is replaced or hidden while its content changes goes unannounced.
    expect(root.querySelector(".data-warnings")).toBe(region);
    expect(region.hidden).toBe(false);
    expect(region.closest("[hidden]")).toBeNull();
  });

  it("moves focus to the parameters step", async () => {
    await goToValidationWithData(root);
    continueFromValidation(root);
    expect(document.activeElement).toBe(heading(root, "step-params"));
  });

  it("renders the report preview without violations and focuses its heading", async () => {
    await goToPreview(root);
    const step = root.querySelector<HTMLElement>("#step-preview")!;
    expect(step.hidden).toBe(false);
    expect(document.activeElement).toBe(heading(root, "step-preview"));
    expect(root.querySelector("#report-preview")!.children.length).toBeGreaterThan(0);
    await expectNoViolations(step);
  });

  it("gives every chart an image role, its alt text, a language and a caption", async () => {
    await goToPreview(root);
    const figures = root.querySelectorAll<HTMLElement>("#report-preview figure");
    expect(figures.length).toBeGreaterThan(0);
    for (const figure of figures) {
      const canvas = figure.querySelector("canvas")!;
      expect(canvas.getAttribute("role")).toBe("img");
      expect(canvas.getAttribute("aria-label")?.trim(), "chart without alt text").toBeTruthy();
      expect(canvas.getAttribute("lang")).toBeTruthy();
      expect(figure.querySelector("figcaption")?.textContent?.trim(), "chart without caption").toBeTruthy();
    }
  });

  it("keeps every focusable element in the natural tab order", async () => {
    await goToPreview(root);
    // A positive tabindex reorders the page for keyboard users only.
    const positive = [...root.querySelectorAll<HTMLElement>("[tabindex]")].filter(
      (el) => Number(el.getAttribute("tabindex")) > 0
    );
    expect(positive.map((el) => el.outerHTML.slice(0, 60))).toEqual([]);
  });
});

describe("upload errors", () => {
  let root: HTMLElement;

  beforeEach(() => {
    setLocale(DEFAULT_LOCALE);
    root = mountRoot();
    initApp(root);
    goToDataStep(root);
  });

  async function rejectedWith(file: File): Promise<HTMLElement> {
    const input = root.querySelector<HTMLInputElement>('.data-mapping input[type="file"]')!;
    pickFile(input, file);
    const slot = input.closest("label")!.parentElement!.querySelector<HTMLElement>(".upload-error")!;
    await vi.waitFor(() => expect(slot.textContent).not.toBe(""));
    return slot;
  }

  it("announces a wrong file type in an alert next to the input", async () => {
    const slot = await rejectedWith(new File(["a,b"], "daten.txt"));
    expect(slot.getAttribute("role")).toBe("alert");
    expect(slot.hidden).toBe(false);
    await expectNoViolations(root);
  });

  it("announces a corrupt workbook the same way", async () => {
    const slot = await rejectedWith(new File([new Uint8Array([1, 2, 3, 4])], "kaputt.xlsx"));
    expect(slot.getAttribute("role")).toBe("alert");
    expect(slot.textContent).toContain("kaputt.xlsx");
  });

  it("announces an empty workbook the same way", async () => {
    const slot = await rejectedWith(new File([], "leer.xlsx"));
    expect(slot.getAttribute("role")).toBe("alert");
    expect(slot.textContent).toContain("leer.xlsx");
  });
});

describe("English UI", { timeout: FLOW_TIMEOUT }, () => {
  let root: HTMLElement;

  beforeEach(() => {
    setLocale("en");
    muteCanvas();
    root = mountRoot();
    initApp(root);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLocale(DEFAULT_LOCALE);
  });

  it("declares the language and has no violations on the template step", async () => {
    expect(document.documentElement.lang).toBe("en");
    await expectNoViolations(root);
  });

  it("has no violations through to the preview", async () => {
    await goToValidationWithData(root);
    await expectNoViolations(root);
    // From here on, scan only the step just revealed: the earlier ones were
    // covered above and do not change, and re-scanning the mapping step's
    // hundreds of selects each time pushed this past the timeout on CI.
    continueFromValidation(root);
    await expectNoViolations(root.querySelector("#step-params")!);
    root.querySelector<HTMLFormElement>("#params-container form")!.requestSubmit();
    // The report body stays German (the templates are German-only) and says so.
    expect(root.querySelector("#report-preview")!.getAttribute("lang")).toBe("de");
    await expectNoViolations(root.querySelector("#step-preview")!);
  });
});

describe("info disclosure", () => {
  let root: HTMLElement;
  let triggers: HTMLButtonElement[];

  const popupOf = (trigger: HTMLElement) =>
    document.getElementById(trigger.getAttribute("aria-controls")!)!;

  beforeEach(() => {
    setLocale(DEFAULT_LOCALE);
    root = mountRoot();
    initApp(root);
    goToDataStep(root);
    triggers = [...root.querySelectorAll<HTMLButtonElement>(".info-trigger")];
    expect(triggers.length).toBeGreaterThan(1);
  });

  it("is a native button, so Enter and Space work without extra handlers", () => {
    for (const trigger of triggers) {
      expect(trigger.tagName).toBe("BUTTON");
      expect(trigger.type).toBe("button");
    }
  });

  it("toggles open and closed, reflected in aria-expanded", () => {
    const [trigger] = triggers;
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popupOf(trigger).hidden).toBe(false);
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popupOf(trigger).hidden).toBe(true);
  });

  it("closes on Escape and leaves focus on the trigger", () => {
    const [trigger] = triggers;
    trigger.focus();
    trigger.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popupOf(trigger).hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on a click outside", () => {
    const [trigger] = triggers;
    trigger.click();
    document.body.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps only one popup open at a time", () => {
    const [first, second] = triggers;
    first.click();
    second.click();
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(popupOf(first).hidden).toBe(true);
    expect(second.getAttribute("aria-expanded")).toBe("true");
  });
});
