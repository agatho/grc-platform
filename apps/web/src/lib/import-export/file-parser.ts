// Sprint 19: File parser — CSV + Excel → normalized rows array

import Papa from "papaparse";

export interface ParsedFileResult {
  headers: string[];
  rows: Record<string, string>[];
  previewRows: Record<string, string>[];
}

/**
 * Parse an uploaded file (CSV or Excel) into a normalized array of row objects.
 * Returns headers and all rows as string key-value records.
 */
export async function parseFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ParsedFileResult> {
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
  const previewRows = rows.slice(0, 5);

  return { headers, rows, previewRows };
}

async function parseExcel(buffer: Buffer): Promise<ParsedFileResult> {
  // Dynamic import for exceljs to avoid bundling issues
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheet = wb.worksheets[0];
  if (!sheet) {
    throw new Error("Excel file contains no sheets");
  }

  // Extract headers from first row
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  if (headers.length === 0) {
    return { headers: [], rows: [], previewRows: [] };
  }

  // Extract data rows
  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const stringRow: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        stringRow[header] = String(cell.value ?? "").trim();
      }
    });
    // Fill missing headers with empty string (equivalent to defval: "")
    for (const h of headers) {
      if (h && !(h in stringRow)) {
        stringRow[h] = "";
      }
    }
    rows.push(stringRow);
  });

  const previewRows = rows.slice(0, 5);

  // Filter out sparse array entries from headers
  const cleanHeaders = headers.filter(Boolean);

  return { headers: cleanHeaders, rows, previewRows };
}
