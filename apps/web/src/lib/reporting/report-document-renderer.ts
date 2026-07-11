// Adapter: neutral ReportDocument model (@grc/reporting, produced by the
// Sprint-30 template engine) → hardened web report core (pdfkit).
//
// The template engine itself renders via
// packages/reporting/src/renderers/pdfkit-renderer.ts because the worker
// cron (report-scheduler) generates scheduled reports in-process and
// packages must not import from apps. This adapter is the web-side
// entry point: it maps the model onto a ReportDefinition so callers get
// the full org chrome (branding, logo, confidentiality footer) and the
// standard/formal/minimal style variants on top of engine output.
//
// Imports from @grc/reporting are type-only — no runtime coupling to the
// generator/DB layer.

import type { ReportDocument, ReportDocumentSection } from "@grc/reporting";
import {
  type ReportBranding,
  type ReportDefinition,
  type ReportKpi,
  type ReportLocale,
  type ReportSection,
  type ReportStyle,
  DEFAULT_PRIMARY_COLOR,
} from "./core";
import { renderReportPdf } from "./pdf-renderer";

export interface RenderReportDocumentOptions {
  /** Falls back to the model's first heading, then "Report". */
  title?: string;
  subtitle?: string;
  locale?: ReportLocale;
  /** Full org branding; when absent a minimal branding is derived from the model. */
  branding?: ReportBranding;
  style?: ReportStyle;
  documentId?: string;
}

/**
 * Map the neutral model onto a ReportDefinition (exported for tests).
 */
export function reportDocumentToDefinition(
  model: ReportDocument,
  options: RenderReportDocumentOptions = {},
): ReportDefinition {
  const sections: ReportSection[] = [];
  let pendingKpis: ReportKpi[] = [];
  const flushKpis = (): void => {
    if (pendingKpis.length > 0) {
      sections.push({ kind: "kpis", items: pendingKpis });
      pendingKpis = [];
    }
  };

  // The document title comes from the first heading unless overridden;
  // that heading is then not repeated in the body.
  const firstHeadingIndex = model.sections.findIndex(
    (s) => s.kind === "heading",
  );
  const firstHeading =
    firstHeadingIndex >= 0
      ? (model.sections[firstHeadingIndex] as Extract<
          ReportDocumentSection,
          { kind: "heading" }
        >)
      : undefined;
  const titleFromModel = options.title === undefined && firstHeading;

  model.sections.forEach((section, index) => {
    if (titleFromModel && index === firstHeadingIndex) return;
    if (section.kind !== "kpi") flushKpis();

    switch (section.kind) {
      case "heading":
        sections.push({ kind: "heading", text: section.text });
        break;
      case "paragraph":
        sections.push({ kind: "paragraph", text: section.text });
        break;
      case "kpi":
        pendingKpis.push({ label: section.label, value: section.value });
        break;
      case "table":
        sections.push({
          kind: "table",
          title: section.title,
          table: {
            columns: section.headers.map((header, i) => ({
              key: `col${i}`,
              label: header,
            })),
            rows: section.rows,
          },
        });
        break;
      case "chart": {
        const dataset = section.datasets[0];
        if (
          section.chartType === "bar" &&
          section.datasets.length === 1 &&
          dataset &&
          dataset.data.length > 0
        ) {
          // Absolute values scaled to the max — no chart library.
          const max = Math.max(...dataset.data, 1);
          sections.push({
            kind: "bars",
            title: section.title,
            items: section.labels.map((label, i) => ({
              label,
              percent: ((dataset.data[i] ?? 0) / max) * 100,
              detail: String(dataset.data[i] ?? 0),
            })),
          });
        } else {
          // Fallback: value table (line/donut/heatmap or multi-series).
          sections.push({
            kind: "table",
            title: section.title,
            table: {
              columns: [
                { key: "label", label: "Label", width: 2 },
                ...section.datasets.map((ds, i) => ({
                  key: `ds${i}`,
                  label: ds.label,
                  format: "int" as const,
                })),
              ],
              rows: section.labels.map((label, i) => [
                label,
                ...section.datasets.map((ds) => ds.data[i] ?? 0),
              ]),
            },
          });
        }
        break;
      }
      case "pageBreak":
        sections.push({ kind: "pageBreak" });
        break;
    }
  });
  flushKpis();

  const branding: ReportBranding = options.branding ?? {
    orgName: "ARCTOS",
    primaryColor: model.branding.primaryColor || DEFAULT_PRIMARY_COLOR,
    confidentialityNotice: model.branding.confidentiality,
    // logoUrl in the model is a URL, not a filesystem path — the web
    // chrome only embeds verified local files (see branding.ts).
    logoFilePath: null,
  };

  const generatedAt = new Date(model.generatedAt);

  return {
    title: options.title ?? firstHeading?.text ?? "Report",
    subtitle: options.subtitle,
    locale: options.locale ?? "de",
    branding,
    generatedAt: Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt,
    sections,
    style: options.style,
    documentId: options.documentId,
  };
}

/** Render a neutral ReportDocument with the branded web pdfkit core. */
export async function renderReportDocument(
  model: ReportDocument,
  options: RenderReportDocumentOptions = {},
): Promise<Buffer> {
  return renderReportPdf(reportDocumentToDefinition(model, options));
}
