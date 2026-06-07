/**
 * Exporter module — serializes the rendered HTML report to a .docx file.
 * Applies all ExportConfig settings: metadata, fonts, heading styles,
 * paragraph spacing, page layout, headers/footers, page numbers, table defaults.
 * Usable independently in other projects.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  PageNumber,
  PageOrientation,
  NumberFormat,
  LineRuleType,
  ShadingType,
  TableOfContents,
  LevelFormat,
  convertMillimetersToTwip,
} from "docx";
import type { INumberingOptions } from "docx";
import { saveAs } from "file-saver";
import { t } from "../i18n";
import type { ExportConfig, CalloutBoxConfig } from "../types";

// ── Defaults ────────────────────────────────────────────────────────

const MM25 = convertMillimetersToTwip(25);

interface ResolvedSettings {
  filename: string;
  locale: string;
  // metadata
  title: string;
  subject: string;
  creator: string;
  description: string;
  keywords: string;
  // font
  fontFamily: string;
  fontSize: number;        // half-points
  headingFamily: string;
  fontColor: string;       // hex without #
  // headings
  headingColor: string;
  h1Size: number;          // half-points
  h2Size: number;
  h3Size: number;
  h4Size: number;
  // paragraph
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType];
  spacingBefore: number;   // twips
  spacingAfter: number;
  lineSpacing: number;
  // page
  orientation: (typeof PageOrientation)[keyof typeof PageOrientation];
  pageWidth: number;       // twips
  pageHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  marginHeader: number;
  marginFooter: number;
  // page numbers
  showPageNumbers: boolean;
  pageNumberStart: number;
  pageNumberFormat: (typeof NumberFormat)[keyof typeof NumberFormat];
  // header / footer text
  headerText: string;
  footerText: string;
  // table
  tableBorderStyle: (typeof BorderStyle)[keyof typeof BorderStyle];
  tableBorderColor: string;
  tableBorderSize: number;
  tableCellPadding: number;
  // structure
  sectionNumbering: boolean;
  toc: boolean;
  // Callout box overrides (per-class).
  definitionBox?: CalloutBoxConfig;
  summaryBox?: CalloutBoxConfig;
}

/** Reference id used to bind the multilevel numbering scheme to heading styles. */
const HEADING_NUMBERING_REF = "heading-numbering";

function pt(points: number): number {
  return points * 2; // pt → half-points
}

function resolveAlignment(value?: string): (typeof AlignmentType)[keyof typeof AlignmentType] {
  const map: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
    justify: AlignmentType.BOTH,
  };
  return map[value ?? "left"] ?? AlignmentType.LEFT;
}

function resolvePageNumberFormat(value?: string): (typeof NumberFormat)[keyof typeof NumberFormat] {
  const map: Record<string, (typeof NumberFormat)[keyof typeof NumberFormat]> = {
    decimal: NumberFormat.DECIMAL,
    upperRoman: NumberFormat.UPPER_ROMAN,
    lowerRoman: NumberFormat.LOWER_ROMAN,
    upperLetter: NumberFormat.UPPER_LETTER,
    lowerLetter: NumberFormat.LOWER_LETTER,
  };
  return map[value ?? "decimal"] ?? NumberFormat.DECIMAL;
}

function resolveBorderStyle(value?: string): (typeof BorderStyle)[keyof typeof BorderStyle] {
  const map: Record<string, (typeof BorderStyle)[keyof typeof BorderStyle]> = {
    single: BorderStyle.SINGLE,
    double: BorderStyle.DOUBLE,
    dashed: BorderStyle.DASHED,
    dotted: BorderStyle.DOTTED,
    thick: BorderStyle.THICK,
    none: BorderStyle.NONE,
  };
  return map[value ?? "single"] ?? BorderStyle.SINGLE;
}

