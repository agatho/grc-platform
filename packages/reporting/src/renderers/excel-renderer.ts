// Sprint 30: Excel Renderer — SheetJS XLSX generation
// Renders resolved sections into formatted Excel workbook

import type { ReportSectionConfig } from "@grc/shared";
import type { TableData, ChartData, KPIData } from "../section-data-fetcher";
import type { ResolvedSection } from "./pdf-renderer";

/**
 * Render resolved sections as an Excel workbook buffer.
 */
export async function renderExcel(
  sections: ResolvedSection[],
): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  let sheetIndex = 0;

  // KPI summary sheet if any KPI sections exist
  const kpiSections = sections.filter((s) => s.type === "kpi" && s.value);
  if (kpiSections.length > 0) {
    const kpiRows = kpiSections.map((s) => ({
      Metric: s.value!.label,
      Value: s.value!.value,
      Trend: s.value!.trend || "",
    }));
    const ws = XLSX.utils.json_to_sheet(kpiRows);
    applyColumnWidths(ws, [30, 15, 10]);
    XLSX.utils.book_append_sheet(wb, ws, "KPI Summary");
    sheetIndex++;
  }

  // Table sections get their own sheets
  for (const section of sections) {
    if (section.type === "table" && section.data) {
      const tableData = section.data as TableData;
      if (tableData.rows.length > 0) {
        const sheetName = sanitizeSheetName(
          section.config.label || `Data ${sheetIndex + 1}`,
        );
        const ws = XLSX.utils.json_to_sheet(tableData.rows);
        // Override headers
        if (tableData.headers.length > 0) {
          for (let i = 0; i < tableData.headers.length; i++) {
            const cell = XLSX.utils.encode_cell({ r: 0, c: i });
            if (ws[cell]) {
              ws[cell].v = tableData.headers[i];
            }
          }
        }
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        sheetIndex++;
      }
    }

    if (section.type === "chart" && section.data) {
      const chartData = section.data as ChartData;
      if (chartData.labels.length > 0) {
        const sheetName = sanitizeSheetName(
          section.config.label || `Chart ${sheetIndex + 1}`,
        );
        const rows = chartData.labels.map((label, i) => {
          const row: Record<string, unknown> = { Label: label };
          for (const ds of chartData.datasets) {
            row[ds.label] = ds.data[i] ?? 0;
          }
          return row;
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        sheetIndex++;
      }
    }

    // Text sections as a summary
    if (section.type === "title" || section.type === "text") {
      // Accumulate text content — will be handled below
    }
  }

  // Text content sheet
  const textSections = sections.filter(
    (s) => s.type === "title" || s.type === "text",
  );
  if (textSections.length > 0) {
    const textRows = textSections.map((s) => ({
      Type: s.type,
      Content: s.content || s.config.text || "",
    }));
    const ws = XLSX.utils.json_to_sheet(textRows);
    applyColumnWidths(ws, [10, 80]);
    XLSX.utils.book_append_sheet(wb, ws, "Content");
  }

  // If no sheets were created, add a placeholder
  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.json_to_sheet([{ Message: "No data available" }]);
    XLSX.utils.book_append_sheet(wb, ws, "Report");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buffer);
}

/**
 * Sanitize sheet name for Excel (max 31 chars, no special chars)
 */
function sanitizeSheetName(name: string): string {
  return name
    .replace(/[\\/*?\[\]:]/g, "")
    .substring(0, 31)
    .trim() || "Sheet";
}

/**
 * Apply column widths to worksheet
 */
function applyColumnWidths(
  ws: Record<string, unknown>,
  widths: number[],
): void {
  (ws as Record<string, unknown>)["!cols"] = widths.map((w) => ({ wch: w }));
}
