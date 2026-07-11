// Report core — shared types, locale formatting, and pure layout logic
// for the standard report suite (risk register, SoA, compliance status).
//
// Design notes (Bestandsaufnahme 2026-07-11):
//   - packages/reporting is the Sprint-30 *template* engine. Its former
//     Puppeteer PDF path (renderPDF) was removed 2026-07-11; the engine
//     now emits a neutral ReportDocument model rendered with pdfkit
//     (packages/reporting/src/renderers/pdfkit-renderer.ts for the
//     generator/worker, ./report-document-renderer.ts for branded
//     web-side rendering on this core).
//   - lib/pdf.ts (renderStructuredPdfBuffer) is the proven pdfkit pipeline
//     but has fixed equal column widths, no per-page org header, no
//     repeated table header after page breaks and German-only formatting.
//     This module is the hardened successor for the standard reports;
//     lib/pdf.ts stays untouched for its existing callers.
//   - Formatting delegates to lib/format.ts (Intl-based, DE/EN per
//     CLAUDE.md conventions).
//
// Everything in this file is pure (no pdfkit/exceljs imports) so the
// layout logic is unit-testable without rendering.

import { formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";

export type ReportLocale = "de" | "en";
export type ReportFormat = "pdf" | "xlsx";

/**
 * Report style variants, driven by `org_branding.report_template`
 * (enum `branding_template_style`, migration 0329):
 *   - standard: default chrome (org header + logo, KPI cards, zebra tables)
 *   - formal:   cover page + table of contents, wider spacing, thin rules,
 *               document number in the footer — for board/auditor handouts
 *   - minimal:  no logo, single-line header, tight rows, frameless KPIs —
 *               for quick working printouts
 */
export const REPORT_STYLES = ["standard", "formal", "minimal"] as const;
export type ReportStyle = (typeof REPORT_STYLES)[number];

export type ReportCellFormat = "text" | "int" | "decimal" | "percent" | "date";

export interface ReportColumn {
  /** Stable key — used as Excel column key. */
  key: string;
  /** Localised header label. */
  label: string;
  /** Relative width weight (default 1). */
  width?: number;
  format?: ReportCellFormat;
  align?: "left" | "right" | "center";
}

export type ReportCell = string | number | Date | null | undefined;

export interface ReportTable {
  columns: ReportColumn[];
  rows: ReportCell[][];
}

export interface ReportKpi {
  label: string;
  value: string | number;
  tone?: "default" | "ok" | "warn" | "crit";
}

export interface ReportBar {
  label: string;
  /** 0–100 */
  percent: number;
  detail?: string;
}

export type ReportSection =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "kpis"; items: ReportKpi[] }
  | { kind: "table"; title?: string; table: ReportTable }
  | { kind: "bars"; title?: string; items: ReportBar[] }
  | { kind: "pageBreak" };

export interface ReportBranding {
  orgName: string;
  /** Hex #RRGGBB — falls back to ARCTOS default when no org_branding row. */
  primaryColor: string;
  /** Footer notice, e.g. "CONFIDENTIAL -- For internal use only". */
  confidentialityNotice: string | null;
  /** Absolute filesystem path of a PNG logo, or null when unavailable. */
  logoFilePath: string | null;
  /**
   * Org-level style preference (org_branding.report_template).
   * Optional so hand-built branding objects (tests, callers without a
   * branding row) keep working; renderers fall back to "standard".
   */
  reportTemplate?: ReportStyle;
}

export interface ReportDefinition {
  title: string;
  subtitle?: string;
  locale: ReportLocale;
  branding: ReportBranding;
  generatedAt: Date;
  sections: ReportSection[];
  /** Style variant; falls back to branding.reportTemplate, then "standard". */
  style?: ReportStyle;
  /**
   * Document number shown in the formal footer. When absent, a
   * deterministic id is derived from generatedAt (see defaultDocumentId).
   */
  documentId?: string;
}

export const DEFAULT_PRIMARY_COLOR = "#1e3a5f";

// ─── Localised chrome strings (report documents, not UI — the UI
//     strings live in messages/{de,en}/reporting.json) ─────────────

const CHROME: Record<ReportLocale, Record<string, string>> = {
  de: {
    generatedAt: "Erstellt am",
    page: "Seite",
    of: "von",
    noData: "Keine Daten vorhanden.",
    confidentialFallback: "Vertraulich — nur für den internen Gebrauch",
    contents: "Inhaltsübersicht",
    documentNo: "Dokument-Nr.",
  },
  en: {
    generatedAt: "Generated",
    page: "Page",
    of: "of",
    noData: "No data available.",
    confidentialFallback: "Confidential — for internal use only",
    contents: "Table of contents",
    documentNo: "Document no.",
  },
};

export function chrome(locale: ReportLocale, key: string): string {
  return CHROME[locale]?.[key] ?? CHROME.de[key] ?? key;
}

export function confidentialityText(def: ReportDefinition): string {
  return (
    def.branding.confidentialityNotice?.trim() ||
    chrome(def.locale, "confidentialFallback")
  );
}

// ─── Style resolution (pure, unit-tested) ────────────────────────

function isReportStyle(value: unknown): value is ReportStyle {
  return (
    typeof value === "string" &&
    (REPORT_STYLES as readonly string[]).includes(value)
  );
}

