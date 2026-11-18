/**
 * Config parsing for the `validation:` section — the `check:` condition tree
 * (leaf operators plus `and`/`or`/`not`, snake_case → camelCase) and the
 * rule-level `dataset`/`column`/`definition` fields.
 */
import { describe, it, expect } from "vitest";
import { parseConfig } from "../../src/modules/config";

describe("parseConfig — validation", () => {
  it("parses the StMAS-style or/and/empty check tree", () => {
    const yaml = `
validation:
  rules:
    - dataset: Stichtag
      column: "Entgeltgruppe / Besoldungsgruppe"
      definition: "Muss mit A/B/E/R/W beginnen und mit einer Ziffer enden, oder leer sein."
      check:
        or:
          - and:
              - starts_with: [A, B, R, W, E]
              - ends_with: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
          - empty: true
`;
    const config = parseConfig(yaml);
    expect(config.validation?.rules).toHaveLength(1);
    const rule = config.validation!.rules![0];
    expect(rule.dataset).toBe("Stichtag");
    expect(rule.column).toBe("Entgeltgruppe / Besoldungsgruppe");
    expect(rule.definition).toContain("A/B/E/R/W");
    expect(rule.check.or).toHaveLength(2);
    expect(rule.check.or![0].and).toHaveLength(2);
    expect(rule.check.or![0].and![0].startsWith).toEqual(["A", "B", "R", "W", "E"]);
    expect(rule.check.or![1].empty).toBe(true);
  });

  it("parses `not`", () => {
    const yaml = `
validation:
  rules:
    - dataset: Stichtag
      column: Geschlecht
      check:
        not:
          equals: ""
`;
    const config = parseConfig(yaml);
    expect(config.validation?.rules?.[0].check.not?.equals).toBe("");
  });

  it("a rule with no dataset/column/check is dropped", () => {
    const yaml = `
validation:
  rules:
    - dataset: Stichtag
      column: X
`;
    const config = parseConfig(yaml);
    expect(config.validation).toBeUndefined();
  });

  it("no validation section → undefined", () => {
    expect(parseConfig("parameters: {}").validation).toBeUndefined();
  });
});
