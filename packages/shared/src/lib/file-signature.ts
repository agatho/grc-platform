// #S04-06 (ARCTOS-FULL-2026-08-31, Low) — upload MIME checks trusted the
// client-supplied `Content-Type`.
//
//   if (!ALLOWED_MIMES.has(file.type)) { … 415 … }
//
// `file.type` comes straight from the multipart part header and is freely
// chosen by the uploader. Any content could therefore be stored (and later
// served) as `application/pdf`: the persisted `mimeType` — and thus the
// `Content-Type` on download — inherited the forged value. The optional
// ClamAV scan only catches known signatures and defaults to fail-open.
//
// This module adds the missing layer: identify the file from its actual
// leading bytes and compare that against the caller's allowlist. It is
// deliberately dependency-free (a `file-type` dependency would pull ESM-only
// transitive packages into both the Next.js and worker builds) and covers
// exactly the container formats the product accepts.
//
// Design notes:
//  - The *sniffed* type is authoritative. Callers persist it instead of
//    `file.type`, which is what closes the "stored as application/pdf"
//    half of the finding.
//  - Formats with no reliable magic bytes (CSV, plain text, XML/SVG) are
//    reported as `null` "unknown"; callers decide per-context whether an
//    unknown-but-textual payload is acceptable. `allowUnknownForText`
//    exists for CSV imports, where refusing everything unsniffable would
//    break the feature.

export interface MagicSignature {
  /** Canonical MIME type this signature identifies. */
  mime: string;
  /** Byte pattern; `null` entries are wildcards. */
  bytes: Array<number | null>;
  /** Offset at which `bytes` must match. */
  offset?: number;
  /** Human label for diagnostics. */
  label: string;
}

/**
 * Ordered longest-prefix-first; the first match wins.
 *
 * ZIP-based Office formats (xlsx/docx/pptx) all start with `PK\x03\x04`
 * and can only be distinguished by reading the archive's content types.
 * `sniffFileType` reports the generic `application/zip` for them and
 * `verifyUploadSignature` treats it as compatible with any OOXML MIME in
 * the allowlist — combined with the caller's extension check and the
 * decompression-bomb guard (`zip-safety.ts`) that is the right trade-off:
 * a renamed .docx uploaded as .xlsx fails in the parser, not in a shell.
 */
