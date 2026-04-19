// Shared helper: render an HTML string into a PDF buffer via Puppeteer,
// with a plain-HTML fallback when Puppeteer isn't available. Used by the
// monitor export endpoints so the puppeteer wiring lives in exactly one place.

export interface PdfResponse {
  body: Buffer | string;
  contentType: "application/pdf" | "text/html; charset=utf-8";
  filename: string;
}

export async function renderHtmlToPdfResponse(
  html: string,
  baseFilename: string,
): Promise<Response> {
  const safeBase = baseFilename.replace(/[^a-zA-Z0-9\-_]/g, "_");
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", bottom: "2.5cm", left: "2cm", right: "2cm" },
    });
    await browser.close();

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeBase}.pdf"`,
      },
    });
  } catch {
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeBase}.html"`,
      },
    });
  }
}

export function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Standard A4 print CSS block used by all monitor PDFs. */
export const STANDARD_PDF_CSS = `
  @page { size: A4; margin: 2cm; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.55; color: #1a1a1a; }
  h1 { font-size: 24pt; color: #1e3a5f; margin-bottom: 4px; }
  h2 { font-size: 14pt; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-top: 24px; page-break-after: avoid; }
  h3 { font-size: 12pt; color: #374151; margin-top: 14px; }
  .cover { text-align: center; padding: 48px 0 32px; }
  .cover h1 { font-size: 28pt; }
  .cover .subtitle { font-size: 13pt; color: #6b7280; margin-top: 8px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-weight: 600; font-size: 9pt; }
  .badge-critical-overdue { background: #fecaca; color: #7f1d1d; }
  .badge-overdue { background: #fee2e2; color: #991b1b; }
  .badge-approaching { background: #fef9c3; color: #854d0e; }
  .badge-ok { background: #dcfce7; color: #166534; }
  .kpi-grid { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
  .kpi-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 16px; min-width: 110px; text-align: center; flex: 1; }
  .kpi-value { font-size: 20pt; font-weight: 700; color: #1e3a5f; }
  .kpi-label { font-size: 9pt; color: #64748b; margin-top: 2px; }
  .kpi-card.red .kpi-value { color: #991b1b; }
  .kpi-card.amber .kpi-value { color: #854d0e; }
  .kpi-card.green .kpi-value { color: #166534; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; }
  th { background: #f1f5f9; color: #1e3a5f; text-align: left; padding: 6px 8px; border: 1px solid #e2e8f0; }
  td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) { background: #f8fafc; }
  .text-red { color: #991b1b; font-weight: 600; }
  .text-emerald { color: #059669; }
  .text-amber { color: #b45309; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #9ca3af; padding-top: 4px; }
  .empty { color: #9ca3af; font-style: italic; padding: 16px; text-align: center; }
`;
