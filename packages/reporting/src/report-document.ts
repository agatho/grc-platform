// Neutral, render-agnostic report document model (JSON-serialisable).
//
// Why this exists: the Sprint-30 template engine used to emit HTML and
// print it via Puppeteer. Puppeteer needs a Chromium binary that is
// painful to ship in the Alpine deploy image and was already retired
// for the direct PDF exports (#WAVE11-P1-EXPORT → pdfkit, see
// apps/web/src/lib/pdf.ts and apps/web/src/lib/reporting/). The engine
// now resolves template sections into this neutral model; rendering
// happens with pdfkit:
//   - packages/reporting/src/renderers/pdfkit-renderer.ts — used by the
//     generator itself. It must live in this package (not apps/web)
//     because apps/worker runs scheduled reports in-process via
//     reportGenerator (crons/report-scheduler.ts) and packages must
//     never import from apps.
//   - apps/web/src/lib/reporting/report-document-renderer.ts — maps the
//     model onto the hardened web report core (org branding, style
//     variants) for callers that want branded output.
// The HTML path survives only as buildReportHTML for the browser
// preview (POST /api/v1/reports/preview) — no Puppeteer involved.

import type { ReportBrandingConfig, ReportSectionConfig } from "@grc/shared";
import type { TableData, ChartData, KPIData } from "./section-data-fetcher";

/** A template section after variable resolution + data fetching. */
export interface ResolvedSection {
  type: ReportSectionConfig["type"];
  config: ReportSectionConfig["config"];
  content?: string;
  data?: TableData | ChartData;
  value?: KPIData;
}

export type ReportDocumentCell = string | number | null;

export type ReportDocumentSection =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | {
      kind: "kpi";
      label: string;
      value: string | number;
      trend?: "up" | "down" | "stable";
    }
  | {
      kind: "table";
      title?: string;
      headers: string[];
      rows: ReportDocumentCell[][];
    }
  | {
      kind: "chart";
      title?: string;
      chartType: "bar" | "line" | "donut" | "heatmap";
      labels: string[];
      datasets: Array<{ label: string; data: number[] }>;
    }
  | { kind: "pageBreak" };

export interface ReportDocumentBranding {
  primaryColor: string;
  footerText: string | null;
  confidentiality: string | null;
  logoUrl: string | null;
}

export interface ReportDocument {
  /** ISO timestamp — the model is plain JSON, no Date instances. */
  generatedAt: string;
  branding: ReportDocumentBranding;
  sections: ReportDocumentSection[];
}

// ─── Builders ────────────────────────────────────────────────────

function isTableData(
  data: TableData | ChartData | undefined,
): data is TableData {
  return !!data && "headers" in data;
}

function isChartData(
  data: TableData | ChartData | undefined,
): data is ChartData {
  return !!data && "datasets" in data && "labels" in data;
}

function toCell(value: unknown): ReportDocumentCell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Same header→row-key fallback the old HTML renderer used: the SQL rows
 * carry snake_case keys ("element_id") while headers are display labels
 * ("Element ID" → "element_id" via lowercase + underscores).
 */
function cellForHeader(row: Record<string, unknown>, header: string): unknown {
  return row[header] ?? row[header.toLowerCase().replace(/ /g, "_")] ?? null;
}

/**
 * Map resolved template sections + branding config onto the neutral
 * ReportDocument model. Pure (aside from the generatedAt default) —
 * unit-tested without DB or renderer.
 */
export function buildReportDocument(
  sections: ResolvedSection[],
  branding?: ReportBrandingConfig | null,
  options: { generatedAt?: Date } = {},
): ReportDocument {
  const out: ReportDocumentSection[] = [];

  for (const section of sections) {
    switch (section.type) {
      case "title":
        out.push({
          kind: "heading",
          text: section.content || section.config.text || "",
        });
        break;
      case "text":
        out.push({
          kind: "paragraph",
          text: section.content || section.config.text || "",
        });
        break;
      case "kpi": {
        const kpi = section.value;
        out.push({
          kind: "kpi",
          label: kpi?.label ?? section.config.label ?? "N/A",
          value: kpi?.value ?? 0,
          trend: kpi?.trend,
        });
        break;
      }
      case "table": {
        const data = isTableData(section.data) ? section.data : undefined;
        const headers = data?.headers ?? [];
        out.push({
          kind: "table",
          title: section.config.label,
          headers,
          rows: (data?.rows ?? []).map((row) =>
            headers.map((h) => toCell(cellForHeader(row, h))),
          ),
        });
        break;
      }
      case "chart": {
        const data = isChartData(section.data) ? section.data : undefined;
        out.push({
          kind: "chart",
          title: section.config.label,
          chartType: section.config.chartType ?? "bar",
          labels: data?.labels ?? [],
          datasets: (data?.datasets ?? []).map((ds) => ({
            label: ds.label,
            data: [...ds.data],
          })),
        });
        break;
      }
      case "page_break":
        out.push({ kind: "pageBreak" });
        break;
      default:
        // Unknown section types are skipped, mirroring the old HTML
        // renderer's default branch.
        break;
    }
  }

  return {
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    branding: {
      primaryColor: branding?.primaryColor || "#1e3a5f",
      footerText: branding?.footerText || null,
      confidentiality: branding?.confidentiality || null,
      logoUrl: branding?.logoUrl || null,
    },
    sections: out,
  };
}
