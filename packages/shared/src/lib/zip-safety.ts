// #S04-04 (ARCTOS-FULL-2026-08-31, Medium) — XLSX decompression /
// memory-amplification bomb.
//
// Measured (evidence/S04/xlsx-decompression-bomb.txt): a *valid* .xlsx with
// ~1.85 M single-cell rows compresses to 9.3 MB — comfortably under the
// 10 MB upload limit — while its `xl/worksheets/sheet1.xml` is 134 MB
// uncompressed. `ExcelJS.Workbook.xlsx.load()` materializes the whole sheet
// as JS objects: 2.26 GB RSS in 17.5 s for that one request. A single
// authenticated upload could OOM the web container.
//
// A byte-size limit on the *upload* cannot see this: the amplification
// happens after the bytes are accepted. This module inspects the ZIP
// central directory — which records the uncompressed size of every entry —
// BEFORE a single byte is inflated, so a bomb is refused for the cost of a
// few hundred bytes of parsing.
//
// Deliberately dependency-free: the central directory is a fixed-layout
// structure and pulling a ZIP library in just to read it would add supply
// chain surface for ~80 lines of code.

/** Signatures, little-endian as stored. */
const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;

/** Maximum bytes the EOCD comment may occupy (ZIP spec: 16-bit length). */
const MAX_EOCD_COMMENT = 0xffff;

export interface ZipEntryInfo {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
}

export interface ZipInspection {
  entries: ZipEntryInfo[];
  totalCompressed: number;
  totalUncompressed: number;
  /** totalUncompressed / archive byte length. */
  ratio: number;
}

export interface ZipLimits {
  /** Sum of all uncompressed entry sizes. */
  maxTotalUncompressedBytes: number;
  /** Largest single uncompressed entry. */
  maxEntryUncompressedBytes: number;
  /** totalUncompressed / archive size. */
  maxRatio: number;
  /** Number of entries — a "zip of many files" bomb. */
  maxEntries: number;
}

/**
 * Limits tuned for spreadsheet imports. The upload routes cap the archive
 * at 10–20 MB; these caps bound what that archive is allowed to become.
 *
 * `maxTotalUncompressedBytes` (100 MB) is the load-bearing one: the
 * measured bomb expands to 134 MB and is refused, while a genuinely large
 * business spreadsheet (tens of thousands of rows) stays well under it.
 */
export const SPREADSHEET_ZIP_LIMITS: ZipLimits = {
  maxTotalUncompressedBytes: 100 * 1024 * 1024,
  maxEntryUncompressedBytes: 80 * 1024 * 1024,
  maxRatio: 150,
  maxEntries: 2048,
};

export class ZipBombError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipBombError";
  }
}

function readUInt32LE(buf: Uint8Array, off: number): number {
  return (
    (buf[off] |
      (buf[off + 1] << 8) |
      (buf[off + 2] << 16) |
      (buf[off + 3] << 24)) >>>
    0
  );
}

function readUInt16LE(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8);
}

function readUInt64LE(buf: Uint8Array, off: number): number {
  // ZIP64 sizes. Values beyond Number.MAX_SAFE_INTEGER are absurd here and
  // clamp to Infinity, which the limit check then rejects — the safe
  // direction.
  const lo = readUInt32LE(buf, off);
  const hi = readUInt32LE(buf, off + 4);
  const value = hi * 0x1_0000_0000 + lo;
  return Number.isSafeInteger(value) ? value : Number.POSITIVE_INFINITY;
}

