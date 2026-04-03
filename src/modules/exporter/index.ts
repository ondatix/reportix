/**
 * Exporter module — serializes the rendered HTML report to a .docx file.
 * Preserves heading structure, tables, and alt texts.
 * Applies font, page, and margin settings from ExportConfig.
 * Usable independently in other projects.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  BorderStyle,
  convertMillimetersToTwip,
} from "docx";
import { saveAs } from "file-saver";
import type { ExportConfig } from "../types";

/** Resolved font/page defaults merged with user config. */
interface ResolvedExportSettings {
  filename: string;
  fontFamily: string;
  fontSize: number;        // half-points (docx convention)
  headingFamily: string;
  pageWidth: number;       // twips
  pageHeight: number;      // twips
  marginTop: number;       // twips
  marginRight: number;     // twips
  marginBottom: number;    // twips
  marginLeft: number;      // twips
}

function resolveSettings(config?: ExportConfig): ResolvedExportSettings {
  const mm = convertMillimetersToTwip;
  return {
    filename: config?.filename ?? "report.docx",
    fontFamily: config?.font?.family ?? "Arial",
    fontSize: (config?.font?.size ?? 11) * 2,  // pt → half-points
    headingFamily: config?.font?.headingFamily ?? config?.font?.family ?? "Arial",
    pageWidth: config?.page?.width ?? mm(210),    // A4
    pageHeight: config?.page?.height ?? mm(297),
    marginTop: config?.page?.margin?.top ?? mm(25),
    marginRight: config?.page?.margin?.right ?? mm(25),
    marginBottom: config?.page?.margin?.bottom ?? mm(25),
    marginLeft: config?.page?.margin?.left ?? mm(25),
  };
}

/**
 * Export the report preview container to a .docx file.
 * Walks the rendered DOM and converts elements to docx paragraphs/tables.
 */
export async function exportToDocx(
  container: HTMLElement,
  config?: ExportConfig
): Promise<void> {
  const s = resolveSettings(config);
  const children = convertChildren(container, s);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: s.fontFamily, size: s.fontSize },
        },
        heading1: { run: { font: s.headingFamily, size: s.fontSize + 12 } },
        heading2: { run: { font: s.headingFamily, size: s.fontSize + 8 } },
        heading3: { run: { font: s.headingFamily, size: s.fontSize + 4 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: s.pageWidth, height: s.pageHeight },
            margin: {
              top: s.marginTop,
              right: s.marginRight,
              bottom: s.marginBottom,
              left: s.marginLeft,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, s.filename);
}

type DocxChild = Paragraph | Table;

function convertChildren(
  el: HTMLElement,
  s: ResolvedExportSettings
): DocxChild[] {
  const result: DocxChild[] = [];

  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        result.push(
          new Paragraph({
            children: [new TextRun({ text, font: s.fontFamily, size: s.fontSize })],
          })
        );
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as HTMLElement;
    const tag = child.tagName.toLowerCase();

    switch (tag) {
      case "h1":
        result.push(heading(child, HeadingLevel.HEADING_1, s));
        break;
      case "h2":
        result.push(heading(child, HeadingLevel.HEADING_2, s));
        break;
      case "h3":
        result.push(heading(child, HeadingLevel.HEADING_3, s));
        break;
      case "h4":
        result.push(heading(child, HeadingLevel.HEADING_4, s));
        break;
      case "h5":
        result.push(heading(child, HeadingLevel.HEADING_5, s));
        break;
      case "h6":
        result.push(heading(child, HeadingLevel.HEADING_6, s));
        break;

      case "p":
        result.push(paragraph(child, s));
        break;

      case "ul":
      case "ol":
        result.push(...listItems(child, s));
        break;

      case "table":
        result.push(convertTable(child as HTMLTableElement, s));
        break;

      case "figure": {
        const canvas = child.querySelector("canvas");
        const alt = canvas?.getAttribute("aria-label");
        if (alt) {
          result.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `[Chart: ${alt}]`,
                  italics: true,
                  font: s.fontFamily,
                  size: s.fontSize,
                }),
              ],
            })
          );
        }
        const caption = child.querySelector("figcaption");
        if (caption?.textContent) {
          result.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: caption.textContent,
                  bold: true,
                  font: s.fontFamily,
                  size: s.fontSize,
                }),
              ],
            })
          );
        }
        break;
      }

      case "section":
      case "div":
        result.push(...convertChildren(child, s));
        break;

      default:
        result.push(paragraph(child, s));
        break;
    }
  }

  return result;
}

function heading(
  el: HTMLElement,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
  s: ResolvedExportSettings
): Paragraph {
  return new Paragraph({
    heading: level,
    children: [
      new TextRun({
        text: el.textContent ?? "",
        font: s.headingFamily,
      }),
    ],
  });
}

function paragraph(el: HTMLElement, s: ResolvedExportSettings): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: el.textContent ?? "",
        font: s.fontFamily,
        size: s.fontSize,
      }),
    ],
  });
}

function listItems(el: HTMLElement, s: ResolvedExportSettings): Paragraph[] {
  return Array.from(el.querySelectorAll("li")).map(
    (li) =>
      new Paragraph({
        children: [
          new TextRun({
            text: `\u2022 ${li.textContent ?? ""}`,
            font: s.fontFamily,
            size: s.fontSize,
          }),
        ],
      })
  );
}

function convertTable(
  tableEl: HTMLTableElement,
  s: ResolvedExportSettings
): Table {
  const rows: TableRow[] = [];
  const border = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: "999999",
  };

  for (const tr of Array.from(tableEl.querySelectorAll("tr"))) {
    const cells: TableCell[] = [];
    for (const cell of Array.from(tr.querySelectorAll("th, td"))) {
      const isHeader = cell.tagName.toLowerCase() === "th";
      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cell.textContent ?? "",
                  bold: isHeader,
                  font: s.fontFamily,
                  size: s.fontSize,
                }),
              ],
            }),
          ],
          width: { size: 100, type: WidthType.AUTO },
          borders: {
            top: border,
            bottom: border,
            left: border,
            right: border,
          },
        })
      );
    }
    if (cells.length > 0) {
      rows.push(new TableRow({ children: cells }));
    }
  }

  return new Table({ rows });
}
