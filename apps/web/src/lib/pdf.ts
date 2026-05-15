// PDF rendering for compliance exports.
//
// #WAVE11-P1-EXPORT: ditched the Puppeteer/Chromium pipeline. Two
// previous waves tried to make Alpine + headless Chrome reliable
// (PR #136 installed system chromium; #138 added the executablePath
// pass-through) and both QA waves still found the endpoints serving
// text/html. The fallback path was triggering in production for
// reasons that were hard to diagnose without Hetzner shell access.
//
// pdfkit is a pure-Node PDF library with no native deps. It always
// produces a valid PDF (correct %PDF- magic bytes, openable in any
// viewer) and works the same in dev, CI, and production. The styling
// is plainer than Puppeteer's HTML rendering, but GoBD §147 only
// requires "archivsicheres Format" — a clean text+table PDF satisfies
// that. Rich layouts can be revisited later by going back to
// Puppeteer with a properly sealed Chromium image.
//
// Endpoints that previously imported renderHtmlToPdfResponse keep
// working: that function now delegates to renderStructuredPdfResponse
// after extracting structured content from the HTML. Endpoints that
// already had structured data should call renderStructuredPdfResponse
// directly.

import PDFDocument from "pdfkit";
import { log } from "@/lib/logger";

// ─── Structured-content shape ────────────────────────────────────

export interface PdfKpi {
  label: string;
  value: string | number;
  trend?: "ok" | "warn" | "crit";
}

export type PdfRow = Array<string | number | null | undefined>;

export interface PdfTable {
  headers: string[];
  rows: PdfRow[];
}

export interface PdfSection {
  heading: string;
  paragraph?: string;
  kpis?: PdfKpi[];
  table?: PdfTable;
  notes?: string[];
}

export interface PdfReport {
  title: string;
  subtitle?: string;
  orgName?: string;
  generatedAt?: Date;
  sections: PdfSection[];
}

// ─── Renderer ────────────────────────────────────────────────────

/**
 * Render a structured PDF report and return it as a Next.js Response.
 * Always produces application/pdf with valid magic bytes.
 */
export async function renderStructuredPdfResponse(
  report: PdfReport,
  baseFilename: string,
): Promise<Response> {
  const safeBase = baseFilename.replace(/[^a-zA-Z0-9\-_]/g, "_");

  try {
    const buffer = await renderStructuredPdfBuffer(report);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeBase}.pdf"`,
      },
    });
  } catch (err) {
    // pdfkit doesn't depend on anything that can fail at runtime —
    // if this branch fires, something is genuinely broken (corrupt
    // input, OOM). Surface a 503 with the underlying message rather
    // than the legacy text/html fallback that masqueraded as a PDF.
    log
      .withContext({ component: "pdf", baseFilename: safeBase })
      .error("pdfkit render failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    return new Response(
      JSON.stringify({
        type: "https://arctos.charliehund.de/errors/pdf-render-failed",
        title: "PDF generation failed",
        status: 503,
        detail: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/problem+json; charset=utf-8",
        },
      },
    );
  }
}

// Exported (Wave-21-B9) so the /export/{entityType}?format=pdf path
// can produce structured PDFs without spinning up the Response wrapper.
export function renderStructuredPdfBuffer(report: PdfReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: report.title,
          Author: report.orgName ?? "ARCTOS",
          Creator: "ARCTOS GRC Platform",
          Producer: "ARCTOS PDF v1 (pdfkit)",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Cover.
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor("#1e3a5f")
        .text(report.title, { align: "left" });
      if (report.subtitle) {
        doc
          .moveDown(0.3)
          .font("Helvetica")
          .fontSize(11)
          .fillColor("#6b7280")
          .text(report.subtitle, { align: "left" });
      }
      const meta: string[] = [];
      if (report.orgName) meta.push(`Organisation: ${report.orgName}`);
      meta.push(
        `Generiert: ${(report.generatedAt ?? new Date()).toLocaleString("de-DE")}`,
      );
      doc
        .moveDown(0.5)
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#9ca3af")
        .text(meta.join("  ·  "));

      doc.moveDown(1);
      doc
        .strokeColor("#1e3a5f")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
      doc.moveDown(0.5);

      // Sections.
      for (const section of report.sections) {
        renderSection(doc, section);
      }

      // Footer on every page.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#9ca3af")
          .text(
            `${report.title} — Seite ${i + 1} von ${range.count}`,
            50,
            800,
            { align: "center", width: 495 },
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function renderSection(doc: PDFKit.PDFDocument, section: PdfSection): void {
  // Avoid orphaned headings: if there's not enough room for the
  // heading + first row of content, push to a new page.
  if (doc.y > 720) doc.addPage();

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#1e3a5f")
    .text(section.heading);
  doc.moveDown(0.3);

  if (section.paragraph) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#1a1a1a")
      .text(section.paragraph);
    doc.moveDown(0.5);
  }

  if (section.kpis && section.kpis.length > 0) {
    renderKpiRow(doc, section.kpis);
    doc.moveDown(0.8);
  }

  if (section.table) {
    renderTable(doc, section.table);
    doc.moveDown(0.5);
  }

  if (section.notes && section.notes.length > 0) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#6b7280");
    for (const note of section.notes) {
      doc.text(`· ${note}`);
    }
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);
}

