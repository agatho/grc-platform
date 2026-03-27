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
  // Dynamic import for xlsx to avoid bundling issues
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Excel file contains no sheets");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (jsonData.length === 0) {
    return { headers: [], rows: [], previewRows: [] };
  }

  // Convert all values to strings
  const headers = Object.keys(jsonData[0]);
  const rows = jsonData.map((row) => {
    const stringRow: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      stringRow[key.trim()] = String(value ?? "").trim();
    }
    return stringRow;
  });

  const previewRows = rows.slice(0, 5);

  return { headers, rows, previewRows };
}