function resolveSettings(c?: ExportConfig): ResolvedSettings {
  const isLandscape = c?.page?.orientation === "landscape";
  const defaultWidth = isLandscape
    ? convertMillimetersToTwip(297)
    : convertMillimetersToTwip(210);
  const defaultHeight = isLandscape
    ? convertMillimetersToTwip(210)
    : convertMillimetersToTwip(297);

  return {
    filename: c?.filename ?? "report.docx",
    locale: c?.locale ?? "en-US",
    title: c?.document?.title ?? "",
    subject: c?.document?.subject ?? "",
    creator: c?.document?.creator ?? "",
    description: c?.document?.description ?? "",
    keywords: c?.document?.keywords ?? "",
    fontFamily: c?.font?.family ?? "Arial",
    fontSize: pt(c?.font?.size ?? 11),
    headingFamily: c?.font?.headingFamily ?? c?.font?.family ?? "Arial",
    fontColor: c?.font?.color ?? "000000",
    headingColor: c?.headings?.color ?? "000000",
    h1Size: pt(c?.headings?.h1Size ?? 20),
    h2Size: pt(c?.headings?.h2Size ?? 16),
    h3Size: pt(c?.headings?.h3Size ?? 13),
    h4Size: pt(c?.headings?.h4Size ?? 12),
    alignment: resolveAlignment(c?.paragraph?.alignment),
    spacingBefore: c?.paragraph?.spacingBefore ?? 0,
    spacingAfter: c?.paragraph?.spacingAfter ?? 120,
    lineSpacing: c?.paragraph?.lineSpacing ?? 276,
    orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
    pageWidth: c?.page?.width ?? defaultWidth,
    pageHeight: c?.page?.height ?? defaultHeight,
    marginTop: c?.page?.margin?.top ?? MM25,
    marginRight: c?.page?.margin?.right ?? MM25,
    marginBottom: c?.page?.margin?.bottom ?? MM25,
    marginLeft: c?.page?.margin?.left ?? MM25,
    marginHeader: c?.page?.margin?.header ?? convertMillimetersToTwip(12),
    marginFooter: c?.page?.margin?.footer ?? convertMillimetersToTwip(12),
    showPageNumbers: c?.pageNumbers?.show ?? true,
    pageNumberStart: c?.pageNumbers?.start ?? 1,
    pageNumberFormat: resolvePageNumberFormat(c?.pageNumbers?.format),
    headerText: c?.header?.text ?? "",
    footerText: c?.footer?.text ?? "",
    tableBorderStyle: resolveBorderStyle(c?.table?.borderStyle),
    tableBorderColor: c?.table?.borderColor ?? "999999",
    tableBorderSize: c?.table?.borderSize ?? 4,
    tableCellPadding: c?.table?.cellPadding ?? 80,
    sectionNumbering: c?.sectionNumbering ?? false,
    toc: c?.toc ?? false,
    definitionBox: c?.definitionBox,
    summaryBox: c?.summaryBox,
  };
}

/**
 * Multilevel decimal numbering applied to heading1..4 when section_numbering
 * is enabled. `text: "%1."` numbers H1 as "1.", H2 as "1.1.", etc.
 */
function buildHeadingNumbering(): INumberingOptions {
  return {
    config: [
      {
        reference: HEADING_NUMBERING_REF,
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT },
          { level: 1, format: LevelFormat.DECIMAL, text: "%1.%2.", alignment: AlignmentType.LEFT },
          { level: 2, format: LevelFormat.DECIMAL, text: "%1.%2.%3.", alignment: AlignmentType.LEFT },
          { level: 3, format: LevelFormat.DECIMAL, text: "%1.%2.%3.%4.", alignment: AlignmentType.LEFT },
        ],
      },
    ],
  };
}

function headingNumberingProp(level: number): {
  numbering: { reference: string; level: number };
} {
  return { numbering: { reference: HEADING_NUMBERING_REF, level } };
}

// ── Public API ───────────────────────────────────────────────────────

