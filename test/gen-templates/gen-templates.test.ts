/**
 * Generator tests — the question catalog → markdown assembly in
 * scripts/gen-templates-lib.ts: include filtering, section skipping and the
 * automatic Fazit, source-line formatting, default freetext, appendix
 * tables, placeholder substitution, catalog validation, and a round-trip
 * (generated markdown → template parser → specs equal the catalog).
 * Plus a smoke run against the real config/template.yaml + templates/master.md.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYAML } from "yaml";
import {
  type CatalogEntry,
  type DefinitionLookup,
  DEFAULT_FREETEXT,
  buildDefinitionLookup,
  renderAppendixTables,
  renderDefinitions,
  renderQuestionBlock,
  renderQuestions,
  renderTemplate,
  segmentMaster,
  validateCatalog,
} from "../../scripts/gen-templates-lib";
import { parseTemplate } from "../../src/modules/template";
import type { ChartBlock, TableBlock } from "../../src/modules/types";

const ROOT = resolve(__dirname, "../..");

const lookup: DefinitionLookup = new Map([
  ["Geschlecht", "Geschlecht der Person"],
  ["X-Spalte", "nur full."],
]);

const catalog: CatalogEntry[] = [
  {
    section: "Gesamtübersicht",
    definitions: ["Geschlecht"],
  },
  {
    title: "Wie viele Männer und Frauen arbeiten bei uns?",
    datenquelle: "Personalverwaltungssystem",
    personenkreis: "Alle",
    caption: "Verteilung nach Geschlecht.",
    table: {
      data: "Stichtag",
      groupby: { rows: "Geschlecht" },
      aggregation: "share_total",
    },
    chart: { type: "pie", title: "Geschlechterverteilung" },
  },
  {
    title: "Nur im vollständigen Konzept?",
    include: "full",
    comment: "Optional",
    datenquelle: "Personalverwaltungssystem",
    personenkreis: "Tarifbeschäftigte",
    caption: "Volle Frage.",
    table: {
      data: "Stichtag",
      filter: "Tarifbeschäftigte",
      groupby: { rows: "Befristet / Unbefristet", cols: "Geschlecht" },
      aggregation: "count",
    },
    chart: { type: "bar", stacked: true, title: "Befristet vs. unbefristet" },
  },
  { section: "Nur-Voll-Sektion", definitions: [{ term: "X", ref: "X-Spalte" }] },
  {
    title: "Zweite volle Frage?",
    include: ["full"],
    datenquelle: "Personalverwaltungssystem",
    personenkreis: "Alle",
    caption: "Noch eine.",
    text: "Eigener Text statt Platzhalter.",
    table: {
      data: "Stichtag",
      groupby: { rows: "QE", cols: "Geschlecht" },
      aggregation: "mean",
      value: "Gehalt",
    },
    chart: { type: "pyramid", title: "Ø Gehalt je QE" },
  },
];

describe("renderQuestionBlock", () => {
  it("emits heading, status line, source blockquote, chart block, and freetext", () => {
    const md = renderQuestionBlock(catalog[2] as any);
    expect(md).toContain("#### Nur im vollständigen Konzept?\n_Optional_");
    expect(md).toContain(
      "> Datenquelle: Personalverwaltungssystem · Personenkreis: Tarifbeschäftigte · Datensatz: Stichtag"
    );
    expect(md).toContain("```chart");
    expect(md).toContain("stacked: true");
    expect(md.trimEnd().endsWith(DEFAULT_FREETEXT)).toBe(true);
  });

  it("uses the question text when provided", () => {
    const md = renderQuestionBlock(catalog[4] as any);
    expect(md).toContain("Eigener Text statt Platzhalter.");
    expect(md).not.toContain(DEFAULT_FREETEXT);
  });
});

describe("renderQuestions — include filtering, sections, Fazit", () => {
  it("full template contains every question and both sections", () => {
    const md = renderQuestions(catalog, "full", lookup);
    expect(md).toContain("### Gesamtübersicht");
    expect(md).toContain("### Nur-Voll-Sektion");
    expect((md.match(/^#### /gm) ?? []).length).toBe(3);
    expect((md.match(/callout-tip title='Fazit'/g) ?? []).length).toBe(2);
    // Fazit comes after the section's last question.
    expect(md.indexOf("Fazit")).toBeGreaterThan(md.indexOf("Nur im vollständigen Konzept"));
  });

  it("mandatory template drops full-only questions and skips empty sections entirely", () => {
    const md = renderQuestions(catalog, "mandatory", lookup);
    expect((md.match(/^#### /gm) ?? []).length).toBe(1);
    expect(md).toContain("### Gesamtübersicht");
    expect(md).not.toContain("Nur-Voll-Sektion");
    expect((md.match(/callout-tip title='Fazit'/g) ?? []).length).toBe(1);
  });

  it("section definitions render as a Definitionen callout", () => {
    const md = renderQuestions(catalog, "mandatory", lookup);
    expect(md).toContain("::: {.callout-note title='Definitionen'}");
    expect(md).toContain("**Geschlecht**: Geschlecht der Person");
  });
});

describe("renderAppendixTables", () => {
  it("emits one table block per included question with the shared caption", () => {
    const md = renderAppendixTables(catalog, "mandatory");
    expect((md.match(/^```table$/gm) ?? []).length).toBe(1);
    expect(md).toContain("##### Wie viele Männer und Frauen arbeiten bei uns?");
    expect(md).toContain("caption: Verteilung nach Geschlecht.");
    expect(md).not.toContain("Volle Frage");
  });

  it("groups the tables under their section headings, skipping empty sections", () => {
    const full = renderAppendixTables(catalog, "full");
    expect(full.indexOf("#### Gesamtübersicht")).toBeLessThan(full.indexOf("##### Wie viele"));
    expect(full.indexOf("#### Nur-Voll-Sektion")).toBeLessThan(full.indexOf("##### Zweite volle Frage?"));
    expect(full).not.toContain("Definitionen");
    expect(full).not.toContain("Fazit");
    const mandatory = renderAppendixTables(catalog, "mandatory");
    expect(mandatory).toContain("#### Gesamtübersicht");
    expect(mandatory).not.toContain("Nur-Voll-Sektion");
  });
});

describe("renderTemplate — placeholder substitution", () => {
  const master = [
    "# {{title}}",
    "",
    "## Situationsbeschreibung",
    "",
    "{{questions}}",
    "",
    "<!-- include: full -->",
    "Nur-Voll-Prosa.",
    "<!-- /include -->",
    "",
    "## Anhang",
    "",
    "### Tabellen",
    "",
    "{{tables}}",
  ].join("\n");

  it("substitutes both placeholders and keeps runtime placeholders untouched", () => {
    const md = renderTemplate(segmentMaster(master), catalog, "mandatory", lookup);
    expect(md).toContain("# {{title}}");
    expect(md).not.toContain("{{questions}}");
    expect(md).not.toContain("{{tables}}");
    expect(md).not.toContain("Nur-Voll-Prosa");
    expect(md).toContain("```chart");
    expect(md).toContain("```table");
  });

  it("throws when a placeholder is missing from the master", () => {
    expect(() => renderTemplate(segmentMaster("# nix"), catalog, "full", lookup)).toThrow(
      /\{\{questions\}\}/
    );
  });
});

describe("round-trip — generated markdown parses back into the catalog specs", () => {
  it("chart and table blocks survive YAML quoting of German column names", () => {
    const master = "{{questions}}\n\n{{tables}}";
    const md = renderTemplate(segmentMaster(master), catalog, "full", lookup);
    const blocks = parseTemplate(md);

    const charts = blocks.filter((b): b is ChartBlock => b.type === "chart");
    const tables = blocks.filter((b): b is TableBlock => b.type === "table");
    expect(charts).toHaveLength(3);
    expect(tables).toHaveLength(3);

    const q = catalog[2] as any;
    const chart = charts[1].spec as any;
    expect(chart.type).toBe("bar");
    expect(chart.stacked).toBe(true);
    expect(chart.table).toEqual({
      data: "Stichtag",
      filter: "Tarifbeschäftigte",
      groupby: { rows: "Befristet / Unbefristet", cols: "Geschlecht" },
      aggregation: "count",
    });
    expect(chart.caption).toBe(q.caption);

    const table = tables[1].spec as any;
    expect(table.groupby).toEqual(q.table.groupby);
    expect(table.caption).toBe(q.caption);

    // value-op question keeps its value column verbatim
    expect((charts[2].spec as any).table.value).toBe("Gehalt");
  });
});

describe("validateCatalog", () => {
  const known = new Set(["full", "mandatory"]);

  it("accepts the fixture without warnings", () => {
    expect(validateCatalog(catalog, known)).toEqual([]);
  });

  it("throws on an entry that is neither section nor question", () => {
    expect(() => validateCatalog([{ foo: 1 } as any], known)).toThrow(/exactly one/);
  });

  it("throws on a value-op without value", () => {
    const bad: CatalogEntry[] = [
      { title: "x", table: { data: "d", groupby: { rows: "r" }, aggregation: "mean" } } as any,
    ];
    expect(() => validateCatalog(bad, known)).toThrow(/requires `table.value`/);
  });

  it("warns on unknown include ids and superfluous value", () => {
    const iffy: CatalogEntry[] = [
      {
        title: "x",
        include: "fulll",
        table: { data: "d", groupby: { rows: "r" }, aggregation: "count", value: "v" },
      } as any,
    ];
    const warnings = validateCatalog(iffy, known);
    expect(warnings.some((w) => w.includes('unknown template id "fulll"'))).toBe(true);
    expect(warnings.some((w) => w.includes("ignores `table.value`"))).toBe(true);
  });
});

describe("buildDefinitionLookup / renderDefinitions", () => {
  const raw = {
    data: {
      Quelle: {
        sheets: [
          {
            sheet: "Blatt",
            definition: "Blattdefinition.",
            columns: ["plain", { column: "Spalte", definition: "Spaltendefinition." }],
          },
        ],
      },
    },
    preprocessing: {
      mutations: [{ column: "Abgeleitet", definition: "Mutationsdefinition." }],
    },
  };
  const built = buildDefinitionLookup(raw as any);

  it("indexes columns, mutations, and sheets (columns win)", () => {
    expect(built.get("Spalte")).toBe("Spaltendefinition.");
    expect(built.get("Abgeleitet")).toBe("Mutationsdefinition.");
    expect(built.get("Blatt")).toBe("Blattdefinition.");
    expect(built.has("plain")).toBe(false); // string column has no definition
  });

  it("renders string, {term,ref}, and {term,text} entries", () => {
    const md = renderDefinitions(
      ["Spalte", { term: "Anders", ref: "Abgeleitet" }, { term: "Inline", text: "Eigener Text." }],
      built
    );
    expect(md).toBe(
      "**Spalte**: Spaltendefinition.\n\n**Anders**: Mutationsdefinition.\n\n**Inline**: Eigener Text."
    );
  });

  it("throws on a dangling ref", () => {
    expect(() => renderDefinitions(["Nicht da"], built)).toThrow(/no data\.yaml definition/);
  });
});

describe("real catalog + real master (smoke)", () => {
  const master = readFileSync(resolve(ROOT, "templates/master.md"), "utf8");
  const config = parseYAML(readFileSync(resolve(ROOT, "config/template.yaml"), "utf8"));
  const entries: CatalogEntry[] = config.template.questions;
  const segments = segmentMaster(master);
  const realLookup = buildDefinitionLookup(
    parseYAML(readFileSync(resolve(ROOT, "config/data.yaml"), "utf8"))
  );

  it("validates without warnings", () => {
    expect(validateCatalog(entries, new Set(["full", "mandatory"]))).toEqual([]);
  });

  it("every section definition reference resolves against data.yaml", () => {
    // renderQuestions throws on a dangling ref — this is the guard.
    expect(() => renderQuestions(entries, "full", realLookup)).not.toThrow();
  });

  it("full = 21 questions + 21 appendix tables; mandatory = 10 + 10", () => {
    const full = renderTemplate(segments, entries, "full", realLookup);
    const mandatory = renderTemplate(segments, entries, "mandatory", realLookup);
    expect((full.match(/^```chart$/gm) ?? []).length).toBe(21);
    expect((full.match(/^```table$/gm) ?? []).length).toBe(21);
    expect((mandatory.match(/^```chart$/gm) ?? []).length).toBe(10);
    expect((mandatory.match(/^```table$/gm) ?? []).length).toBe(10);
    for (const out of [full, mandatory]) {
      expect(out).not.toContain("{{questions}}");
      expect(out).not.toContain("{{tables}}");
      expect(out).toContain("{{title}}"); // runtime placeholder survives
    }
  });

  it("every generated block parses and references a groupby", () => {
    const blocks = parseTemplate(renderTemplate(segments, entries, "full", realLookup));
    const specs = blocks.filter((b) => b.type !== "text") as (ChartBlock | TableBlock)[];
    expect(specs.length).toBe(42);
    for (const b of specs) {
      const table = b.type === "chart" ? (b.spec as any).table : (b.spec as any);
      expect(table.data).toBeTruthy();
      // `groupby.rows` is optional (omitting it collapses the crosstab into
      // one total row) but every real question still names at least one axis.
      expect(table.groupby?.rows || table.groupby?.cols).toBeTruthy();
    }
  });
});