export const MAGIC_BYTE_SIGNATURES: MagicSignature[] = [
  { label: "PDF", mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  {
    label: "ZIP / OOXML / ODF",
    mime: "application/zip",
    bytes: [0x50, 0x4b, 0x03, 0x04],
  },
  {
    label: "ZIP (empty archive)",
    mime: "application/zip",
    bytes: [0x50, 0x4b, 0x05, 0x06],
  },
  {
    label: "ZIP (spanned)",
    mime: "application/zip",
    bytes: [0x50, 0x4b, 0x07, 0x08],
  },
  {
    label: "Legacy MS Office (OLE2 / .doc .xls .msi)",
    mime: "application/x-ole-storage",
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  },
  {
    label: "PNG",
    mime: "image/png",
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { label: "JPEG", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  {
    label: "GIF87a",
    mime: "image/gif",
    bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
  },
  {
    label: "GIF89a",
    mime: "image/gif",
    bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  },
  {
    label: "WEBP",
    mime: "image/webp",
    bytes: [
      0x52,
      0x49,
      0x46,
      0x46,
      null,
      null,
      null,
      null,
      0x57,
      0x45,
      0x42,
      0x50,
    ],
  },
  { label: "BMP", mime: "image/bmp", bytes: [0x42, 0x4d] },
  { label: "ICO", mime: "image/x-icon", bytes: [0x00, 0x00, 0x01, 0x00] },
  {
    label: "RTF",
    mime: "application/rtf",
    bytes: [0x7b, 0x5c, 0x72, 0x74, 0x66],
  },
  // Executable / archive formats that must never be accepted as a document.
  {
    label: "Windows PE",
    mime: "application/x-msdownload",
    bytes: [0x4d, 0x5a],
  },
  {
    label: "ELF",
    mime: "application/x-executable",
    bytes: [0x7f, 0x45, 0x4c, 0x46],
  },
  {
    label: "Mach-O (64-bit)",
    mime: "application/x-mach-binary",
    bytes: [0xcf, 0xfa, 0xed, 0xfe],
  },
  { label: "GZIP", mime: "application/gzip", bytes: [0x1f, 0x8b] },
  {
    label: "RAR",
    mime: "application/vnd.rar",
    bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07],
  },
  {
    label: "7-Zip",
    mime: "application/x-7z-compressed",
    bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
  },
  { label: "Shell script", mime: "text/x-shellscript", bytes: [0x23, 0x21] }, // #!
];

/** MIME types that must never be stored, whatever the allowlist says. */
export const ALWAYS_FORBIDDEN_MIMES = new Set([
  "application/x-msdownload",
  "application/x-executable",
  "application/x-mach-binary",
  "text/x-shellscript",
]);

/**
 * OOXML / ODF MIME types that legitimately arrive as a ZIP container.
 * A sniffed `application/zip` is accepted when the declared type is one of
 * these (or when `application/zip` itself is allowed).
 */
const ZIP_CONTAINER_MIMES = new Set([
  "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/epub+zip",
]);

export interface SniffedFileType {
  mime: string;
  label: string;
}

function matches(buf: Uint8Array, sig: MagicSignature): boolean {
  const offset = sig.offset ?? 0;
  if (buf.length < offset + sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i++) {
    const expected = sig.bytes[i];
    if (expected === null) continue;
    if (buf[offset + i] !== expected) return false;
  }
  return true;
}

/**
 * Identify a buffer from its leading bytes.
 * Returns `null` when no signature matches (CSV, plain text, XML, SVG…).
 */
export function sniffFileType(buffer: Uint8Array): SniffedFileType | null {
  for (const sig of MAGIC_BYTE_SIGNATURES) {
    if (matches(buffer, sig)) return { mime: sig.mime, label: sig.label };
  }
  return null;
}

/** Heuristic: does the buffer look like UTF-8/ASCII text rather than binary? */
export function looksLikeText(buffer: Uint8Array, sampleSize = 4096): boolean {
  const limit = Math.min(buffer.length, sampleSize);
  if (limit === 0) return true;
  let suspicious = 0;
  // [OP-065] `for (const b of buffer.subarray(0, limit))` statt `buffer[i]`:
  // der Wert kommt aus der Iteration und ist deshalb kein `number | undefined`
  // mehr. Ohne das war `b` als `number` deklariert und konnte `undefined`
  // sein — und `undefined >= 0x20` ist falsch, `undefined < 0x80` ebenfalls,
  // ein solches Byte wäre also weder als druckbar noch als verdächtig gezählt
  // worden. Die Schranke `limit` macht das unerreichbar, aber sichtbar war
  // das nirgends.
  for (const b of buffer.subarray(0, limit)) {
    // NUL is the strongest binary indicator.
    if (b === 0x00) return false;
    const isPrintable =
      b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e);
    // Bytes >= 0x80 are legitimate UTF-8 continuation/lead bytes.
    if (!isPrintable && b < 0x80) suspicious++;
  }
  return suspicious / limit < 0.05;
}

export interface UploadSignatureResult {
  ok: boolean;
  /**
   * The MIME type the caller should PERSIST. Never the client-declared
   * value when a signature was recognised.
   */
  detectedMime?: string;
  /** Diagnostic label of the matched signature. */
  label?: string;
  /** Refusal reason when `ok` is false. */
  reason?: string;
}

export interface VerifyUploadOptions {
  /** MIME types the caller accepts (the existing ALLOWED_MIMES set). */
  allowedMimes: Iterable<string>;
  /** Client-declared Content-Type, used only for diagnostics + ZIP mapping. */
  declaredMime?: string;
  /**
   * Accept payloads whose type cannot be sniffed when they look like text
   * (CSV, XML, plain text). Default false.
   */
  allowUnknownForText?: boolean;
}

/**
 * Verify an upload's real content type against the caller's allowlist.
 *
 * Use as the second gate, after the existing `file.type` check — the
 * declared type still filters the obvious cases cheaply, this catches the
 * forged ones.
 */
export function verifyUploadSignature(
  buffer: Uint8Array,
  options: VerifyUploadOptions,
): UploadSignatureResult {
  const allowed = new Set(options.allowedMimes);
  const sniffed = sniffFileType(buffer);

  if (!sniffed) {
    if (options.allowUnknownForText && looksLikeText(buffer)) {
      // Keep the declared type only when it was already allow-listed;
      // otherwise fall back to a neutral text type.
      const declared = options.declaredMime ?? "";
      return {
        ok: true,
        detectedMime: allowed.has(declared) ? declared : "text/plain",
        label: "unrecognised (text)",
      };
    }
    return {
      ok: false,
      reason:
        "File content does not match any accepted format (no recognisable file signature).",
    };
  }

  if (ALWAYS_FORBIDDEN_MIMES.has(sniffed.mime)) {
    return {
      ok: false,
      detectedMime: sniffed.mime,
      label: sniffed.label,
      reason: `Executable content detected (${sniffed.label}) — rejected regardless of the declared Content-Type.`,
    };
  }

  if (sniffed.mime === "application/zip") {
    // A ZIP container is acceptable when the declared type is an OOXML/ODF
    // type that the caller allows — that is what an .xlsx/.docx looks like
    // on the wire.
    const declared = options.declaredMime ?? "";
    if (allowed.has(declared) && ZIP_CONTAINER_MIMES.has(declared)) {
      return { ok: true, detectedMime: declared, label: sniffed.label };
    }
    if (allowed.has("application/zip")) {
      return {
        ok: true,
        detectedMime: "application/zip",
        label: sniffed.label,
      };
    }
    return {
      ok: false,
      detectedMime: sniffed.mime,
      label: sniffed.label,
      reason: `File is a ZIP container, which is not accepted here (declared '${declared || "none"}').`,
    };
  }

  if (!allowed.has(sniffed.mime)) {
    return {
      ok: false,
      detectedMime: sniffed.mime,
      label: sniffed.label,
      reason: `File content is ${sniffed.label} (${sniffed.mime}), which is not in the allowed list (declared '${options.declaredMime ?? "none"}').`,
    };
  }

  return { ok: true, detectedMime: sniffed.mime, label: sniffed.label };
}
