// Best-effort text extraction for DMS file attachments.
//
// The extracted text is written to document.file_text and picked up by
// the GENERATED search_vector column (migration 0368, weight C) so the
// document full-text search also matches file contents.
//
// Design rules:
//   - NEVER throws — extraction failures must not block uploads.
//   - Result is capped at MAX_EXTRACT_CHARS (500 KB) to keep the
//     tsvector within PostgreSQL limits.
//   - Coverage (deliberate, see Abschlussbericht):
//       text/* + JSON + XML + CSV/Markdown → direct UTF-8 decode
//       DOCX → unzip word/document.xml via jszip (already a direct
//              apps/web dependency), strip tags, decode entities
//       PDF  → NOT extracted. No PDF text-extraction library exists in
//              any workspace (pdfkit only writes PDFs, pdf-lib does not
//              expose text extraction) and a hand-rolled parser for
//              compressed content streams is too error-prone. Returns
//              null; PDFs remain searchable by title/content only.
//       Office binary formats (doc/xls/ppt), images → null.

export const MAX_EXTRACT_CHARS = 500 * 1024;

const TEXT_LIKE_MIMES = new Set([
  "application/json",
  "application/xml",
  "text/xml",
]);

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Strip WordprocessingML down to plain text (paragraphs → newlines). */
export function docxXmlToText(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab[^>]*\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractDocx(buffer: Buffer): Promise<string | null> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) return null;
  const xml = await entry.async("string");
  return docxXmlToText(xml);
}

/**
 * Extract plain text from an uploaded file, best effort.
 * Returns null when the format is unsupported or extraction fails.
 */
export async function extractFileText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string | null> {
  try {
    let text: string | null = null;

    if (mimeType.startsWith("text/") || TEXT_LIKE_MIMES.has(mimeType)) {
      text = buffer.toString("utf8");
    } else if (
      mimeType === DOCX_MIME ||
      (mimeType === "application/octet-stream" &&
        fileName.toLowerCase().endsWith(".docx"))
    ) {
      text = await extractDocx(buffer);
    }
    // application/pdf and everything else: unsupported → null (see
    // module header for the reasoning).

    if (!text) return null;

    // Strip NUL bytes — PostgreSQL text columns reject .
    const cleaned = text.replace(/\u0000/g, "").trim();
    if (!cleaned) return null;
    return cleaned.length > MAX_EXTRACT_CHARS
      ? cleaned.slice(0, MAX_EXTRACT_CHARS)
      : cleaned;
  } catch {
    // Extraction must never block an upload.
    return null;
  }
}
