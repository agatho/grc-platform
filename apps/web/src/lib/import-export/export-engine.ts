// Sprint 19: Generic export engine — CSV + Excel (ExcelJS) + filter passthrough

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import type { EntityDefinition } from "@grc/shared";
import { getEntityDefinition } from "./entity-registry";
import {
  objectsToCsv,
  escapeCsvField,
  sanitizeCsvValue,
} from "./csv-sanitizer";

const MAX_EXPORT_ROWS = 5000;
const BACKGROUND_THRESHOLD = 1000;

export interface ExportResult {
  data: Buffer;
  contentType: string;
  fileName: string;
  rowCount: number;
}

/**
 * Export entities with format negotiation and filter passthrough.
 * Supports csv and xlsx formats.
 */
export async function exportEntities(
  entityType: string,
  format: string,
  filters: Record<string, string>,
  orgId: string,
): Promise<ExportResult> {
  const def = getEntityDefinition(entityType);
  if (!def) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  // Fetch data with filters
  const data = await fetchEntityData(def, filters, orgId);
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseFileName = `${entityType}-export-${timestamp}`;

  switch (format) {
    case "csv":
      return generateCsvExport(data, def, baseFileName);
    case "xlsx":
      return generateExcelExport(data, def, baseFileName);
    case "pdf":
      // #WAVE21-B9: was returning CSV — Wave-21 QA found this on
      // GET /api/v1/export/risk?format=pdf. The pdfkit library is
      // already wired up via apps/web/src/lib/pdf.ts (used by the
      // /reports/* routes); we re-shape the entity rows into a
      // single-section structured PDF and let pdfkit do the rest.
      return generatePdfExport(data, def, baseFileName);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Generate PDF export buffer using the structured-PDF helper that
 * already powers /reports/* exports. One section per export, with
 * a tabular row-set. (Wave-21-B9.)
 */
async function generatePdfExport(
  data: Record<string, unknown>[],
  def: EntityDefinition,
  baseFileName: string,
): Promise<ExportResult> {
  // Lazy import keeps pdfkit out of the export-engine module's
  // top-level dependency graph (CSV + XLSX are the hot path).
  const { renderStructuredPdfBuffer } = await import("../pdf");
  const headers = def.exportColumns.map((c) => c.header);
  const rows = data.map((row) =>
    def.exportColumns.map((col) => {
      const snakeKey = col.key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      const v = row[col.key] ?? row[snakeKey] ?? "";
      return v === null || v === undefined ? "" : String(v);
    }),
  );

  const buffer = await renderStructuredPdfBuffer({
    title: `${def.key} export`,
    subtitle: `${data.length} records`,
    generatedAt: new Date(),
    sections: [
      {
        heading: def.key,
        table: { headers, rows },
      },
    ],
  });

  return {
    data: buffer,
    contentType: "application/pdf",
    fileName: `${baseFileName}.pdf`,
    rowCount: data.length,
  };
}

// #WAVE13-EXPORT-BIA: the previous `deleted_at IS NULL OR NOT EXISTS (... pg_columns ...)`
// pattern looked defensive but actually crashes Postgres at parse time on
// tables without a `deleted_at` column — the planner resolves the reference
// before the boolean short-circuit runs. `bia_assessment` is one of those
// tables, which is why ROPA + Findings exports worked but BIA returned 500
// (Wave-12 QA requestId f8ed728792d2dc85). Fix: probe information_schema
// once per table and cache it in-process. Result is identical to the
// original intent — soft-delete filter applied only when the column exists.
const tableHasSoftDeleteCache = new Map<string, boolean>();

async function tableHasSoftDelete(tableName: string): Promise<boolean> {
  const cached = tableHasSoftDeleteCache.get(tableName);
  if (cached !== undefined) return cached;
  const probe = await db.execute(
    sql`SELECT 1 FROM information_schema.columns
        WHERE table_name = ${tableName}
          AND column_name = 'deleted_at'
        LIMIT 1`,
  );
  const has = (probe as unknown as unknown[]).length > 0;
  tableHasSoftDeleteCache.set(tableName, has);
  return has;
}

/**
 * Fetch entity data from database with org scoping and optional filters.
 */
async function fetchEntityData(
  def: EntityDefinition,
  filters: Record<string, string>,
  orgId: string,
): Promise<Record<string, unknown>[]> {
  // Build WHERE conditions
  const conditions: string[] = [`org_id = '${orgId}'`];

  // Add soft-delete filter only if the column exists on the target table.
  if (await tableHasSoftDelete(def.tableName)) {
    conditions.push("deleted_at IS NULL");
  }

  // Apply filters from query params
  for (const [key, value] of Object.entries(filters)) {
    if (["format", "page", "limit"].includes(key) || !value) {
      continue;
    }
    // Sanitize filter values to prevent SQL injection
    const sanitizedValue = value.replace(/'/g, "''");
    conditions.push(`"${key}" = '${sanitizedValue}'`);
  }

  const whereClause = conditions.join(" AND ");

  const result = await db.execute(
    sql.raw(
      `SELECT * FROM "${def.tableName}" WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${MAX_EXPORT_ROWS}`,
    ),
  );

  return (result as unknown as Record<string, unknown>[]) ?? [];
}

/**
 * Generate CSV export buffer.
 */
function generateCsvExport(
  data: Record<string, unknown>[],
  def: EntityDefinition,
  baseFileName: string,
): ExportResult {
  // Map DB snake_case rows to camelCase for export columns
  const mappedData = data.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const col of def.exportColumns) {
      // Try camelCase key first, then snake_case
      const snakeKey = col.key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      mapped[col.key] = row[col.key] ?? row[snakeKey] ?? "";
    }
    return mapped;
  });

  const csv = objectsToCsv(mappedData, def.exportColumns);
  const buffer = Buffer.from(csv, "utf-8");

  return {
    data: buffer,
    contentType: "text/csv; charset=utf-8",
    fileName: `${baseFileName}.csv`,
    rowCount: data.length,
  };
}

