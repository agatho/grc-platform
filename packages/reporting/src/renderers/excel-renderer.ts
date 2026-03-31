// Sprint 30: Excel Renderer — ExcelJS workbook generation
// Renders resolved sections into formatted Excel workbook

import type { ReportSectionConfig } from "@grc/shared";
import type { TableData, ChartData, KPIData } from "../section-data-fetcher";
import type { ResolvedSection } from "./pdf-renderer";
import ExcelJS from "exceljs";

/**
 * Render resolved sections as an Excel workbook buffer.
 */
export async function renderExcel(
  sections: ResolvedSection[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  let sheetIndex = 0;

  // KPI summary sheet if any KPI sections exist
  const kpiSections = sections.filter((s) => s.type === "kpi" && s.value);
  if (kpiSections.length > 0) {
    const ws = wb.addWorksheet("KPI Summary");
    ws.columns = [
      { header: "Metric", key: "Metric", width: 30 },
      { header: "Value", key: "Value", width: 15 },
      { header: "Trend", key: "Trend", width: 10 },
    ];
    for (const s of kpiSections) {
      ws.addRow({
        Metric: s.value!.label,
        Value: s.value!.value,
        Trend: s.value!.trend || "",
      });
    }
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
        const ws = wb.addWorksheet(sheetName);

        // Determine columns from first row keys
        const keys = Object.keys(tableData.rows[0]);
        ws.columns = keys.map((key, i) => ({
          header: tableData.headers[i] ?? key,
          key,
        }));

        for (const row of tableData.rows) {
          ws.addRow(row);
        }
        sheetIndex++;
      }
    }

    if (section.type === "chart" && section.data) {
      const chartData = section.data as ChartData;
      if (chartData.labels.length > 0) {
        const sheetName = sanitizeSheetName(
          section.config.label || `Chart ${sheetIndex + 1}`,
        );
        const ws = wb.addWorksheet(sheetName);

        const datasetLabels = chartData.datasets.map((ds) => ds.label);
        ws.columns = [
          { header: "Label", key: "Label" },
          ...datasetLabels.map((label) => ({ header: label, key: label })),
        ];

        for (let i = 0; i < chartData.labels.length; i++) {
          const row: Record<string, unknown> = { Label: chartData.labels[i] };
          for (const ds of chartData.datasets) {
            row[ds.label] = ds.data[i] ?? 0;
          }
          ws.addRow(row);
        }
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
    const ws = wb.addWorksheet("Content");
    ws.columns = [
      { header: "Type", key: "Type", width: 10 },
      { header: "Content", key: "Content", width: 80 },
    ];
    for (const s of textSections) {
      ws.addRow({
        Type: s.type,
        Content: s.content || s.config.text || "",
      });
    }
  }

  // If no sheets were created, add a placeholder
  if (wb.worksheets.length === 0) {
    const ws = wb.addWorksheet("Report");
    ws.columns = [{ header: "Message", key: "Message" }];
    ws.addRow({ Message: "No data available" });
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
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
