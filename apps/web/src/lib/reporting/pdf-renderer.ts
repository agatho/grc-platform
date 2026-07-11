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
//
// Style variants (org_branding.report_template, overridable per call):
//   - standard: behaviour as before (default)
//   - formal:   cover page (large logo, title, org, date, confidentiality),
//               table of contents, wider spacing, thin rules, document
//               number in the footer
//   - minimal:  no logo, single-line header, tight row heights, frameless
//               KPIs — for quick working printouts

import PDFDocument from "pdfkit";
import { existsSync } from "fs";
import {
  chrome,
  computeColumnWidths,
  confidentialityText,
  defaultDocumentId,
  effectiveStyle,
  formatCell,
  DEFAULT_PRIMARY_COLOR,
  type ReportBar,
  type ReportDefinition,
  type ReportKpi,
  type ReportSection,
  type ReportStyle,
  type ReportTable,
} from "./core";

// A4 geometry
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const FOOTER_HEIGHT = 46; // chrome zone at the bottom of every page
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLOR_TEXT = "#1a1a1a";
const COLOR_MUTED = "#6b7280";
const COLOR_FAINT = "#9ca3af";
const COLOR_ZEBRA = "#f8fafc";
const COLOR_HEAD_BG = "#f1f5f9";
const COLOR_RULE = "#e2e8f0";

// ─── Style specs ─────────────────────────────────────────────────

interface StyleSpec {
  /** Height of the per-page header chrome zone. */
  headerHeight: number;
  showLogo: boolean;
  coverPage: boolean;
  toc: boolean;
  /** Draw outlines around KPI cards. */
  kpiFrames: boolean;
  /** Vertical padding added to the measured text height of table rows. */
  cellPad: number;
  minRowHeight: number;
  titleSize: number;
  /** moveDown factors — formal breathes, minimal is tight. */
  sectionTitleGap: number;
  blockGap: number;
  /** Rule thickness for the header underline (formal = thin lines). */
  ruleWidth: number;
  footerDocId: boolean;
}

const STYLE_SPECS: Record<ReportStyle, StyleSpec> = {
  standard: {
    headerHeight: 78,
    showLogo: true,
    coverPage: false,
    toc: false,
    kpiFrames: true,
    cellPad: 8,
    minRowHeight: 16,
    titleSize: 20,
    sectionTitleGap: 0.4,
    blockGap: 0.8,
    ruleWidth: 0.8,
    footerDocId: false,
  },
  formal: {
    headerHeight: 84,
    showLogo: true,
    coverPage: true,
    toc: true,
    kpiFrames: true,
    cellPad: 11,
    minRowHeight: 19,
    titleSize: 22,
    sectionTitleGap: 0.7,
    blockGap: 1.2,
    ruleWidth: 0.4,
    footerDocId: true,
  },
  minimal: {
    headerHeight: 40,
    showLogo: false,
    coverPage: false,
    toc: false,
    kpiFrames: false,
    cellPad: 5,
    minRowHeight: 13,
    titleSize: 15,
    sectionTitleGap: 0.3,
    blockGap: 0.5,
    ruleWidth: 0.5,
    footerDocId: false,
  },
};

interface TocEntry {
  title: string;
  page: number; // 1-based
}

/** Per-render state threaded through all drawing helpers. */
interface RenderCtx {
  doc: PDFKit.PDFDocument;
  def: ReportDefinition;
  spec: StyleSpec;
  primary: string;
  contentTop: number;
  contentBottom: number;
  toc: TocEntry[];
}

