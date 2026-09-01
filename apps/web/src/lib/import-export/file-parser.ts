// Sprint 19: File parser — CSV + Excel → normalized rows array

import Papa from "papaparse";
import { Readable } from "node:stream";
import {
  assertZipWithinLimits,
  ZipBombError,
  verifyUploadSignature,
} from "@grc/shared";

export interface ParsedFileResult {
  headers: string[];
  rows: Record<string, string>[];
  previewRows: Record<string, string>[];
}

// #S04-04 (ARCTOS-FULL-2026-08-31, Medium) — decompression / memory
// amplification.
//
// Measured (evidence/S04/xlsx-decompression-bomb.txt): a valid .xlsx with
// 1.85 M single-cell rows compresses to 9.3 MB — under the routes' 10 MB
// upload cap — and `Workbook.xlsx.load()` turned it into 2.26 GB RSS in
// 17.5 s. The upload byte limit is structurally unable to see this, because
// the amplification happens after the bytes are accepted.
//
// Three layers now bound it:
//   1. `assertZipWithinLimits` reads the ZIP central directory and refuses
//      the file before a single byte is inflated (100 MB total uncompressed,
//      80 MB per member, 150:1 ratio).
//   2. The workbook is read with exceljs' STREAMING `WorkbookReader` instead
//      of `Workbook.xlsx.load()`, so peak memory tracks the rows we keep
//      rather than the whole sheet's object graph.
//   3. Hard row and cell ceilings abort the read mid-stream, so even a file
//      that slips past (1) cannot grow the result set without bound.
//
// The row ceiling is deliberately generous — a genuine bulk import is
// tens of thousands of rows — and configurable for operators who need more.
const MAX_IMPORT_ROWS = Number.parseInt(
  process.env.IMPORT_MAX_ROWS ?? "100000",
  10,
);
const MAX_IMPORT_CELLS = MAX_IMPORT_ROWS * 100;

/** Thrown when an upload exceeds a parser limit. Callers map this to 413/422. */
export class ImportTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportTooLargeError";
  }
}

/** Thrown when the real file content is not an accepted import format. */
export class UnsupportedUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedUploadError";
  }
}

/**
 * #S04-06: content types the import pipeline actually accepts. The
 * magic-byte check below compares the *sniffed* type against this set, so
 * a forged `Content-Type` header no longer decides what gets parsed.
 */
const IMPORT_ALLOWED_MIMES = [
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/x-ole-storage", // legacy .xls (OLE2 container)
  // A genuine .xlsx is a ZIP on the wire. Browsers sometimes send
  // application/octet-stream for it, so accept the container type itself;
  // a non-spreadsheet ZIP still fails in the parser below.
  "application/zip",
];

/**
 * Parse an uploaded file (CSV or Excel) into a normalized array of row objects.
 * Returns headers and all rows as string key-value records.
 */
export async function parseFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ParsedFileResult> {
  // #S04-06: the upload routes only compare the CLIENT-supplied
  // Content-Type against an allowlist. Verify the real content here, at
  // the single point every import path funnels through, so a PE/ELF/HTML
  // payload renamed to .csv or declared as an .xlsx is refused before it
  // reaches a parser. CSV/plain text has no magic bytes, hence
  // `allowUnknownForText`.
  const signature = verifyUploadSignature(buffer, {
    allowedMimes: IMPORT_ALLOWED_MIMES,
    declaredMime: mimeType,
    allowUnknownForText: true,
  });
  if (!signature.ok) {
    throw new UnsupportedUploadError(
      signature.reason ?? "File content is not an accepted import format.",
    );
  }

  if (
    mimeType === "text/csv" ||
    fileName.endsWith(".csv") ||
    mimeType === "application/csv"
  ) {
    return parseCsv(buffer);
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls")
  ) {
    return parseExcel(buffer);
  }

  throw new Error(`Unsupported file format: ${mimeType}`);
}

function parseCsv(buffer: Buffer): ParsedFileResult {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw new Error(
      `CSV parse error at row ${firstError.row}: ${firstError.message}`,
    );
  }

  const headers = result.meta.fields ?? [];
  const rows = result.data;

  // #S04-04: CSV does not amplify (1:1 with the upload limit), but the row
  // ceiling is applied here too so downstream stages see one contract.
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ImportTooLargeError(
      `File contains ${rows.length} rows, which exceeds the import limit of ${MAX_IMPORT_ROWS}.`,
    );
  }

  const previewRows = rows.slice(0, 5);

  return { headers, rows, previewRows };
}

async function parseExcel(buffer: Buffer): Promise<ParsedFileResult> {
  // #S04-04 layer 1: refuse decompression bombs before inflating anything.
  try {
    assertZipWithinLimits(buffer);
  } catch (err) {
    if (err instanceof ZipBombError) {
      throw new ImportTooLargeError(err.message);
    }
    throw err;
  }

  // Dynamic import for exceljs to avoid bundling issues
  const ExcelJS = await import("exceljs");

  // #S04-04 layer 2: streaming read. `Workbook.xlsx.load(buffer)` builds the
  // entire sheet in memory before the first row is visible; WorkbookReader
  // emits rows as they are parsed, so the ceilings below can abort early.
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(buffer), {
    entries: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
    worksheets: "emit",
  });

  const headers: string[] = [];
  const rows: Record<string, string>[] = [];
  let sawSheet = false;
  let cellCount = 0;

  for await (const worksheet of reader as AsyncIterable<any>) {
    sawSheet = true;
    for await (const row of worksheet as AsyncIterable<any>) {
      if (row.number === 1) {
        row.eachCell((cell: any, colNumber: number) => {
          headers[colNumber] = String(cell.value ?? "").trim();
        });
        continue;
      }
      if (headers.length === 0) {
        // No header row at position 1 — same outcome as the previous
        // implementation, which returned empty for a headerless sheet.
        break;
      }

      // #S04-04 layer 3: hard ceilings, checked before the row is retained.
      if (rows.length >= MAX_IMPORT_ROWS) {
        throw new ImportTooLargeError(
          `Spreadsheet exceeds the import limit of ${MAX_IMPORT_ROWS} rows.`,
        );
      }

      const stringRow: Record<string, string> = {};
      row.eachCell((cell: any, colNumber: number) => {
        cellCount++;
        const header = headers[colNumber];
        if (header) {
          stringRow[header] = String(cell.value ?? "").trim();
        }
      });

      if (cellCount > MAX_IMPORT_CELLS) {
        throw new ImportTooLargeError(
          `Spreadsheet exceeds the import limit of ${MAX_IMPORT_CELLS} cells.`,
        );
      }

      // Fill missing headers with empty string (equivalent to defval: "")
      for (const h of headers) {
        if (h && !(h in stringRow)) {
          stringRow[h] = "";
        }
      }
      rows.push(stringRow);
    }
    // Only the first worksheet is imported, matching the previous behaviour
    // (`wb.worksheets[0]`). Breaking here also stops the reader from parsing
    // the remaining sheets of a multi-sheet bomb.
    break;
  }

  if (!sawSheet) {
    throw new Error("Excel file contains no sheets");
  }

  if (headers.length === 0) {
    return { headers: [], rows: [], previewRows: [] };
  }

  const previewRows = rows.slice(0, 5);

  // Filter out sparse array entries from headers
  const cleanHeaders = headers.filter(Boolean);

  return { headers: cleanHeaders, rows, previewRows };
}
