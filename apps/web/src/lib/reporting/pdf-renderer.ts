// Hardened pdfkit renderer for the standard report suite.
//
// Improvements over lib/pdf.ts (which stays in place for its existing
// callers, e.g. the management-review protocol):
//   - Per-page chrome: org name + logo (org_branding) top, report title,
//     confidentiality notice + timestamp + "Seite X von Y" bottom.
//   - Weighted column widths + dynamic row heights (heightOfString)
//     instead of equal columns with fixed 18pt rows that clipped text.
//   - Table header row repeats after every page break.
//   - Locale-aware number/date formatting DE/EN (lib/format.ts).
//   - Percent bars rendered as plain rectangles (compliance report).

import PDFDocument from "pdfkit";
import { existsSync } from "fs";
import {
  chrome,
  computeColumnWidths,
  confidentialityText,
  formatCell,
  DEFAULT_PRIMARY_COLOR,
  type ReportBar,
  type ReportDefinition,
  type ReportKpi,
  type ReportSection,
  type ReportTable,
} from "./core";

// A4 geometry
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const HEADER_HEIGHT = 78; // chrome zone at the top of every page
const FOOTER_HEIGHT = 46; // chrome zone at the bottom of every page
const CONTENT_TOP = HEADER_HEIGHT + 12;
const CONTENT_BOTTOM = PAGE_HEIGHT - FOOTER_HEIGHT - 10;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLOR_TEXT = "#1a1a1a";
const COLOR_MUTED = "#6b7280";
const COLOR_FAINT = "#9ca3af";
const COLOR_ZEBRA = "#f8fafc";
const COLOR_HEAD_BG = "#f1f5f9";
const COLOR_RULE = "#e2e8f0";

export async function renderReportPdf(def: ReportDefinition): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        bufferPages: true,
        margins: {
          top: CONTENT_TOP,
          bottom: PAGE_HEIGHT - CONTENT_BOTTOM,
          left: MARGIN_X,
          right: MARGIN_X,
        },
        info: {
          Title: def.title,
          Author: def.branding.orgName || "ARCTOS",
          Creator: "ARCTOS GRC Platform",
          Producer: "ARCTOS Report Core v1 (pdfkit)",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const primary = def.branding.primaryColor || DEFAULT_PRIMARY_COLOR;

      // Title block (first page, below chrome zone)
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor(primary)
        .text(def.title, MARGIN_X, CONTENT_TOP, { width: CONTENT_WIDTH });
      if (def.subtitle) {
        doc
          .moveDown(0.2)
          .font("Helvetica")
          .fontSize(10)
          .fillColor(COLOR_MUTED)
          .text(def.subtitle, { width: CONTENT_WIDTH });
      }
      doc.moveDown(0.6);
      hRule(doc, primary, 1);
      doc.moveDown(0.6);

      for (const section of def.sections) {
        renderSection(doc, section, def, primary);
      }

      // Per-page chrome after content: page count is only known now.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // Writing into the footer zone must not trigger pdfkit's
        // implicit addPage — zero the bottom margin for chrome drawing.
        doc.page.margins.bottom = 0;
        drawPageChrome(doc, def, primary, i + 1, range.count);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Page chrome ─────────────────────────────────────────────────

function drawPageChrome(
  doc: PDFKit.PDFDocument,
  def: ReportDefinition,
  primary: string,
  pageNo: number,
  pageCount: number,
): void {
  // Header: org name (left), logo (right), report title small (left, 2nd line)
  doc.font("Helvetica-Bold").fontSize(11).fillColor(primary);
  doc.text(def.branding.orgName || "ARCTOS", MARGIN_X, 28, {
    width: CONTENT_WIDTH - 130,
    lineBreak: false,
  });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLOR_MUTED)
    .text(def.title, MARGIN_X, 44, {
      width: CONTENT_WIDTH - 130,
      lineBreak: false,
    });

  if (def.branding.logoFilePath && existsSync(def.branding.logoFilePath)) {
    try {
      doc.image(def.branding.logoFilePath, PAGE_WIDTH - MARGIN_X - 96, 22, {
        fit: [96, 36],
        align: "right",
      });
    } catch {
      // Corrupt or unsupported image — chrome degrades to text-only.
    }
  }

  doc
    .strokeColor(primary)
    .lineWidth(0.8)
    .moveTo(MARGIN_X, HEADER_HEIGHT - 14)
    .lineTo(PAGE_WIDTH - MARGIN_X, HEADER_HEIGHT - 14)
    .stroke();

  // Footer: confidentiality (left), timestamp (center), page x of y (right)
  const footerY = PAGE_HEIGHT - FOOTER_HEIGHT + 8;
  doc
    .strokeColor(COLOR_RULE)
    .lineWidth(0.5)
    .moveTo(MARGIN_X, footerY - 6)
    .lineTo(PAGE_WIDTH - MARGIN_X, footerY - 6)
    .stroke();

  doc.font("Helvetica-Bold").fontSize(7).fillColor("#991b1b");
  doc.text(confidentialityText(def), MARGIN_X, footerY, {
    width: 210,
    lineBreak: false,
  });

  doc.font("Helvetica").fontSize(7).fillColor(COLOR_FAINT);
  doc.text(
    `${chrome(def.locale, "generatedAt")}: ${formatCell(def.generatedAt, "text", def.locale)}`,
    MARGIN_X + 210,
    footerY,
    { width: CONTENT_WIDTH - 210 - 90, align: "center", lineBreak: false },
  );
  doc.text(
    `${chrome(def.locale, "page")} ${pageNo} ${chrome(def.locale, "of")} ${pageCount}`,
    PAGE_WIDTH - MARGIN_X - 90,
    footerY,
    { width: 90, align: "right", lineBreak: false },
  );
}

