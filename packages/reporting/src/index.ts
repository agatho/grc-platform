// Sprint 30: Report Engine + Threat Landscape — barrel exports

export { ReportGenerator, reportGenerator } from "./generator";
export {
  resolveVariables,
  extractVariables,
  validateVariables,
  type VariableContext,
} from "./variable-resolver";
export {
  fetchTableData,
  fetchChartData,
  fetchKPIValue,
  getAvailableDataSources,
  type FetchContext,
  type TableData,
  type ChartData,
  type KPIData,
} from "./section-data-fetcher";
export { buildReportHTML } from "./renderers/pdf-renderer";
export {
  buildReportDocument,
  type ResolvedSection,
  type ReportDocument,
  type ReportDocumentSection,
  type ReportDocumentBranding,
  type ReportDocumentCell,
} from "./report-document";
export {
  renderReportDocumentPdf,
  type RenderReportDocumentPdfOptions,
} from "./renderers/pdfkit-renderer";
export { renderExcel } from "./renderers/excel-renderer";
export { DEFAULT_REPORT_TEMPLATES } from "./default-templates";
export { seedDefaultTemplates, seedDefaultThreatFeeds } from "./seed";
export {
  getThreatDashboardKPIs,
  getThreatHeatmap,
  getTopThreats,
  getThreatTrends,
  getControlCoverage,
} from "./threat-dashboard";
