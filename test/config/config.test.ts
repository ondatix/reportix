/**
 * Config-module tests — splitting parameters across the workflow steps and
 * parsing the `data_parameters:` section (including its legacy name).
 */
import { describe, it, expect } from "vitest";
import { parseConfigObject, parametersForStep } from "../../src/modules/config";

describe("parametersForStep", () => {
  const params = {
    period_start: { label: "von", type: "date" as const, step: "template" as const },
    title: { label: "Titel", type: "text" as const },
    font: { label: "Schrift", type: "select" as const, step: "parameters" as const },
  };

  it("splits the parameters into the two workflow steps", () => {
    expect(Object.keys(parametersForStep(params, "template"))).toEqual(["period_start"]);
    expect(Object.keys(parametersForStep(params, "parameters"))).toEqual(["title", "font"]);
  });

  it("defaults an entry without `step` to the parameters step", () => {
    expect(parametersForStep(params, "parameters").title).toBeDefined();
  });

  it("preserves the config file's order", () => {
    const many = { a: params.title, b: params.font, c: params.title };
    expect(Object.keys(parametersForStep(many, "parameters"))).toEqual(["a", "b", "c"]);
  });
});

describe("data_parameters", () => {
  it("resolves a relative period token and reads the legacy section name", () => {
    const modern = parseConfigObject({ data_parameters: { smallest_group: 3, period_start: "last_year_start" } });
    expect(modern.dataParameters?.smallestGroup).toBe(3);
    expect(modern.dataParameters?.periodStart).toMatch(/^\d{4}-01-01$/);

    const legacy = parseConfigObject({ data_protection: { smallest_group: 7 } });
    expect(legacy.dataParameters?.smallestGroup).toBe(7);
  });

  it("parses category_order into a column → value-list map", () => {
    const parsed = parseConfigObject({
      data_parameters: {
        category_order: {
          Geschlecht: ["männlich", "weiblich"],
          Arbeitszeitanteil: ["40", "50", "100"],
        },
      },
    });
    expect(parsed.dataParameters?.categoryOrder).toEqual({
      Geschlecht: ["männlich", "weiblich"],
      Arbeitszeitanteil: ["40", "50", "100"],
    });
  });

  it("ignores a malformed category_order without throwing", () => {
    expect(() => parseConfigObject({ data_parameters: { category_order: "not-a-map" } })).not.toThrow();
    const parsed = parseConfigObject({ data_parameters: { category_order: { Geschlecht: "not-a-list" } } });
    expect(parsed.dataParameters?.categoryOrder).toBeUndefined();
  });
});
