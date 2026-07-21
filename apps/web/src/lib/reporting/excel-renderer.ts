// Excel renderer for the standard report suite (exceljs).
//
// Compared with packages/reporting/src/renderers/excel-renderer.ts
// (Sprint-30 template engine, kept as-is for the template routes), this
// renderer adds: styled + frozen header row, AutoFilter, explicit column
// widths from the shared column weights, locale-aware number formats,
// and a summary sheet with report metadata + KPIs + percent bars.

import ExcelJS from "exceljs";
import {
  chrome,
  confidentialityText,
  defaultDocumentId,
  effectiveStyle,
  formatCell,
  DEFAULT_PRIMARY_COLOR,
  type ReportCell,
  type ReportCellFormat,
  type ReportDefinition,
  type ReportLocale,
} from "./core";

const SHEET_SUMMARY: Record<ReportLocale, string> = {
  de: "Übersicht",
  en: "Summary",
};

export async function renderReportXlsx(def: ReportDefinition): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ARCTOS GRC Platform";
  wb.created = def.generatedAt;

  const primaryArgb = hexToArgb(
    def.branding.primaryColor || DEFAULT_PRIMARY_COLOR,
  );

  // ── Summary sheet: metadata + paragraphs + KPIs + bars ──
  const summary = wb.addWorksheet(SHEET_SUMMARY[def.locale]);
  summary.columns = [{ width: 46 }, { width: 24 }, { width: 40 }];

  const titleRow = summary.addRow([def.title]);
  titleRow.font = { bold: true, size: 16, color: { argb: primaryArgb } };
  if (def.subtitle) {
    summary.addRow([def.subtitle]).font = {
      size: 10,
      color: { argb: "FF6B7280" },
    };
  }
  summary.addRow([def.branding.orgName]);
  summary.addRow([
    `${chrome(def.locale, "generatedAt")}: ${formatCell(def.generatedAt, "text", def.locale)}`,
  ]);
  // Style variants are primarily a PDF concern (cover page, chrome,
  // row heights). In the workbook the formal style adds the document
  // number to the summary metadata; standard/minimal are identical.
  if (effectiveStyle(def) === "formal") {
    summary.addRow([
      `${chrome(def.locale, "documentNo")}: ${def.documentId ?? defaultDocumentId(def.generatedAt)}`,
    ]).font = { size: 9, color: { argb: "FF9CA3AF" } };
  }
  const confRow = summary.addRow([confidentialityText(def)]);
  confRow.font = { bold: true, size: 9, color: { argb: "FF991B1B" } };
  summary.addRow([]);

  for (const section of def.sections) {
    if (section.kind === "paragraph") {
      const r = summary.addRow([section.text]);
      r.alignment = { wrapText: true, vertical: "top" };
      summary.addRow([]);
    } else if (section.kind === "heading") {
      summary.addRow([section.text]).font = {
        bold: true,
        size: 12,
        color: { argb: primaryArgb },
      };
      summary.addRow([]);
    } else if (section.kind === "kpis") {
      for (const kpi of section.items) {
        const r = summary.addRow([kpi.label, kpi.value]);
        r.getCell(2).font = { bold: true };
      }
      summary.addRow([]);
    } else if (section.kind === "bars") {
      if (section.title) {
        summary.addRow([section.title]).font = {
          bold: true,
          color: { argb: primaryArgb },
        };
      }
      for (const bar of section.items) {
        const r = summary.addRow([
          bar.label,
          bar.percent / 100,
          bar.detail ?? "",
        ]);
        r.getCell(2).numFmt = "0.0%";
      }
      summary.addRow([]);
    }
  }

  // ── One worksheet per table section ──
  let tableIndex = 0;
  for (const section of def.sections) {
    if (section.kind !== "table") continue;
    tableIndex++;
    const name = sanitizeSheetName(
      section.title ??
        `${def.locale === "de" ? "Daten" : "Data"} ${tableIndex}`,
    );
    const ws = wb.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    ws.columns = section.table.columns.map((col) => ({
      header: col.label,
      key: col.key,
      width: columnCharWidth(col.width ?? 1, section.table.columns.length),
    }));

    // Header styling
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: primaryArgb },
    };
    header.alignment = { vertical: "middle" };

    for (const row of section.table.rows) {
      const excelRow = ws.addRow(
        row.map((cell, c) =>
          toExcelValue(cell, section.table.columns[c]?.format),
        ),
      );
      excelRow.alignment = { wrapText: true, vertical: "top" };
    }

    // Number/date formats per column
    section.table.columns.forEach((col, idx) => {
      const excelCol = ws.getColumn(idx + 1);
      const fmt = numFmtFor(col.format, def.locale);
      if (fmt) excelCol.numFmt = fmt;
    });

    // AutoFilter over the full data range
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: {
        row: Math.max(section.table.rows.length + 1, 1),
        column: section.table.columns.length,
      },
    };
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Helpers ─────────────────────────────────────────────────────

function toExcelValue(
  cell: ReportCell,
  format: ReportCellFormat | undefined,
): string | number | Date | null {
  if (cell === null || cell === undefined) return null;
  if (format === "percent" && typeof cell === "number") return cell / 100;
  if (format === "date") {
    if (cell instanceof Date) return cell;
    const d = new Date(String(cell));
    return Number.isNaN(d.getTime()) ? String(cell) : d;
  }
  if (cell instanceof Date) return cell;
  return cell;
}

function numFmtFor(
  format: ReportCellFormat | undefined,
  locale: ReportLocale,
): string | null {
  switch (format) {
    case "int":
      return "#,##0";
    case "decimal":
      return "#,##0.00";
    case "percent":
      return "0.0%";
    case "date":
      return locale === "de" ? "dd.mm.yyyy" : "mm/dd/yyyy";
    default:
      return null;
  }
}

/** Map a relative width weight to an Excel character width. */
function columnCharWidth(weight: number, columnCount: number): number {
  // ~110 chars distributed across the table, min 8, max 60 per column.
  const total = Math.max(110, columnCount * 12);
  const totalWeight = columnCount; // weights average ~1
  const chars = (total * weight) / Math.max(totalWeight, 1);
  return Math.min(Math.max(Math.round(chars), 8), 60);
}

function sanitizeSheetName(name: string): string {
  return (
    name
      .replace(/[\\/*?[\]:]/g, "")
      .substring(0, 31)
      .trim() || "Sheet"
  );
}

function hexToArgb(hex: string): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "FF1E3A5F";
  return `FF${clean.toUpperCase()}`;
}
