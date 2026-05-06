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
  convertMillimetersToTwip,
} from "docx";
import { saveAs } from "file-saver";
import type { ExportConfig } from "../types";

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
}

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
  };
}

// ── Public API ───────────────────────────────────────────────────────

export async function exportToDocx(
  container: HTMLElement,
  config?: ExportConfig
): Promise<void> {
  const s = resolveSettings(config);
  const children = convertChildren(container, s);

  const doc = new Document({
    title: s.title,
    subject: s.subject,
    creator: s.creator,
    description: s.description,
    keywords: s.keywords,

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
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading2: {
          run: { font: s.headingFamily, size: s.h2Size, color: s.headingColor, bold: true },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
        heading3: {
          run: { font: s.headingFamily, size: s.h3Size, color: s.headingColor, bold: true },
          paragraph: { spacing: { before: 160, after: 60 } },
        },
        heading4: {
          run: { font: s.headingFamily, size: s.h4Size, color: s.headingColor, bold: true },
          paragraph: { spacing: { before: 120, after: 40 } },
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
        children,
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
    const child = node as HTMLElement;
    const tag = child.tagName.toLowerCase();

    switch (tag) {
      case "h1": result.push(heading(child, HeadingLevel.HEADING_1, s)); break;
      case "h2": result.push(heading(child, HeadingLevel.HEADING_2, s)); break;
      case "h3": result.push(heading(child, HeadingLevel.HEADING_3, s)); break;
      case "h4": result.push(heading(child, HeadingLevel.HEADING_4, s)); break;
      case "h5": result.push(heading(child, HeadingLevel.HEADING_5, s)); break;
      case "h6": result.push(heading(child, HeadingLevel.HEADING_6, s)); break;
      case "p":  result.push(bodyParagraph(child, s)); break;
      case "ul":
      case "ol": result.push(...listItems(child, s)); break;
      case "table": result.push(convertTable(child as HTMLTableElement, s)); break;
      case "figure": result.push(...convertFigure(child, s)); break;
      case "section":
      case "div": result.push(...convertChildren(child, s)); break;
      default: result.push(bodyParagraph(child, s)); break;
    }
  }

  return result;
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
  return new Paragraph({
    alignment: s.alignment,
    children: [
      new TextRun({ text: el.textContent ?? "", font: s.fontFamily, size: s.fontSize, color: s.fontColor }),
    ],
  });
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