/** Locate the End Of Central Directory record by scanning backwards. */
function findEocd(buf: Uint8Array): number {
  const minOffset = Math.max(0, buf.length - MAX_EOCD_COMMENT - 22);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (readUInt32LE(buf, i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

/**
 * Parse the ZIP central directory and report per-entry sizes.
 *
 * Throws {@link ZipBombError} when the archive is not a readable ZIP —
 * callers treat "cannot inspect" as "do not inflate", because inflating an
 * archive we could not measure is exactly the case this guard exists for.
 */
export function inspectZipArchive(buffer: Uint8Array): ZipInspection {
  if (buffer.length < 22) {
    throw new ZipBombError("File is too small to be a valid ZIP/XLSX archive.");
  }

  const eocd = findEocd(buffer);
  if (eocd < 0) {
    throw new ZipBombError(
      "No ZIP end-of-central-directory record found — not a valid XLSX archive.",
    );
  }

  let entryCount = readUInt16LE(buffer, eocd + 10);
  let cdOffset = readUInt32LE(buffer, eocd + 16);

  // ZIP64: the 32-bit fields saturate and the real values live in the
  // ZIP64 EOCD record pointed at by the ZIP64 locator just before the EOCD.
  if (entryCount === 0xffff || cdOffset === 0xffffffff) {
    const locator = eocd - 20;
    if (
      locator >= 0 &&
      readUInt32LE(buffer, locator) === ZIP64_EOCD_LOCATOR_SIGNATURE
    ) {
      const zip64Eocd = readUInt64LE(buffer, locator + 8);
      if (
        Number.isFinite(zip64Eocd) &&
        zip64Eocd >= 0 &&
        zip64Eocd + 56 <= buffer.length &&
        readUInt32LE(buffer, zip64Eocd) === ZIP64_EOCD_SIGNATURE
      ) {
        entryCount = readUInt64LE(buffer, zip64Eocd + 32);
        cdOffset = readUInt64LE(buffer, zip64Eocd + 48);
      }
    }
  }

  if (!Number.isFinite(cdOffset) || cdOffset < 0 || cdOffset >= buffer.length) {
    throw new ZipBombError("ZIP central directory offset is out of range.");
  }

  const entries: ZipEntryInfo[] = [];
  let pos = cdOffset;
  let totalCompressed = 0;
  let totalUncompressed = 0;

  while (
    pos + 46 <= buffer.length &&
    readUInt32LE(buffer, pos) === CENTRAL_FILE_HEADER_SIGNATURE
  ) {
    let compressedSize = readUInt32LE(buffer, pos + 20);
    let uncompressedSize = readUInt32LE(buffer, pos + 24);
    const nameLen = readUInt16LE(buffer, pos + 28);
    const extraLen = readUInt16LE(buffer, pos + 30);
    const commentLen = readUInt16LE(buffer, pos + 32);
    const name = new TextDecoder().decode(
      buffer.subarray(pos + 46, pos + 46 + nameLen),
    );

    // ZIP64 extended information extra field (header id 0x0001) carries the
    // real sizes whenever the 32-bit fields are saturated.
    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff) {
      let ex = pos + 46 + nameLen;
      const exEnd = ex + extraLen;
      while (ex + 4 <= exEnd && ex + 4 <= buffer.length) {
        const headerId = readUInt16LE(buffer, ex);
        const dataSize = readUInt16LE(buffer, ex + 2);
        if (headerId === 0x0001) {
          let field = ex + 4;
          if (uncompressedSize === 0xffffffff && field + 8 <= exEnd) {
            uncompressedSize = readUInt64LE(buffer, field);
            field += 8;
          }
          if (compressedSize === 0xffffffff && field + 8 <= exEnd) {
            compressedSize = readUInt64LE(buffer, field);
          }
          break;
        }
        ex += 4 + dataSize;
      }
    }

    entries.push({ name, compressedSize, uncompressedSize });
    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;

    pos += 46 + nameLen + extraLen + commentLen;
    if (entries.length > 100_000) {
      // Runaway central directory — refuse rather than loop.
      throw new ZipBombError(
        "ZIP archive declares an implausible number of entries.",
      );
    }
  }

  if (entries.length === 0) {
    throw new ZipBombError(
      "ZIP central directory is empty or unreadable — refusing to parse.",
    );
  }
  void entryCount;

  return {
    entries,
    totalCompressed,
    totalUncompressed,
    ratio: buffer.length > 0 ? totalUncompressed / buffer.length : 0,
  };
}

/**
 * Pre-flight check for an uploaded ZIP-container document (XLSX, XLSM,
 * DOCX, ODF…). Throws {@link ZipBombError} when the archive would expand
 * beyond the configured limits.
 *
 * Call this BEFORE handing the buffer to any parser.
 */
export function assertZipWithinLimits(
  buffer: Uint8Array,
  limits: ZipLimits = SPREADSHEET_ZIP_LIMITS,
): ZipInspection {
  const info = inspectZipArchive(buffer);

  if (info.entries.length > limits.maxEntries) {
    throw new ZipBombError(
      `Archive contains ${info.entries.length} entries (limit ${limits.maxEntries}).`,
    );
  }

  const biggest = info.entries.reduce(
    (a, b) => (b.uncompressedSize > a.uncompressedSize ? b : a),
    info.entries[0],
  );
  if (biggest.uncompressedSize > limits.maxEntryUncompressedBytes) {
    throw new ZipBombError(
      `Archive member '${biggest.name}' expands to ${Math.round(
        biggest.uncompressedSize / 1024 / 1024,
      )} MB (limit ${Math.round(
        limits.maxEntryUncompressedBytes / 1024 / 1024,
      )} MB).`,
    );
  }

  if (info.totalUncompressed > limits.maxTotalUncompressedBytes) {
    throw new ZipBombError(
      `Archive expands to ${Math.round(
        info.totalUncompressed / 1024 / 1024,
      )} MB in total (limit ${Math.round(
        limits.maxTotalUncompressedBytes / 1024 / 1024,
      )} MB).`,
    );
  }

  if (info.ratio > limits.maxRatio) {
    throw new ZipBombError(
      `Archive compression ratio ${info.ratio.toFixed(1)}:1 exceeds the limit of ${limits.maxRatio}:1.`,
    );
  }

  return info;
}