export async function renderReportPdf(def: ReportDefinition): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const style = effectiveStyle(def);
      const spec = STYLE_SPECS[style];
      const contentTop = spec.headerHeight + 12;
      const contentBottom = PAGE_HEIGHT - FOOTER_HEIGHT - 10;

      const doc = new PDFDocument({
        size: "A4",
        bufferPages: true,
        margins: {
          top: contentTop,
          bottom: PAGE_HEIGHT - contentBottom,
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

      const ctx: RenderCtx = {
        doc,
        def,
        spec,
        primary: def.branding.primaryColor || DEFAULT_PRIMARY_COLOR,
        contentTop,
        contentBottom,
        toc: [],
      };

      let tocPageIndex = -1;
      if (spec.coverPage) {
        drawCoverPage(ctx);
        if (spec.toc) {
          doc.addPage();
          tocPageIndex = 1;
        }
        doc.addPage();
        doc.y = contentTop;
      }

      // Title block (first content page, below chrome zone)
      doc
        .font("Helvetica-Bold")
        .fontSize(spec.titleSize)
        .fillColor(ctx.primary)
        .text(def.title, MARGIN_X, contentTop, { width: CONTENT_WIDTH });
      if (def.subtitle) {
        doc
          .moveDown(0.2)
          .font("Helvetica")
          .fontSize(10)
          .fillColor(COLOR_MUTED)
          .text(def.subtitle, { width: CONTENT_WIDTH });
      }
      doc.moveDown(spec.sectionTitleGap + 0.2);
      hRule(doc, ctx.primary, spec.ruleWidth + 0.2);
      doc.moveDown(spec.sectionTitleGap + 0.2);

      for (const section of def.sections) {
        renderSection(ctx, section);
      }

      // TOC entries are only known after content rendering assigned pages.
      if (tocPageIndex >= 0) {
        drawTocPage(ctx, tocPageIndex);
      }

      // Per-page chrome after content: page count is only known now.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        if (spec.coverPage && i === 0) continue; // cover has its own layout
        doc.switchToPage(i);
        // Writing into the footer zone must not trigger pdfkit's
        // implicit addPage — zero the bottom margin for chrome drawing.
        doc.page.margins.bottom = 0;
        drawPageChrome(ctx, i + 1, range.count);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Cover page (formal) ─────────────────────────────────────────

function drawCoverPage(ctx: RenderCtx): void {
  const { doc, def, primary } = ctx;

  if (def.branding.logoFilePath && existsSync(def.branding.logoFilePath)) {
    try {
      doc.image(def.branding.logoFilePath, PAGE_WIDTH / 2 - 100, 120, {
        fit: [200, 90],
        align: "center",
        valign: "center",
      });
    } catch {
      // Corrupt or unsupported image — cover degrades to text-only.
    }
  }

  doc
    .strokeColor(primary)
    .lineWidth(0.5)
    .moveTo(MARGIN_X + 60, 288)
    .lineTo(PAGE_WIDTH - MARGIN_X - 60, 288)
    .stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(26)
    .fillColor(primary)
    .text(def.title, MARGIN_X, 320, { width: CONTENT_WIDTH, align: "center" });

  if (def.subtitle) {
    doc
      .moveDown(0.4)
      .font("Helvetica")
      .fontSize(12)
      .fillColor(COLOR_MUTED)
      .text(def.subtitle, { width: CONTENT_WIDTH, align: "center" });
  }

  doc
    .strokeColor(primary)
    .lineWidth(0.5)
    .moveTo(MARGIN_X + 60, doc.y + 24)
    .lineTo(PAGE_WIDTH - MARGIN_X - 60, doc.y + 24)
    .stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(COLOR_TEXT)
    .text(def.branding.orgName || "ARCTOS", MARGIN_X, 500, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  doc
    .moveDown(0.5)
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLOR_MUTED)
    .text(
      `${chrome(def.locale, "generatedAt")}: ${formatCell(def.generatedAt, "text", def.locale)}`,
      { width: CONTENT_WIDTH, align: "center" },
    );
  doc
    .moveDown(0.3)
    .fontSize(9)
    .fillColor(COLOR_FAINT)
    .text(
      `${chrome(def.locale, "documentNo")}: ${def.documentId ?? defaultDocumentId(def.generatedAt)}`,
      { width: CONTENT_WIDTH, align: "center" },
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#991b1b")
    .text(confidentialityText(def), MARGIN_X, PAGE_HEIGHT - 90, {
      width: CONTENT_WIDTH,
      align: "center",
    });
}

// ─── Table of contents (formal) ──────────────────────────────────

function drawTocPage(ctx: RenderCtx, pageIndex: number): void {
  const { doc, def, primary } = ctx;
  doc.switchToPage(pageIndex);
  doc.page.margins.bottom = 0;

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(primary)
    .text(chrome(def.locale, "contents"), MARGIN_X, ctx.contentTop, {
      width: CONTENT_WIDTH,
    });

  let y = ctx.contentTop + 40;
  const lineHeight = 22;
  for (const entry of ctx.toc) {
    if (y + lineHeight > ctx.contentBottom) break; // overlong TOCs truncate
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLOR_TEXT)
      .text(entry.title, MARGIN_X, y, {
        width: CONTENT_WIDTH - 60,
        lineBreak: false,
        ellipsis: true,
      });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLOR_MUTED)
      .text(String(entry.page), PAGE_WIDTH - MARGIN_X - 40, y, {
        width: 40,
        align: "right",
        lineBreak: false,
      });
    doc
      .strokeColor(COLOR_RULE)
      .lineWidth(0.4)
      .moveTo(MARGIN_X, y + 14)
      .lineTo(PAGE_WIDTH - MARGIN_X, y + 14)
      .stroke();
    y += lineHeight;
  }
}

// ─── Page chrome ─────────────────────────────────────────────────

function drawPageChrome(
  ctx: RenderCtx,
  pageNo: number,
  pageCount: number,
): void {
  const { doc, def, spec, primary } = ctx;

  if (spec.headerHeight <= 48) {
    // Minimal: single compact header line, no logo.
    doc.font("Helvetica-Bold").fontSize(8).fillColor(primary);
    doc.text(def.branding.orgName || "ARCTOS", MARGIN_X, 18, {
      width: CONTENT_WIDTH * 0.45,
      lineBreak: false,
      ellipsis: true,
    });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLOR_MUTED)
      .text(def.title, MARGIN_X + CONTENT_WIDTH * 0.45, 18, {
        width: CONTENT_WIDTH * 0.55,
        align: "right",
        lineBreak: false,
        ellipsis: true,
      });
    doc
      .strokeColor(COLOR_RULE)
      .lineWidth(spec.ruleWidth)
      .moveTo(MARGIN_X, spec.headerHeight - 8)
      .lineTo(PAGE_WIDTH - MARGIN_X, spec.headerHeight - 8)
      .stroke();
  } else {
    // Standard/formal: org name (left), logo (right), title small (2nd line)
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

    if (
      spec.showLogo &&
      def.branding.logoFilePath &&
      existsSync(def.branding.logoFilePath)
    ) {
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
      .lineWidth(spec.ruleWidth)
      .moveTo(MARGIN_X, spec.headerHeight - 14)
      .lineTo(PAGE_WIDTH - MARGIN_X, spec.headerHeight - 14)
      .stroke();
  }

  // Footer: confidentiality (left), timestamp (center), page x of y (right)
  const footerY = PAGE_HEIGHT - FOOTER_HEIGHT + 8;
  doc
    .strokeColor(COLOR_RULE)
    .lineWidth(spec.ruleWidth < 0.5 ? 0.4 : 0.5)
    .moveTo(MARGIN_X, footerY - 6)
    .lineTo(PAGE_WIDTH - MARGIN_X, footerY - 6)
    .stroke();

  doc.font("Helvetica-Bold").fontSize(7).fillColor("#991b1b");
  doc.text(confidentialityText(ctx.def), MARGIN_X, footerY, {
    width: 210,
    lineBreak: false,
  });

  if (spec.footerDocId) {
    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor(COLOR_FAINT)
      .text(
        `${chrome(def.locale, "documentNo")}: ${def.documentId ?? defaultDocumentId(def.generatedAt)}`,
        MARGIN_X,
        footerY + 10,
        { width: 210, lineBreak: false },
      );
  }

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

/** Current 1-based page number while content is being rendered. */
function currentPageNo(doc: PDFKit.PDFDocument): number {
  return doc.bufferedPageRange().count;
}

function renderSection(ctx: RenderCtx, section: ReportSection): void {
  const { doc, spec } = ctx;
  switch (section.kind) {
    case "paragraph":
      ensureSpace(ctx, 40);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLOR_TEXT)
        .text(section.text, MARGIN_X, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(spec.blockGap);
      return;
    case "heading":
      renderSectionTitle(ctx, section.text);
      return;
    case "kpis":
      renderKpis(ctx, section.items);
      return;
    case "table":
      if (section.title) renderSectionTitle(ctx, section.title);
      renderTable(ctx, section.table);
      return;
    case "bars":
      if (section.title) renderSectionTitle(ctx, section.title);
      renderBars(ctx, section.items);
      return;
    case "pageBreak":
      doc.addPage();
      doc.y = ctx.contentTop;
      doc.x = MARGIN_X;
      return;
  }
}

function renderSectionTitle(ctx: RenderCtx, title: string): void {
  const { doc, spec, primary } = ctx;
  ensureSpace(ctx, 70); // avoid orphaned headings
  ctx.toc.push({ title, page: currentPageNo(doc) });
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(primary)
    .text(title, MARGIN_X, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(spec.sectionTitleGap);
}

function renderKpis(ctx: RenderCtx, kpis: ReportKpi[]): void {
  const { doc, spec, primary } = ctx;
  if (kpis.length === 0) return;
  const gap = 8;
  const cardHeight = spec.kpiFrames ? 46 : 34;
  const perRow = Math.min(kpis.length, 5);
  const cardWidth = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow;

  for (let start = 0; start < kpis.length; start += perRow) {
    const row = kpis.slice(start, start + perRow);
    ensureSpace(ctx, cardHeight + 10);
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
      if (spec.kpiFrames) {
        doc
          .rect(x, startY, cardWidth, cardHeight)
          .strokeColor(COLOR_RULE)
          .lineWidth(spec.ruleWidth < 0.5 ? 0.4 : 0.5)
          .stroke();
      }
      doc
        .font("Helvetica-Bold")
        .fontSize(spec.kpiFrames ? 14 : 12)
        .fillColor(color)
        .text(String(kpi.value), x + 2, startY + (spec.kpiFrames ? 7 : 2), {
          width: cardWidth - 4,
          align: "center",
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#64748b")
        .text(kpi.label, x + 3, startY + (spec.kpiFrames ? 28 : 18), {
          width: cardWidth - 6,
          align: "center",
          height: 16,
          ellipsis: true,
        });
    }
    doc.x = MARGIN_X;
    doc.y = startY + cardHeight + (spec.kpiFrames ? 10 : 6);
  }
  doc.moveDown(0.3);
}

// ─── Table with page-break + repeated header ─────────────────────

function renderTable(ctx: RenderCtx, table: ReportTable): void {
  const { doc, def, spec, primary } = ctx;
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
      ctx,
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

  ensureSpace(ctx, 60);
  drawHeader();

  for (let r = 0; r < table.rows.length; r++) {
    const cells = table.rows[r].map((cell, c) =>
      formatCell(cell, table.columns[c]?.format, def.locale),
    );
    const h = rowHeight(ctx, cells, widths, "Helvetica", 8.5);

    if (doc.y + h > ctx.contentBottom) {
      doc.addPage();
      doc.y = ctx.contentTop;
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
    .lineWidth(spec.ruleWidth < 0.5 ? 0.4 : 0.5)
    .moveTo(MARGIN_X, doc.y)
    .lineTo(MARGIN_X + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.x = MARGIN_X;
  doc.moveDown(spec.blockGap + 0.2);
}

function rowHeight(
  ctx: RenderCtx,
  cells: string[],
  widths: number[],
  font: string,
  fontSize: number,
): number {
  const { doc, spec } = ctx;
  doc.font(font).fontSize(fontSize);
  let max = 0;
  for (let c = 0; c < cells.length; c++) {
    const h = doc.heightOfString(cells[c] || " ", { width: widths[c] - 8 });
    if (h > max) max = h;
  }
  return Math.max(max + spec.cellPad, spec.minRowHeight);
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

function renderBars(ctx: RenderCtx, items: ReportBar[]): void {
  const { doc, def, spec, primary } = ctx;
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
  const rowH = spec.minRowHeight < 16 ? 17 : 20;

  for (const item of items) {
    ensureSpace(ctx, rowH + 4);
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
  doc.moveDown(spec.blockGap);
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

function ensureSpace(ctx: RenderCtx, needed: number): void {
  const { doc } = ctx;
  if (doc.y + needed > ctx.contentBottom) {
    doc.addPage();
    doc.y = ctx.contentTop;
    doc.x = MARGIN_X;
  }
}