export async function exportToDocx(
  container: HTMLElement,
  config?: ExportConfig
): Promise<void> {
  const s = resolveSettings(config);
  const bodyChildren = convertChildren(container, s);
  const sectionChildren: (Paragraph | Table | TableOfContents)[] = [];

  if (s.toc) {
    sectionChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: t("export.toc"), font: s.headingFamily })],
      }),
      new TableOfContents(t("export.toc"), {
        hyperlink: true,
        headingStyleRange: "1-4",
      }),
      new Paragraph({ children: [new TextRun({ text: "", break: 1 })] })
    );
  }
  sectionChildren.push(...bodyChildren);

  // When section numbering is on, bind heading styles to a multilevel
  // numbering ref so Word renders "1.", "1.1.", etc. automatically.
  const numberingClause = s.sectionNumbering
    ? { paragraph: { ...headingNumberingProp(0) } }
    : {};
  const heading2Numbering = s.sectionNumbering ? headingNumberingProp(1) : {};
  const heading3Numbering = s.sectionNumbering ? headingNumberingProp(2) : {};
  const heading4Numbering = s.sectionNumbering ? headingNumberingProp(3) : {};

  const doc = new Document({
    title: s.title,
    subject: s.subject,
    creator: s.creator,
    description: s.description,
    keywords: s.keywords,

    numbering: s.sectionNumbering ? buildHeadingNumbering() : undefined,

    styles: {
      default: {
        document: {
          run: {
            font: s.fontFamily,
            size: s.fontSize,
            color: s.fontColor,
          },
          paragraph: {
            alignment: s.alignment,
            spacing: {
              before: s.spacingBefore,
              after: s.spacingAfter,
              line: s.lineSpacing,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
        heading1: {
          run: { font: s.headingFamily, size: s.h1Size, color: s.headingColor, bold: true },
          paragraph: { spacing: { before: 240, after: 120 }, ...numberingClause.paragraph },
        },
        heading2: {
          run: { font: s.headingFamily, size: s.h2Size, color: s.headingColor, bold: true },
          paragraph: { spacing: { before: 200, after: 80 }, ...heading2Numbering },
        },
        heading3: {
          run: { font: s.headingFamily, size: s.h3Size, color: s.headingColor, bold: true },
          paragraph: { spacing: { before: 160, after: 60 }, ...heading3Numbering },
        },
        heading4: {
          run: { font: s.headingFamily, size: s.h4Size, color: s.headingColor, bold: true },
          paragraph: { spacing: { before: 120, after: 40 }, ...heading4Numbering },
        },
      },
    },

    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: s.orientation,
              width: s.pageWidth,
              height: s.pageHeight,
            },
            margin: {
              top: s.marginTop,
              right: s.marginRight,
              bottom: s.marginBottom,
              left: s.marginLeft,
              header: s.marginHeader,
              footer: s.marginFooter,
            },
            pageNumbers: {
              start: s.pageNumberStart,
              formatType: s.pageNumberFormat,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: s.headerText
                  ? [new TextRun({ text: s.headerText, font: s.fontFamily, size: s.fontSize })]
                  : [],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [buildFooter(s)],
          }),
        },
        children: sectionChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, s.filename);
}

// ── Footer ───────────────────────────────────────────────────────────

function buildFooter(s: ResolvedSettings): Paragraph {
  const runs: TextRun[] = [];

  if (s.footerText) {
    runs.push(new TextRun({ text: s.footerText + "    ", font: s.fontFamily, size: s.fontSize }));
  }

  if (s.showPageNumbers) {
    runs.push(
      new TextRun({ children: [PageNumber.CURRENT], font: s.fontFamily, size: s.fontSize }),
      new TextRun({ text: " / ", font: s.fontFamily, size: s.fontSize }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: s.fontFamily, size: s.fontSize })
    );
  }

  return new Paragraph({
    children: runs,
    alignment: (!s.footerText && s.showPageNumbers) ? AlignmentType.CENTER : AlignmentType.LEFT,
  });
}

