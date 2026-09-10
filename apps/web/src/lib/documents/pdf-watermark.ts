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
//
// ── #S06-06 (ARCTOS-FULL-2026-08-31, High): fail-closed ─────────────
// The stamping step used to throw a bare Error, and both download
// routes caught it, served the ORIGINAL bytes and skipped the audit
// entry. A PDF carrying nothing but an owner password (permissions
// protection — opens in every reader without a prompt) was therefore a
// one-click, unlogged bypass of the whole controlled-copy control.
//
// Verified against the audit PoC (evidence/S06/poc_owner_pw_only.pdf):
// `PDFDocument.load(bytes, { ignoreEncryption: true })` — the fix the
// finding suggested — does NOT help. pdf-lib skips the encryption check
// but still cannot parse the encrypted object streams:
//   "Expected instance of PDFDict, but got instance of undefined".
// There is no pure-JS decryptor in the workspace, so "stamp it anyway"
// is not reachable. The remaining honest options are refuse or mark —
// this module therefore reports WHY stamping is impossible, and the
// callers refuse the download (and always log it) instead of silently
// handing out an unmarked original.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Cap for in-memory stamping (#S06-18): pdf-lib holds the parsed
 *  document plus the serialized copy, so a 50 MB upload costs several
 *  hundred MB of heap. Beyond this the download is refused rather than
 *  risking an OOM of the whole web container. */
export const MAX_WATERMARK_BYTES = Number(
  process.env.WATERMARK_MAX_BYTES ?? 20 * 1024 * 1024,
);

/**
 * #S06-18 — bound the number of PDFs being stamped at the same time.
 *
 * Every stamping operation holds the source buffer, pdf-lib's parsed
 * object graph and the serialized copy simultaneously. With a 50 MB
 * upload limit and `mem_limit: 1600m` on the web container, a dozen
 * concurrent downloads of released PDFs are enough for an OOM — and
 * there is neither streaming nor a concurrency limit on these routes.
 * Real streaming would mean replacing pdf-lib, which is out of scope
 * here; this queue makes the memory ceiling predictable instead of
 * proportional to request concurrency.
 */
const MAX_CONCURRENT_STAMPS = Number(process.env.WATERMARK_MAX_CONCURRENT ?? 4);

let activeStamps = 0;
const stampQueue: Array<() => void> = [];

async function withStampSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeStamps >= MAX_CONCURRENT_STAMPS) {
    await new Promise<void>((resolve) => stampQueue.push(resolve));
  }
  activeStamps++;
  try {
    return await fn();
  } finally {
    activeStamps--;
    const next = stampQueue.shift();
    if (next) next();
  }
}

export type WatermarkFailureReason =
  /** PDF is encrypted (owner and/or user password) — pdf-lib cannot
   *  decrypt, so no marked copy can be produced. */
  | "encrypted"
  /** Not a PDF / structurally broken beyond pdf-lib's parser. */
  | "unloadable"
  /** Larger than MAX_WATERMARK_BYTES — refused before parsing. */
  | "too_large"
  /** Loaded, but drawing or serializing failed. */
  | "stamp_failed";

export class WatermarkError extends Error {
  readonly reason: WatermarkFailureReason;
  constructor(reason: WatermarkFailureReason, message: string) {
    super(message);
    this.name = "WatermarkError";
    this.reason = reason;
  }
}