// ─── Sections ────────────────────────────────────────────────────

function renderSection(
  doc: PDFKit.PDFDocument,
  section: ReportSection,
  def: ReportDefinition,
  primary: string,
): void {
  switch (section.kind) {
    case "paragraph":
      ensureSpace(doc, 40);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLOR_TEXT)
        .text(section.text, MARGIN_X, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.8);
      return;
    case "kpis":
      renderKpis(doc, section.items, primary);
      return;
    case "table":
      if (section.title) renderSectionTitle(doc, section.title, primary);
      renderTable(doc, section.table, def, primary);
      return;
    case "bars":
      if (section.title) renderSectionTitle(doc, section.title, primary);
      renderBars(doc, section.items, def, primary);
      return;
  }
}

function renderSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  primary: string,
): void {
  ensureSpace(doc, 70); // avoid orphaned headings
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(primary)
    .text(title, MARGIN_X, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.4);
}

function renderKpis(
  doc: PDFKit.PDFDocument,
  kpis: ReportKpi[],
  primary: string,
): void {
  if (kpis.length === 0) return;
  const gap = 8;
  const cardHeight = 46;
  const perRow = Math.min(kpis.length, 5);
  const cardWidth = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow;

  for (let start = 0; start < kpis.length; start += perRow) {
    const row = kpis.slice(start, start + perRow);
    ensureSpace(doc, cardHeight + 10);
    const startY = doc.y;
    for (let i = 0; i < row.length; i++) {
      const kpi = row[i];
      const x = MARGIN_X + i * (cardWidth + gap);
      const color =
        kpi.tone === "crit"
          ? "#991b1b"
          : kpi.tone === "warn"
            ? "#854d0e"
            : kpi.tone === "ok"
              ? "#166534"
              : primary;
      doc
        .rect(x, startY, cardWidth, cardHeight)
        .strokeColor(COLOR_RULE)
        .lineWidth(0.5)
        .stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(color)
        .text(String(kpi.value), x + 2, startY + 7, {
          width: cardWidth - 4,
          align: "center",
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#64748b")
        .text(kpi.label, x + 3, startY + 28, {
          width: cardWidth - 6,
          align: "center",
          height: 16,
          ellipsis: true,
        });
    }
    doc.x = MARGIN_X;
    doc.y = startY + cardHeight + 10;
  }
  doc.moveDown(0.3);
}

// ─── Table with page-break + repeated header ─────────────────────

function renderTable(
  doc: PDFKit.PDFDocument,
  table: ReportTable,
  def: ReportDefinition,
  primary: string,
): void {
  const widths = computeColumnWidths(table.columns, CONTENT_WIDTH);

  if (table.rows.length === 0) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text(chrome(def.locale, "noData"), MARGIN_X, doc.y);
    doc.moveDown(1);
    return;
  }

  const drawHeader = (): void => {
    const headerHeight = rowHeight(
      doc,
      table.columns.map((c) => c.label),
      widths,
      "Helvetica-Bold",
      8.5,
    );
    doc
      .rect(MARGIN_X, doc.y, CONTENT_WIDTH, headerHeight)
      .fillColor(COLOR_HEAD_BG)
      .fill();
    drawRowCells(
      doc,
      table.columns.map((c) => c.label),
      widths,
      table.columns,
      doc.y,
      headerHeight,
      "Helvetica-Bold",
      8.5,
      primary,
      true,
    );
    doc.y += headerHeight;
  };

  ensureSpace(doc, 60);
  drawHeader();

  for (let r = 0; r < table.rows.length; r++) {
    const cells = table.rows[r].map((cell, c) =>
      formatCell(cell, table.columns[c]?.format, def.locale),
    );
    const h = rowHeight(doc, cells, widths, "Helvetica", 8.5);

    if (doc.y + h > CONTENT_BOTTOM) {
      doc.addPage();
      doc.y = CONTENT_TOP;
      drawHeader(); // repeated header after page break
    }

    if (r % 2 === 1) {
      doc.rect(MARGIN_X, doc.y, CONTENT_WIDTH, h).fillColor(COLOR_ZEBRA).fill();
    }
    drawRowCells(
      doc,
      cells,
      widths,
      table.columns,
      doc.y,
      h,
      "Helvetica",
      8.5,
      COLOR_TEXT,
      false,
    );
    doc.y += h;
  }

  doc
    .strokeColor(COLOR_RULE)
    .lineWidth(0.5)
    .moveTo(MARGIN_X, doc.y)
    .lineTo(MARGIN_X + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.x = MARGIN_X;
  doc.moveDown(1);
}

function rowHeight(
  doc: PDFKit.PDFDocument,
  cells: string[],
  widths: number[],
  font: string,
  fontSize: number,
): number {
  doc.font(font).fontSize(fontSize);
  let max = 0;
  for (let c = 0; c < cells.length; c++) {
    const h = doc.heightOfString(cells[c] || " ", { width: widths[c] - 8 });
    if (h > max) max = h;
  }
  return Math.max(max + 8, 16);
}

function drawRowCells(
  doc: PDFKit.PDFDocument,
  cells: string[],
  widths: number[],
  columns: ReportTable["columns"],
  y: number,
  height: number,
  font: string,
  fontSize: number,
  color: string,
  isHeader: boolean,
): void {
  let x = MARGIN_X;
  for (let c = 0; c < cells.length; c++) {
    const col = columns[c];
    const align =
      col?.align ??
      (!isHeader &&
      (col?.format === "int" ||
        col?.format === "decimal" ||
        col?.format === "percent")
        ? "right"
        : "left");
    doc
      .font(font)
      .fontSize(fontSize)
      .fillColor(color)
      .text(cells[c], x + 4, y + 4, {
        width: widths[c] - 8,
        height: height - 4,
        align,
        ellipsis: true,
      });
    x += widths[c];
  }
}

// ─── Percent bars (compliance report) ────────────────────────────

function renderBars(
  doc: PDFKit.PDFDocument,
  items: ReportBar[],
  def: ReportDefinition,
  primary: string,
): void {
  if (items.length === 0) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text(chrome(def.locale, "noData"), MARGIN_X, doc.y);
    doc.moveDown(1);
    return;
  }

  const labelWidth = 210;
  const valueWidth = 52;
  const barWidth = CONTENT_WIDTH - labelWidth - valueWidth - 12;
  const rowH = 20;

  for (const item of items) {
    ensureSpace(doc, rowH + 4);
    const y = doc.y;
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLOR_TEXT)
      .text(item.label, MARGIN_X, y + 4, {
        width: labelWidth - 6,
        height: rowH - 4,
        ellipsis: true,
        lineBreak: false,
      });

    const barX = MARGIN_X + labelWidth;
    const pct = Math.min(Math.max(item.percent, 0), 100);
    // Track
    doc
      .rect(barX, y + 4, barWidth, 10)
      .fillColor("#e5e7eb")
      .fill();
    // Fill
    if (pct > 0) {
      const fillColor = pct >= 80 ? "#166534" : pct >= 50 ? "#854d0e" : "#991b1b";
      doc
        .rect(barX, y + 4, (barWidth * pct) / 100, 10)
        .fillColor(fillColor)
        .fill();
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(primary)
      .text(
        formatCell(pct, "percent", def.locale),
        barX + barWidth + 8,
        y + 4,
        { width: valueWidth, align: "right", lineBreak: false },
      );
    if (item.detail) {
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(COLOR_FAINT)
        .text(item.detail, MARGIN_X, y + rowH - 4, {
          width: CONTENT_WIDTH,
          lineBreak: false,
        });
      doc.y = y + rowH + 6;
    } else {
      doc.y = y + rowH;
    }
    doc.x = MARGIN_X;
  }
  doc.moveDown(0.8);
}

// ─── Utilities ───────────────────────────────────────────────────

function hRule(doc: PDFKit.PDFDocument, color: string, width: number): void {
  doc
    .strokeColor(color)
    .lineWidth(width)
    .moveTo(MARGIN_X, doc.y)
    .lineTo(PAGE_WIDTH - MARGIN_X, doc.y)
    .stroke();
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > CONTENT_BOTTOM) {
    doc.addPage();
    doc.y = CONTENT_TOP;
    doc.x = MARGIN_X;
  }
}