// ── DOM → docx conversion ─────────────────────────────────────────────

type DocxChild = Paragraph | Table;

function convertChildren(el: HTMLElement, s: ResolvedSettings): DocxChild[] {
  const result: DocxChild[] = [];

  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        result.push(
          new Paragraph({ children: [new TextRun({ text, font: s.fontFamily, size: s.fontSize, color: s.fontColor })] })
        );
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    result.push(...convertElement(node as HTMLElement, s));
  }

  return result;
}

/**
 * Convert a single block-level HTML element to one or more docx children,
 * dispatching by tag. Used by `convertChildren` and `convertCallout` so
 * block elements aren't accidentally treated as containers of paragraphs.
 */
function convertElement(child: HTMLElement, s: ResolvedSettings): DocxChild[] {
  const tag = child.tagName.toLowerCase();
  switch (tag) {
    case "h1": return [heading(child, HeadingLevel.HEADING_1, s)];
    case "h2": return [heading(child, HeadingLevel.HEADING_2, s)];
    case "h3": return [heading(child, HeadingLevel.HEADING_3, s)];
    case "h4": return [heading(child, HeadingLevel.HEADING_4, s)];
    case "h5": return [heading(child, HeadingLevel.HEADING_5, s)];
    case "h6": return [heading(child, HeadingLevel.HEADING_6, s)];
    case "p":  return [bodyParagraph(child, s)];
    case "ul":
    case "ol": return listItems(child, s);
    case "table": return [convertTable(child as HTMLTableElement, s)];
    case "figure": return convertFigure(child, s);
    case "section": return convertChildren(child, s);
    case "div":
      if (child.classList.contains("callout")) return convertCallout(child, s);
      return convertChildren(child, s);
    default: return [bodyParagraph(child, s)];
  }
}

function heading(
  el: HTMLElement,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
  s: ResolvedSettings
): Paragraph {
  return new Paragraph({
    heading: level,
    children: [new TextRun({ text: el.textContent ?? "", font: s.headingFamily })],
  });
}

function bodyParagraph(el: HTMLElement, s: ResolvedSettings): Paragraph {
  const isTbd = el.classList.contains("tbd-note") || el.classList.contains("error");
  if (isTbd) {
    return new Paragraph({
      alignment: s.alignment,
      children: [
        new TextRun({
          text: el.textContent ?? "",
          font: s.fontFamily,
          size: s.fontSize,
          color: "B71C1C",
          italics: true,
          bold: true,
        }),
      ],
    });
  }
  return new Paragraph({
    alignment: s.alignment,
    children: convertInlines(el, s),
  });
}

/**
 * Walk the inline children of `el` and emit one `TextRun` per span,
 * preserving bold (<strong>/<b>), italic (<em>/<i>), and inline code
 * (<code>) flags. Line breaks (<br>) emit an empty run with a soft break.
 * Unknown inline elements pass through with their children's runs intact.
 */
function convertInlines(
  el: Node,
  s: ResolvedSettings,
  inherited: { bold?: boolean; italics?: boolean; code?: boolean } = {}
): TextRun[] {
  const runs: TextRun[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (!text) continue;
      runs.push(
        new TextRun({
          text,
          font: inherited.code ? "Courier New" : s.fontFamily,
          size: s.fontSize,
          color: s.fontColor,
          bold: inherited.bold,
          italics: inherited.italics,
        })
      );
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as HTMLElement;
    const tag = child.tagName.toLowerCase();
    if (tag === "strong" || tag === "b") {
      runs.push(...convertInlines(child, s, { ...inherited, bold: true }));
    } else if (tag === "em" || tag === "i") {
      runs.push(...convertInlines(child, s, { ...inherited, italics: true }));
    } else if (tag === "code") {
      runs.push(...convertInlines(child, s, { ...inherited, code: true }));
    } else if (tag === "br") {
      runs.push(new TextRun({ text: "", break: 1 }));
    } else {
      runs.push(...convertInlines(child, s, inherited));
    }
  }
  return runs;
}

