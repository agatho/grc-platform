// pdfkit renderer for the neutral ReportDocument model — replaces the
// Sprint-30 Puppeteer HTML→PDF path (Chromium-in-Alpine deploy pain,
// already retired for the direct exports by #WAVE11-P1-EXPORT).
//
// Placement: this renderer lives in @grc/reporting (not apps/web)
// because apps/worker generates scheduled reports in-process via
// reportGenerator (crons/report-scheduler.ts) and packages must never
// import from apps.
//
// Dependency note: pdfkit is intentionally NOT declared in
// packages/reporting/package.json (dependency manifests are frozen in
// this change window). It resolves at runtime through the hoisted
// workspace-root node_modules (apps/web declares pdfkit + @types/pdfkit),
// which serves both the web and the worker process. The import is lazy —
// the same pattern the retired Puppeteer path used — so environments
// without pdfkit fail at render time with a clear module error, not at
// package load. TODO(dependency window): declare pdfkit as an explicit
// dependency of @grc/reporting and remove puppeteer everywhere.

import type {
  ReportDocument,
  ReportDocumentCell,
  ReportDocumentSection,
} from "../report-document";

// A4 geometry
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_TOP = 74;
const CONTENT_BOTTOM = PAGE_HEIGHT - 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLOR_TEXT = "#1a1a1a";
const COLOR_MUTED = "#64748b";
const COLOR_FAINT = "#94a3b8";
const COLOR_ZEBRA = "#f8fafc";
const COLOR_RULE = "#e2e8f0";
const COLOR_BAR = "#3b82f6";

export interface RenderReportDocumentPdfOptions {
  /**
   * Stream compression (default true). Tests disable it so section text
   * can be asserted directly against the PDF bytes.
   */
  compress?: boolean;
}

type PdfDoc = PDFKit.PDFDocument;

export async function renderReportDocumentPdf(
  model: ReportDocument,
  options: RenderReportDocumentPdfOptions = {},
): Promise<Buffer> {
  // Lazy import — see dependency note in the file header.
  const { default: PDFDocument } = await import("pdfkit");

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        bufferPages: true,
        compress: options.compress ?? true,
        margins: {
          top: CONTENT_TOP,
          bottom: PAGE_HEIGHT - CONTENT_BOTTOM,
          left: MARGIN,
          right: MARGIN,
        },
        info: {
          Creator: "ARCTOS GRC Platform",
          Producer: "ARCTOS Report Engine (pdfkit)",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const primary = model.branding.primaryColor || "#1e3a5f";
      doc.y = CONTENT_TOP;

      // KPI cards flow horizontally until a non-KPI section resets the row.
      const kpiRow = { active: false, x: MARGIN, y: 0 };

      for (const section of model.sections) {
        if (section.kind !== "kpi" && kpiRow.active) {
          doc.y = kpiRow.y + KPI_HEIGHT + 12;
          doc.x = MARGIN;
          kpiRow.active = false;
        }
        renderSection(doc, section, primary, kpiRow);
      }
      if (kpiRow.active) {
        doc.y = kpiRow.y + KPI_HEIGHT + 12;
      }

      // Page chrome once the page count is final.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0; // chrome writes below the content zone
        drawPageChrome(doc, model, primary, i + 1, range.count);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Page chrome ─────────────────────────────────────────────────

function drawPageChrome(
  doc: PdfDoc,
  model: ReportDocument,
  primary: string,
  pageNo: number,
  pageCount: number,
): void {
  const generated = new Date(model.generatedAt);
  const generatedLabel = Number.isNaN(generated.getTime())
    ? model.generatedAt
    : generated.toLocaleDateString("de-DE");

  // Header: rule + generated date (right) + confidentiality (left, red)
  doc
    .strokeColor(primary)
    .lineWidth(1)
    .moveTo(MARGIN, CONTENT_TOP - 18)
    .lineTo(PAGE_WIDTH - MARGIN, CONTENT_TOP - 18)
    .stroke();
  if (model.branding.confidentiality) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor("#ef4444")
      .text(model.branding.confidentiality.toUpperCase(), MARGIN, 32, {
        width: CONTENT_WIDTH / 2,
        lineBreak: false,
      });
  }
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLOR_MUTED)
    .text(`Generated: ${generatedLabel}`, MARGIN + CONTENT_WIDTH / 2, 32, {
      width: CONTENT_WIDTH / 2,
      align: "right",
      lineBreak: false,
    });

  // Footer: footer text (left) + page numbers (right)
  const footerY = PAGE_HEIGHT - 38;
  doc
    .strokeColor(COLOR_RULE)
    .lineWidth(0.5)
    .moveTo(MARGIN, footerY - 6)
    .lineTo(PAGE_WIDTH - MARGIN, footerY - 6)
    .stroke();
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(COLOR_FAINT)
    .text(model.branding.footerText ?? "", MARGIN, footerY, {
      width: CONTENT_WIDTH - 90,
      lineBreak: false,
      ellipsis: true,
    });
  doc.text(`Page ${pageNo} of ${pageCount}`, PAGE_WIDTH - MARGIN - 90, footerY, {
    width: 90,
    align: "right",
    lineBreak: false,
  });
}

