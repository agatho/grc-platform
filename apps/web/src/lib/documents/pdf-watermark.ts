// Controlled-copy watermarking for PDF downloads (DMS).
//
// ISO 9001/27001 document-control practice: electronic copies of
// released (published) documents are only controlled inside the DMS;
// anything handed out must be marked so a printed/saved copy is
// recognizably UNCONTROLLED. We stamp a footer line on every page:
//
//   <Titel> · v<versionLabel> · freigegeben <Datum> ·
//   Abgerufen von <User> am <Datum> · Unkontrollierte Kopie nach Ausdruck
//
// Implementation: pdf-lib (pure JS, no native binaries) — the only
// library in the workspace able to modify EXISTING PDFs (pdfkit can
// only author new ones). Non-PDF files are never modified.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface ControlledCopyInfo {
  title: string;
  versionLabel: string | null;
  /** Release/publication date of the document (null → omitted). */
  releasedAt: Date | null;
  /** Display name (or email) of the downloading user. */
  retrievedBy: string;
  retrievedAt: Date;
}

function formatDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getUTCFullYear()}`;
}

/**
 * Helvetica (WinAnsi) cannot encode characters outside Latin-1;
 * replace them so drawText never throws on exotic user/title chars.
 */
function toWinAnsiSafe(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    out += code >= 32 && code <= 255 ? ch : "?";
  }
  return out;
}

export function buildControlledCopyFooter(info: ControlledCopyInfo): string {
  const parts: string[] = [info.title];
  if (info.versionLabel) parts.push(`v${info.versionLabel}`);
  if (info.releasedAt) parts.push(`freigegeben ${formatDate(info.releasedAt)}`);
  parts.push(
    `Abgerufen von ${info.retrievedBy} am ${formatDate(info.retrievedAt)}`,
  );
  parts.push("Unkontrollierte Kopie nach Ausdruck");
  return parts.join(" · ");
}

/**
 * Stamp the controlled-copy footer onto every page of a PDF.
 * @throws when the input is not a loadable PDF (caller decides the
 *         fallback — the download routes serve the original bytes and
 *         flag the response with X-Controlled-Copy: error).
 */
export async function stampControlledCopy(
  pdfBytes: Buffer,
  info: ControlledCopyInfo,
): Promise<Buffer> {
  const doc = await PDFDocument.load(new Uint8Array(pdfBytes));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fullText = toWinAnsiSafe(buildControlledCopyFooter(info));
  const fontSize = 7;

  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    const maxWidth = width - 40;
    let text = fullText;
    while (
      text.length > 20 &&
      font.widthOfTextAtSize(text, fontSize) > maxWidth
    ) {
      text = `${text.slice(0, -12).trimEnd()}…`;
    }
    // pdf-lib's WinAnsi encoder rejects '…' (U+2026 is in WinAnsi at
    // 0x85, which pdf-lib supports) — keep it simple and ASCII-safe:
    text = text.replace(/…/g, "...");
    page.drawText(text, {
      x: 20,
      y: 10,
      size: fontSize,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  }

  return Buffer.from(await doc.save());
}