function listItems(el: HTMLElement, s: ResolvedSettings): Paragraph[] {
  return Array.from(el.querySelectorAll("li")).map(
    (li) =>
      new Paragraph({
        children: [
          new TextRun({
            text: `\u2022 ${li.textContent ?? ""}`,
            font: s.fontFamily,
            size: s.fontSize,
            color: s.fontColor,
          }),
        ],
      })
  );
}

/**
 * Render a callout (`<div class="callout callout-X">`) as a single-cell
 * bordered table — docx has no native callout primitive, but a 1×1 table
 * with a coloured left border reads as a styled box and respects the
 * accent colour map below.
 */
function convertCallout(el: HTMLElement, s: ResolvedSettings): DocxChild[] {
  const variant = pickCalloutVariant(el, s);
  const titleEl = el.querySelector(".callout-title");
  const titleText = titleEl?.textContent?.trim() ?? "";

  const bodyChildren: DocxChild[] = [];
  if (titleText) {
    bodyChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: titleText,
            bold: true,
            font: s.fontFamily,
            size: s.fontSize,
            color: variant.accent,
          }),
        ],
      })
    );
  }

  // Convert each block-level child of the callout (excluding the title)
  // as one docx element. Recursing into <p> children would incorrectly
  // split bold/italic spans into their own paragraphs.
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as HTMLElement;
    if (child === titleEl) continue;
    if (child.tagName.toLowerCase() === "div" && child.classList.contains("callout-title")) continue;
    bodyChildren.push(...convertElement(child, s));
  }
  // Fallback for callouts whose body is text only (no <p> wrappers).
  if (bodyChildren.length === (titleText ? 1 : 0)) {
    const text = el.textContent?.replace(titleText, "").trim();
    if (text) {
      bodyChildren.push(
        new Paragraph({
          children: [new TextRun({ text, font: s.fontFamily, size: s.fontSize, color: s.fontColor })],
        })
      );
    }
  }

  const noBorder = { style: BorderStyle.NONE, color: "FFFFFF", size: 0 };
  const accent = { style: BorderStyle.SINGLE, color: variant.accent, size: 24 }; // 24 = 3pt
  return [
    new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: { top: noBorder, right: noBorder, bottom: noBorder, left: accent },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: variant.background },
              margins: { top: 120, bottom: 120, left: 200, right: 120 },
              children: bodyChildren.length > 0 ? bodyChildren : [new Paragraph({})],
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
  ];
}

interface CalloutVariant {
  accent: string;     // left-border + title colour (hex, no #)
  background: string; // cell shading (hex, no #)
}

const CALLOUT_VARIANTS: Record<string, CalloutVariant> = {
  "callout-note":      { accent: "1F77B4", background: "EAF2FB" },
  "callout-tip":       { accent: "2CA02C", background: "EBF6EC" },
  "callout-warning":   { accent: "FF7F0E", background: "FDF1E3" },
  "callout-caution":   { accent: "D62728", background: "FBE9E9" },
  "callout-important": { accent: "9467BD", background: "F3EDF8" },
};

const GENERIC_CALLOUT: CalloutVariant = { accent: "888888", background: "F5F5F5" };

function pickCalloutVariant(el: HTMLElement, s: ResolvedSettings): CalloutVariant {
  let variantCls = "";
  for (const cls of Array.from(el.classList)) {
    if (cls in CALLOUT_VARIANTS) {
      variantCls = cls;
      break;
    }
  }
  const base = variantCls ? CALLOUT_VARIANTS[variantCls] : GENERIC_CALLOUT;

  // Config overrides: definition_box → callout-note, summary_box → callout-tip.
  let override: CalloutBoxConfig | undefined;
  if (variantCls === "callout-note") override = s.definitionBox;
  else if (variantCls === "callout-tip") override = s.summaryBox;

  if (!override) return base;

  const accent = override.color ?? base.accent;
  // `background: false` clears the fill; `true` or unset derives a pale tint
  // from the accent so the box still reads as a callout.
  const wantsBg = override.background ?? true;
  const background = wantsBg ? lighten(accent, 0.9) : "FFFFFF";
  return { accent, background };
}