function renderKpiRow(doc: PDFKit.PDFDocument, kpis: PdfKpi[]): void {
  const startX = 50;
  const totalWidth = 495;
  const gap = 8;
  const cardWidth = (totalWidth - gap * (kpis.length - 1)) / kpis.length;
  const cardHeight = 50;
  const startY = doc.y;

  for (let i = 0; i < kpis.length; i++) {
    const kpi = kpis[i];
    const x = startX + i * (cardWidth + gap);
    const color =
      kpi.trend === "crit"
        ? "#991b1b"
        : kpi.trend === "warn"
          ? "#854d0e"
          : "#1e3a5f";

    doc
      .rect(x, startY, cardWidth, cardHeight)
      .strokeColor("#e2e8f0")
      .lineWidth(0.5)
      .stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(color)
      .text(String(kpi.value), x, startY + 8, {
        width: cardWidth,
        align: "center",
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text(kpi.label, x, startY + 30, {
        width: cardWidth,
        align: "center",
      });
  }

  doc.y = startY + cardHeight;
}

function renderTable(doc: PDFKit.PDFDocument, table: PdfTable): void {
  const startX = 50;
  const totalWidth = 495;
  const headers = table.headers;
  const colWidth = totalWidth / headers.length;
  const rowHeight = 18;
  const headerHeight = 22;

  // Header row.
  doc.rect(startX, doc.y, totalWidth, headerHeight).fillColor("#f1f5f9").fill();
  for (let c = 0; c < headers.length; c++) {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#1e3a5f")
      .text(headers[c], startX + c * colWidth + 4, doc.y - headerHeight + 6, {
        width: colWidth - 8,
        height: headerHeight - 6,
        ellipsis: true,
      });
  }
  let y = doc.y;

  // Data rows.
  for (let r = 0; r < table.rows.length; r++) {
    if (y > 760) {
      doc.addPage();
      y = doc.y;
    }
    if (r % 2 === 1) {
      doc.rect(startX, y, totalWidth, rowHeight).fillColor("#f8fafc").fill();
    }
    for (let c = 0; c < headers.length; c++) {
      const cell = table.rows[r][c];
      const text = cell == null ? "" : String(cell);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#1a1a1a")
        .text(text, startX + c * colWidth + 4, y + 5, {
          width: colWidth - 8,
          height: rowHeight - 4,
          ellipsis: true,
        });
    }
    y += rowHeight;
  }

  doc.y = y + 4;
  doc
    .strokeColor("#e2e8f0")
    .lineWidth(0.5)
    .moveTo(startX, y)
    .lineTo(startX + totalWidth, y)
    .stroke();
}

// ─── HTML escape (kept for compatibility with HTML-building helpers
//     that some routes still use for screen rendering before they
//     migrate to structured PDF input) ──────────────────────────────

export function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @deprecated use STANDARD_PDF_CSS only for the HTML preview, not PDFs. */
export const STANDARD_PDF_CSS = `
  @page { size: A4; margin: 2cm; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.55; color: #1a1a1a; }
  h1 { font-size: 24pt; color: #1e3a5f; margin-bottom: 4px; }
  h2 { font-size: 14pt; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-top: 24px; page-break-after: avoid; }
  h3 { font-size: 12pt; color: #374151; margin-top: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; }
  th { background: #f1f5f9; color: #1e3a5f; text-align: left; padding: 6px 8px; border: 1px solid #e2e8f0; }
  td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) { background: #f8fafc; }
`;

// ─── Backwards-compatible HTML→PDF shim ──────────────────────────
//
// The Wave-7 helper accepted an HTML string. Existing routes still
// build HTML; we extract a minimal structure (title + body text) so
// they keep working without each route having to be rewritten in this
// PR. New routes should call renderStructuredPdfResponse directly.

export async function renderHtmlToPdfResponse(
  html: string,
  baseFilename: string,
): Promise<Response> {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch
    ? stripTags(titleMatch[1])
    : baseFilename.replace(/_/g, " ");

  const sections: PdfSection[] = [];
  // Capture each <h2> ... up to next <h2> (or end) as one section.
  const sectionRe = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*>|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(html)) !== null) {
    const heading = stripTags(m[1]).trim();
    const body = m[2];
    sections.push({
      heading,
      paragraph: extractParagraphs(body),
    });
  }
  if (sections.length === 0) {
    // Fallback: dump the body text in one section.
    sections.push({
      heading: "Inhalt",
      paragraph: extractParagraphs(html),
    });
  }

  return renderStructuredPdfResponse(
    {
      title,
      sections,
      generatedAt: new Date(),
    },
    baseFilename,
  );
}

// CodeQL js/double-escaping note: replacing `&amp;` before the other
// named entities would cause an input like `&amp;lt;` to become `&lt;`
// and then `<` — double-unescaping that doesn't match the source. We
// decode every named entity in a single pass via one regex + a lookup
// map. `&amp;` is the last fallback so `&amp;amp;` correctly becomes
// `&amp;` (one round of unescaping).
const HTML_ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&auml;": "ä",
  "&ouml;": "ö",
  "&uuml;": "ü",
  "&Auml;": "Ä",
  "&Ouml;": "Ö",
  "&Uuml;": "Ü",
  "&szlig;": "ß",
  "&amp;": "&",
};

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(
      /&(?:nbsp|lt|gt|quot|auml|ouml|uuml|Auml|Ouml|Uuml|szlig|amp);/g,
      (m) => HTML_ENTITY_MAP[m] ?? m,
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extractParagraphs(html: string): string {
  // Strip HTML tags, collapse whitespace. The output is a single
  // paragraph per section — good enough for the PDF compliance baseline.
  return stripTags(html);
}