// ─── Sections ────────────────────────────────────────────────────

const KPI_WIDTH = 150;
const KPI_HEIGHT = 46;

function renderSection(
  doc: PdfDoc,
  section: ReportDocumentSection,
  primary: string,
  kpiRow: { active: boolean; x: number; y: number },
): void {
  switch (section.kind) {
    case "heading":
      ensureSpace(doc, 60);
      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(primary)
        .text(section.text, MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.5);
      return;
    case "paragraph":
      ensureSpace(doc, 40);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLOR_TEXT)
        .text(section.text, MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.8);
      return;
    case "kpi":
      renderKpi(doc, section, primary, kpiRow);
      return;
    case "table":
      if (section.title) renderTitle(doc, section.title, primary);
      renderTable(doc, section.headers, section.rows, primary);
      return;
    case "chart":
      if (section.title) renderTitle(doc, section.title, primary);
      renderChart(doc, section, primary);
      return;
    case "pageBreak":
      doc.addPage();
      doc.y = CONTENT_TOP;
      doc.x = MARGIN;
      return;
  }
}

function renderTitle(doc: PdfDoc, title: string, primary: string): void {
  ensureSpace(doc, 60);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(primary)
    .text(title, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.4);
}

function renderKpi(
  doc: PdfDoc,
  section: Extract<ReportDocumentSection, { kind: "kpi" }>,
  primary: string,
  kpiRow: { active: boolean; x: number; y: number },
): void {
  // Horizontal flow like the old HTML inline-block cards.
  if (!kpiRow.active || kpiRow.x + KPI_WIDTH > PAGE_WIDTH - MARGIN) {
    if (kpiRow.active) doc.y = kpiRow.y + KPI_HEIGHT + 12;
    ensureSpace(doc, KPI_HEIGHT + 12);
    kpiRow.x = MARGIN;
    kpiRow.y = doc.y;
    kpiRow.active = true;
  }

  const x = kpiRow.x;
  const y = kpiRow.y;
  const trendSuffix =
    section.trend === "up" ? " +" : section.trend === "down" ? " -" : "";

  doc
    .rect(x, y, KPI_WIDTH, KPI_HEIGHT)
    .strokeColor(COLOR_RULE)
    .lineWidth(0.5)
    .stroke();
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(primary)
    .text(`${String(section.value)}${trendSuffix}`, x + 4, y + 7, {
      width: KPI_WIDTH - 8,
      align: "center",
      lineBreak: false,
    });
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLOR_MUTED)
    .text(section.label, x + 5, y + 29, {
      width: KPI_WIDTH - 10,
      align: "center",
      height: 14,
      ellipsis: true,
    });

  kpiRow.x = x + KPI_WIDTH + 10;
}

// ─── Table (paginated, repeated header) ──────────────────────────

function cellText(cell: ReportDocumentCell): string {
  if (cell === null || cell === undefined) return "";
  return String(cell);
}

