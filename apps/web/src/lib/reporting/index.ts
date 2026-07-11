// Report core barrel — hardened shared basis for the standard report
// suite (risk register, SoA, compliance status). See core.ts header
// for the relationship to lib/pdf.ts and packages/reporting.

export * from "./core";
export { renderReportPdf } from "./pdf-renderer";
export { renderReportXlsx } from "./excel-renderer";
export { loadReportBranding } from "./branding";
export {
  renderReportDocument,
  reportDocumentToDefinition,
  type RenderReportDocumentOptions,
} from "./report-document-renderer";
export * from "./labels";