/**
 * Blend a 6-digit hex colour toward white by `amount` (0 = unchanged,
 * 1 = white). Used to derive callout backgrounds from accent colours.
 */
function lighten(hex: string, amount: number): string {
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return clean;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const blend = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return toHex(blend(r)) + toHex(blend(g)) + toHex(blend(b));
}

function convertFigure(el: HTMLElement, s: ResolvedSettings): Paragraph[] {
  const result: Paragraph[] = [];
  const canvas = el.querySelector<HTMLCanvasElement>("canvas");

  if (canvas) {
    const alt = canvas.getAttribute("aria-label") ?? "";
    try {
      const bytes = dataUrlToBytes(canvas.toDataURL("image/png"));
      const { width, height } = fitToPage(canvas, s);

      result.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: "png",
              data: bytes,
              transformation: { width, height },
              altText: alt
                ? { title: alt, description: alt, name: "chart" }
                : undefined,
            }),
          ],
        })
      );
    } catch {
      // Fallback to a text placeholder if rasterisation fails (e.g. tainted canvas).
      result.push(
        new Paragraph({
          children: [
            new TextRun({
              text: alt ? `[Chart: ${alt}]` : "[Chart]",
              italics: true,
              font: s.fontFamily,
              size: s.fontSize,
            }),
          ],
        })
      );
    }
  }

  const figcaption = el.querySelector("figcaption");
  if (figcaption?.textContent) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: figcaption.textContent, italics: true, font: s.fontFamily, size: s.fontSize })],
      })
    );
  }
  return result;
}

/** Decode a `data:image/png;base64,…` URL into raw bytes. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Compute embed dimensions (px) that fit within the page content area, preserving aspect ratio. */
function fitToPage(canvas: HTMLCanvasElement, s: ResolvedSettings): { width: number; height: number } {
  const contentTwips = s.pageWidth - s.marginLeft - s.marginRight;
  const maxWidthPx = Math.max(1, Math.floor((contentTwips / 1440) * 96)); // twips → in → px @96 DPI
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  const aspect = cssW > 0 ? cssH / cssW : 0.5;
  const width = Math.min(cssW || maxWidthPx, maxWidthPx);
  const height = Math.max(1, Math.round(width * aspect));
  return { width, height };
}

function convertTable(tableEl: HTMLTableElement, s: ResolvedSettings): Table {
  const border = {
    style: s.tableBorderStyle,
    color: s.tableBorderColor,
    size: s.tableBorderSize,
  };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const cellMargins = {
    top: s.tableCellPadding,
    bottom: s.tableCellPadding,
    left: s.tableCellPadding,
    right: s.tableCellPadding,
  };

  const rows: TableRow[] = [];
  for (const tr of Array.from(tableEl.querySelectorAll("tr"))) {
    const cells: TableCell[] = [];
    for (const cell of Array.from(tr.querySelectorAll("th, td"))) {
      const isHeader = cell.tagName.toLowerCase() === "th";
      cells.push(
        new TableCell({
          borders: cellBorders,
          margins: cellMargins,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cell.textContent ?? "",
                  bold: isHeader,
                  font: s.fontFamily,
                  size: s.fontSize,
                  color: s.fontColor,
                }),
              ],
            }),
          ],
          width: { size: 100, type: WidthType.AUTO },
        })
      );
    }
    if (cells.length > 0) rows.push(new TableRow({ children: cells }));
  }

  return new Table({ rows });
}