/**
 * Resolve the effective report style: an explicit (query) override wins,
 * then the org branding preference, then "standard". Invalid values
 * degrade instead of throwing — a tampered org_branding row must never
 * break report generation.
 */
export function resolveReportStyle(
  brandingStyle: string | null | undefined,
  override?: string | null,
): ReportStyle {
  if (isReportStyle(override)) return override;
  if (isReportStyle(brandingStyle)) return brandingStyle;
  return "standard";
}

/** Effective style of a report definition (style → branding → standard). */
export function effectiveStyle(def: ReportDefinition): ReportStyle {
  return resolveReportStyle(def.branding.reportTemplate, def.style);
}

/**
 * Deterministic document number for the formal footer when the caller
 * does not provide one: RPT-YYYYMMDD-HHMMSS (UTC).
 */
export function defaultDocumentId(generatedAt: Date): string {
  const p = (n: number, len = 2): string => String(n).padStart(len, "0");
  return (
    `RPT-${generatedAt.getUTCFullYear()}${p(generatedAt.getUTCMonth() + 1)}` +
    `${p(generatedAt.getUTCDate())}-${p(generatedAt.getUTCHours())}` +
    `${p(generatedAt.getUTCMinutes())}${p(generatedAt.getUTCSeconds())}`
  );
}

// ─── Cell formatting ─────────────────────────────────────────────

/** Format a cell value for display according to column format + locale. */
export function formatCell(
  cell: ReportCell,
  format: ReportCellFormat | undefined,
  locale: ReportLocale,
): string {
  if (cell === null || cell === undefined || cell === "") return "";
  switch (format) {
    case "int":
      return typeof cell === "number"
        ? formatNumber(cell, locale, { maximumFractionDigits: 0 })
        : String(cell);
    case "decimal":
      return typeof cell === "number"
        ? formatNumber(cell, locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : String(cell);
    case "percent":
      return typeof cell === "number" ? formatPercent(cell, locale) : String(cell);
    case "date": {
      if (cell instanceof Date) return formatDate(cell, locale);
      // ISO strings from Drizzle date columns
      const d = new Date(String(cell));
      return Number.isNaN(d.getTime()) ? String(cell) : formatDate(d, locale);
    }
    default:
      return cell instanceof Date ? formatDateTime(cell, locale) : String(cell);
  }
}

// ─── Pure layout helpers (unit-tested) ───────────────────────────

/**
 * Distribute totalWidth across columns proportionally to their width
 * weights (default weight 1). Guaranteed to sum to totalWidth (last
 * column absorbs the rounding remainder).
 */
export function computeColumnWidths(
  columns: ReportColumn[],
  totalWidth: number,
): number[] {
  if (columns.length === 0) return [];
  const totalWeight = columns.reduce((acc, c) => acc + (c.width ?? 1), 0);
  const widths = columns.map((c) =>
    Math.floor((totalWidth * (c.width ?? 1)) / totalWeight),
  );
  const used = widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += totalWidth - used;
  return widths;
}

/**
 * Estimate how many wrapped text lines a cell needs at a given column
 * width. avgCharWidth is an empirical Helvetica-9pt average (~4.8pt).
 * Used by the PDF renderer for row-height + page-break decisions.
 */
export function estimateLines(
  text: string,
  columnWidth: number,
  avgCharWidth = 4.8,
  padding = 8,
): number {
  if (!text) return 1;
  const usable = Math.max(columnWidth - padding, avgCharWidth);
  const charsPerLine = Math.max(Math.floor(usable / avgCharWidth), 1);
  let lines = 0;
  for (const chunk of text.split("\n")) {
    lines += Math.max(Math.ceil(chunk.length / charsPerLine), 1);
  }
  return lines;
}

/**
 * Split table rows into page-sized chunks given a per-row line count
 * and the number of lines that fit on the first/subsequent pages.
 * Each chunk re-renders the header row (headerLines are already
 * subtracted from the capacity by the caller). Pure — unit-tested.
 */
export function paginateRows(
  rowLineCounts: number[],
  firstPageLineCapacity: number,
  nextPageLineCapacity: number,
): number[][] {
  const chunks: number[][] = [];
  let current: number[] = [];
  let capacity = Math.max(firstPageLineCapacity, 1);
  let used = 0;

  for (let i = 0; i < rowLineCounts.length; i++) {
    const lines = Math.max(rowLineCounts[i], 1);
    if (used + lines > capacity && current.length > 0) {
      chunks.push(current);
      current = [];
      used = 0;
      capacity = Math.max(nextPageLineCapacity, 1);
    }
    current.push(i);
    used += lines;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// ─── Response helper ─────────────────────────────────────────────

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Wrap a rendered report buffer in a download Response. */
export function reportFileResponse(
  buffer: Buffer,
  baseFilename: string,
  format: ReportFormat,
): Response {
  const safeBase = baseFilename.replace(/[^a-zA-Z0-9\-_]/g, "_");
  const ext = format === "pdf" ? "pdf" : "xlsx";
  const contentType = format === "pdf" ? "application/pdf" : XLSX_MIME;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeBase}.${ext}"`,
    },
  });
}