function renderTable(
  doc: PdfDoc,
  headers: string[],
  rows: ReportDocumentCell[][],
  primary: string,
): void {
  if (headers.length === 0 || rows.length === 0) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text("No data available.", MARGIN, doc.y);
    doc.moveDown(1);
    return;
  }

  const colWidth = CONTENT_WIDTH / headers.length;

  const measureRow = (cells: string[], font: string): number => {
    doc.font(font).fontSize(8.5);
    let max = 0;
    for (const cell of cells) {
      const h = doc.heightOfString(cell || " ", { width: colWidth - 8 });
      if (h > max) max = h;
    }
    return Math.max(max + 8, 16);
  };

  const drawRow = (
    cells: string[],
    height: number,
    font: string,
    color: string,
  ): void => {
    let x = MARGIN;
    for (const cell of cells) {
      doc
        .font(font)
        .fontSize(8.5)
        .fillColor(color)
        .text(cell, x + 4, doc.y + 4, {
          width: colWidth - 8,
          height: height - 4,
          ellipsis: true,
        });
      x += colWidth;
    }
    doc.y += height;
  };

  const drawHeader = (): void => {
    const h = measureRow(headers, "Helvetica-Bold");
    doc.rect(MARGIN, doc.y, CONTENT_WIDTH, h).fillColor(primary).fill();
    drawRow(headers, h, "Helvetica-Bold", "#ffffff");
  };

  ensureSpace(doc, 60);
  drawHeader();

  for (let r = 0; r < rows.length; r++) {
    const cells = (rows[r] ?? []).map(cellText);
    const h = measureRow(cells, "Helvetica");
    if (doc.y + h > CONTENT_BOTTOM) {
      doc.addPage();
      doc.y = CONTENT_TOP;
      drawHeader(); // repeated header after page break
    }
    if (r % 2 === 1) {
      doc.rect(MARGIN, doc.y, CONTENT_WIDTH, h).fillColor(COLOR_ZEBRA).fill();
    }
    drawRow(cells, h, "Helvetica", COLOR_TEXT);
  }

  doc
    .strokeColor(COLOR_RULE)
    .lineWidth(0.5)
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.x = MARGIN;
  doc.moveDown(1);
}

// ─── Chart (no chart library — plain rectangles) ─────────────────

function renderChart(
  doc: PdfDoc,
  section: Extract<ReportDocumentSection, { kind: "chart" }>,
  primary: string,
): void {
  const dataset = section.datasets[0];
  if (!dataset || dataset.data.length === 0 || section.labels.length === 0) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text("Chart: no data available.", MARGIN, doc.y);
    doc.moveDown(1);
    return;
  }

  if (section.chartType !== "bar" || section.datasets.length > 1) {
    // Non-bar / multi-series charts degrade to a value table — the
    // engine must not pull in a chart library (see task constraints).
    renderTable(
      doc,
      ["Label", ...section.datasets.map((ds) => ds.label)],
      section.labels.map((label, i) => [
        label,
        ...section.datasets.map((ds) => ds.data[i] ?? 0),
      ]),
      primary,
    );
    return;
  }

  // Horizontal bar rows: label | scaled bar | value
  const labelWidth = 170;
  const valueWidth = 48;
  const barMax = CONTENT_WIDTH - labelWidth - valueWidth - 12;
  const maxVal = Math.max(...dataset.data, 1);
  const rowH = 18;

  for (let i = 0; i < section.labels.length; i++) {
    ensureSpace(doc, rowH + 2);
    const y = doc.y;
    const value = dataset.data[i] ?? 0;
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLOR_TEXT)
      .text(section.labels[i] ?? "", MARGIN, y + 3, {
        width: labelWidth - 6,
        lineBreak: false,
        ellipsis: true,
      });
    const barX = MARGIN + labelWidth;
    doc
      .rect(barX, y + 3, barMax, 10)
      .fillColor("#e5e7eb")
      .fill();
    if (value > 0) {
      doc
        .rect(barX, y + 3, (barMax * value) / maxVal, 10)
        .fillColor(COLOR_BAR)
        .fill();
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(primary)
      .text(String(value), barX + barMax + 6, y + 3, {
        width: valueWidth,
        align: "right",
        lineBreak: false,
      });
    doc.y = y + rowH;
    doc.x = MARGIN;
  }
  doc.moveDown(0.8);
}

// ─── Utilities ───────────────────────────────────────────────────

function ensureSpace(doc: PdfDoc, needed: number): void {
  if (doc.y + needed > CONTENT_BOTTOM) {
    doc.addPage();
    doc.y = CONTENT_TOP;
    doc.x = MARGIN;
  }
}