/**
 * Generate Excel export buffer using ExcelJS.
 */
async function generateExcelExport(
  data: Record<string, unknown>[],
  def: EntityDefinition,
  baseFileName: string,
): Promise<ExportResult> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(def.key);

  // Set up columns with headers and widths
  worksheet.columns = def.exportColumns.map((col) => ({
    header: col.header,
    key: col.key,
    width: Math.max(col.header.length, 15),
  }));

  // Map and add rows
  for (const row of data) {
    const mapped: Record<string, unknown> = {};
    for (const col of def.exportColumns) {
      const snakeKey = col.key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      const value = row[col.key] ?? row[snakeKey] ?? "";
      mapped[col.key] =
        typeof value === "string" ? sanitizeCsvValue(value) : value;
    }
    worksheet.addRow(mapped);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    data: buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName: `${baseFileName}.xlsx`,
    rowCount: data.length,
  };
}

/**
 * Generate a template CSV for a given entity type with headers + 3 example rows.
 */
export function generateTemplate(entityType: string): ExportResult {
  const def = getEntityDefinition(entityType);
  if (!def) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const headerRow = def.templateHeaders.map(escapeCsvField).join(",");
  const exampleRows = def.templateExampleRows.map((row) =>
    row.map(escapeCsvField).join(","),
  );

  const csv = [headerRow, ...exampleRows].join("\n");
  const buffer = Buffer.from(csv, "utf-8");

  return {
    data: buffer,
    contentType: "text/csv; charset=utf-8",
    fileName: `${entityType}-import-template.csv`,
    rowCount: def.templateExampleRows.length,
  };
}

/**
 * Check if the export should run in the background (> threshold rows).
 */
export function shouldRunInBackground(rowCount: number): boolean {
  return rowCount >= BACKGROUND_THRESHOLD;
}