export interface ControlledCopyInfo {
  title: string;
  versionLabel: string | null;
  /** Release/publication date of the document (null → omitted). */
  releasedAt: Date | null;
  /** Display name (or email) of the downloading user. */
  retrievedBy: string;
  retrievedAt: Date;
  /**
   * #S06-07: lifecycle status of the document at download time. For
   * `archived` / `expired` the footer additionally states that the copy
   * is a superseded revision — exactly the case where an unmarked
   * printout does the most damage.
   */
  documentStatus?: string | null;
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

/** The invariant tail of every controlled-copy footer. Tests and the
 *  truncation loop below both key off this constant. */
export const CONTROLLED_COPY_MARKER = "Unkontrollierte Kopie nach Ausdruck";

/** #S06-07 — status suffixes for non-current revisions. */
const STATUS_MARKER: Record<string, string> = {
  archived: "ARCHIVIERTE FASSUNG - NICHT GUELTIG",
  expired: "ABGELAUFENE FASSUNG - NICHT GUELTIG",
  approved: "FREIGEGEBEN, NOCH NICHT VEROEFFENTLICHT",
  draft: "ENTWURF",
  in_review: "IN PRUEFUNG",
};

export function buildControlledCopyFooter(info: ControlledCopyInfo): string {
  const parts: string[] = [info.title];
  if (info.versionLabel) parts.push(`v${info.versionLabel}`);
  if (info.releasedAt) parts.push(`freigegeben ${formatDate(info.releasedAt)}`);
  parts.push(
    `Abgerufen von ${info.retrievedBy} am ${formatDate(info.retrievedAt)}`,
  );
  const statusMarker = info.documentStatus
    ? STATUS_MARKER[info.documentStatus]
    : undefined;
  if (statusMarker) parts.push(statusMarker);
  parts.push(CONTROLLED_COPY_MARKER);
  return parts.join(" · ");
}

/** Heuristic: does this byte range declare an /Encrypt dictionary?
 *  Used to turn pdf-lib's generic parse failures into the precise
 *  reason the callers report and log. */
export function pdfDeclaresEncryption(pdfBytes: Uint8Array): boolean {
  // /Encrypt only ever appears in the trailer; scanning the whole
  // buffer is still cheap compared to parsing and avoids depending on
  // where the trailer sits (linearized / incremental updates).
  const needle = Buffer.from("/Encrypt");
  return Buffer.from(
    pdfBytes.buffer,
    pdfBytes.byteOffset,
    pdfBytes.byteLength,
  ).includes(needle);
}

function classifyLoadError(pdfBytes: Uint8Array, err: unknown): WatermarkError {
  const message = err instanceof Error ? err.message : String(err);
  if (/encrypted/i.test(message) || pdfDeclaresEncryption(pdfBytes)) {
    return new WatermarkError(
      "encrypted",
      `PDF is encrypted and cannot be watermarked (${message})`,
    );
  }
  return new WatermarkError(
    "unloadable",
    `PDF could not be parsed for watermarking (${message})`,
  );
}

/**
 * Stamp the controlled-copy footer onto every page of a PDF.
 *
 * @throws {WatermarkError} with a machine-readable `reason`. Callers
 *         MUST NOT fall back to serving the unmarked original — see the
 *         module header; the download routes refuse with 422 and write
 *         an audit entry.
 */
export async function stampControlledCopy(
  pdfBytes: Buffer,
  info: ControlledCopyInfo,
): Promise<Buffer> {
  return withStampSlot(() => stampInner(pdfBytes, info));
}

async function stampInner(
  pdfBytes: Buffer,
  info: ControlledCopyInfo,
): Promise<Buffer> {
  if (pdfBytes.length > MAX_WATERMARK_BYTES) {
    throw new WatermarkError(
      "too_large",
      `PDF is ${pdfBytes.length} bytes, above the ${MAX_WATERMARK_BYTES}-byte watermarking limit`,
    );
  }

  const input = new Uint8Array(pdfBytes);
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(input);
  } catch (err) {
    throw classifyLoadError(input, err);
  }

  try {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fullText = toWinAnsiSafe(buildControlledCopyFooter(info));
    const fontSize = 7;
    // Keep the marker itself intact even when the title is long: only
    // the leading part is shortened (#S06-17 — the old loop chopped
    // from the right and could eat the marker entirely).
    const marker = toWinAnsiSafe(` · ${CONTROLLED_COPY_MARKER}`);
    const head = fullText.endsWith(marker)
      ? fullText.slice(0, -marker.length)
      : fullText;

    for (const page of doc.getPages()) {
      const { width } = page.getSize();
      const maxWidth = width - 40;
      let text = fullText;
      let shortHead = head;
      while (
        shortHead.length > 8 &&
        font.widthOfTextAtSize(text, fontSize) > maxWidth
      ) {
        shortHead = `${shortHead.slice(0, -12).trimEnd()}...`;
        text = `${shortHead}${marker}`;
      }
      page.drawText(text, {
        // y: 14 keeps the baseline clear of the trim edge; 10 was inside
        // the typical 0.5 cm non-printable margin (#S06-17).
        x: 20,
        y: 14,
        size: fontSize,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
    }

    return Buffer.from(await doc.save());
  } catch (err) {
    throw new WatermarkError(
      "stamp_failed",
      `Watermark could not be applied (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}

export interface StampabilityResult {
  ok: boolean;
  reason?: WatermarkFailureReason;
  message?: string;
}

/**
 * #S06-06 upload-side guard: can this PDF be watermarked at all?
 *
 * Rejecting an unstampable PDF at upload time is the only place where
 * the user still has the original and can re-export it without the
 * permissions password. Once it is in the DMS, every later download is
 * a choice between refusing a legitimate request and handing out an
 * unmarked copy.
 */
export async function checkPdfStampable(
  pdfBytes: Buffer,
): Promise<StampabilityResult> {
  try {
    await stampControlledCopy(pdfBytes, {
      title: "stampability-probe",
      versionLabel: null,
      releasedAt: null,
      retrievedBy: "probe",
      retrievedAt: new Date(0),
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof WatermarkError) {
      return { ok: false, reason: err.reason, message: err.message };
    }
    return {
      ok: false,
      reason: "stamp_failed",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
