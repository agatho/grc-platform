// Sprint 30: Section data fetcher — resolves data for each report section
// Each section type (table/chart/kpi) fetches from existing DB tables

import { db } from "@grc/db";
import { sql, eq, and, gte, lte, count as countFn } from "drizzle-orm";
import type { ReportSectionConfig } from "@grc/shared";

export interface FetchContext {
  orgId: string;
  parameters: Record<string, unknown>;
}

export interface TableData {
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
}

export interface KPIData {
  value: number | string;
  label: string;
  trend?: "up" | "down" | "stable";
  previousValue?: number | string;
}

// Data source registry — maps data source identifiers to query functions
const TABLE_DATA_SOURCES: Record<
  string,
  (ctx: FetchContext) => Promise<TableData>
> = {
  "erm.risk_register": fetchRiskRegisterTable,
  "ics.control_effectiveness": fetchControlEffectivenessTable,
  "isms.incidents": fetchIncidentsTable,
  "isms.threats": fetchThreatsTable,
  "isms.vulnerabilities": fetchVulnerabilitiesTable,
};

const KPI_DATA_SOURCES: Record<
  string,
  (ctx: FetchContext) => Promise<KPIData>
> = {
  "erm.risk_count": fetchRiskCount,
  "erm.high_risk_count": fetchHighRiskCount,
  "ics.avg_ces": fetchAvgCES,
  "ics.control_count": fetchControlCount,
  "isms.incident_count": fetchIncidentCount,
  "isms.threat_count": fetchThreatCount,
  "isms.posture_score": fetchPostureScore,
};

const CHART_DATA_SOURCES: Record<
  string,
  (ctx: FetchContext) => Promise<ChartData>
> = {
  "erm.risk_by_category": fetchRiskByCategory,
  "erm.risk_trend": fetchRiskTrend,
  "ics.ces_distribution": fetchCESDistribution,
  "isms.incident_by_severity": fetchIncidentBySeverity,
};

/**
 * Fetch table data for a section
 */
export async function fetchTableData(
  dataSource: string | undefined,
  ctx: FetchContext,
): Promise<TableData> {
  if (!dataSource) return { headers: [], rows: [] };
  const fetcher = TABLE_DATA_SOURCES[dataSource];
  if (!fetcher) return { headers: [], rows: [] };
  return fetcher(ctx);
}

/**
 * Fetch chart data for a section
 */
export async function fetchChartData(
  dataSource: string | undefined,
  ctx: FetchContext,
): Promise<ChartData> {
  if (!dataSource) return { labels: [], datasets: [] };
  const fetcher = CHART_DATA_SOURCES[dataSource];
  if (!fetcher) return { labels: [], datasets: [] };
  return fetcher(ctx);
}

/**
 * Fetch KPI value for a section
 */
export async function fetchKPIValue(
  dataSource: string | undefined,
  ctx: FetchContext,
): Promise<KPIData> {
  if (!dataSource) return { value: 0, label: "N/A" };
  const fetcher = KPI_DATA_SOURCES[dataSource];
  if (!fetcher) return { value: 0, label: "N/A" };
  return fetcher(ctx);
}

// ──────────────────────────────────────────────────────────────
// ERM data sources
// ──────────────────────────────────────────────────────────────

async function fetchRiskRegisterTable(ctx: FetchContext): Promise<TableData> {
  const rows = await db.execute(sql`
    SELECT r.element_id, r.title, r.risk_category, r.inherent_likelihood,
           r.inherent_impact, r.residual_likelihood, r.residual_impact, r.status
    FROM risk r
    WHERE r.org_id = ${ctx.orgId}
      AND r.deleted_at IS NULL
    ORDER BY (r.inherent_likelihood * r.inherent_impact) DESC NULLS LAST
    LIMIT 200
  `);
  return {
    headers: [
      "ID",
      "Title",
      "Category",
      "Inherent L",
      "Inherent I",
      "Residual L",
      "Residual I",
      "Status",
    ],
    rows: rows as unknown as Array<Record<string, unknown>>,
  };
}

async function fetchRiskCount(ctx: FetchContext): Promise<KPIData> {
  const [result] = await db.execute(sql`
    SELECT count(*)::int as cnt FROM risk
    WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
  `);
  return {
    value: (result as Record<string, unknown>).cnt as number,
    label: "Total Risks",
  };
}

async function fetchHighRiskCount(ctx: FetchContext): Promise<KPIData> {
  const [result] = await db.execute(sql`
    SELECT count(*)::int as cnt FROM risk
    WHERE org_id = ${ctx.orgId}
      AND deleted_at IS NULL
      AND (inherent_likelihood * inherent_impact) >= 15
  `);
  return {
    value: (result as Record<string, unknown>).cnt as number,
    label: "High Risks",
    trend: "stable",
  };
}

async function fetchRiskByCategory(ctx: FetchContext): Promise<ChartData> {
  const rows = await db.execute(sql`
    SELECT risk_category as category, count(*)::int as cnt
    FROM risk
    WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
    GROUP BY risk_category
    ORDER BY cnt DESC
    LIMIT 10
  `);
  const data = rows as unknown as Array<{ category: string; cnt: number }>;
  return {
    labels: data.map((r) => r.category || "Uncategorized"),
    datasets: [
      {
        label: "Risks",
        data: data.map((r) => r.cnt),
      },
    ],
  };
}

async function fetchRiskTrend(ctx: FetchContext): Promise<ChartData> {
  const rows = await db.execute(sql`
    SELECT to_char(created_at, 'YYYY-MM') as month, count(*)::int as cnt
    FROM risk
    WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
      AND created_at >= now() - interval '12 months'
    GROUP BY month
    ORDER BY month
  `);
  const data = rows as unknown as Array<{ month: string; cnt: number }>;
  return {
    labels: data.map((r) => r.month),
    datasets: [
      {
        label: "New Risks",
        data: data.map((r) => r.cnt),
      },
    ],
  };
}

// ──────────────────────────────────────────────────────────────
// ICS data sources
// ──────────────────────────────────────────────────────────────

async function fetchControlEffectivenessTable(
  ctx: FetchContext,
): Promise<TableData> {
  const rows = await db.execute(sql`
    SELECT c.element_id, c.title, c.effectiveness_score, c.status,
           c.test_frequency, c.last_test_date
    FROM control c
    WHERE c.org_id = ${ctx.orgId}
      AND c.deleted_at IS NULL
    ORDER BY c.effectiveness_score ASC NULLS LAST
    LIMIT 200
  `);
  return {
    headers: [
      "ID",
      "Title",
      "CES",
      "Status",
      "Test Frequency",
      "Last Test",
    ],
    rows: rows as unknown as Array<Record<string, unknown>>,
  };
}

async function fetchAvgCES(ctx: FetchContext): Promise<KPIData> {
  const [result] = await db.execute(sql`
    SELECT coalesce(round(avg(effectiveness_score)::numeric, 1), 0) as avg_ces
    FROM control
    WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
  `);
  return {
    value: Number((result as Record<string, unknown>).avg_ces),
    label: "Avg. Control Effectiveness",
  };
}

async function fetchControlCount(ctx: FetchContext): Promise<KPIData> {
  const [result] = await db.execute(sql`
    SELECT count(*)::int as cnt FROM control
    WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
  `);
  return {
    value: (result as Record<string, unknown>).cnt as number,
    label: "Total Controls",
  };
}

async function fetchCESDistribution(ctx: FetchContext): Promise<ChartData> {
  const rows = await db.execute(sql`
    SELECT
      CASE
        WHEN effectiveness_score >= 80 THEN 'Effective'
        WHEN effectiveness_score >= 60 THEN 'Partially Effective'
        WHEN effectiveness_score >= 40 THEN 'Needs Improvement'
        ELSE 'Ineffective'
      END as bucket,
      count(*)::int as cnt
    FROM control
    WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL AND effectiveness_score IS NOT NULL
    GROUP BY bucket
    ORDER BY cnt DESC
  `);
  const data = rows as unknown as Array<{ bucket: string; cnt: number }>;
  return {
    labels: data.map((r) => r.bucket),
    datasets: [{ label: "Controls", data: data.map((r) => r.cnt) }],
  };
}

// ──────────────────────────────────────────────────────────────
// ISMS data sources
// ──────────────────────────────────────────────────────────────

async function fetchIncidentsTable(ctx: FetchContext): Promise<TableData> {
  const rows = await db.execute(sql`
    SELECT si.element_id, si.title, si.severity, si.status,
           si.detected_at, si.category
    FROM security_incident si
    WHERE si.org_id = ${ctx.orgId}
    ORDER BY si.detected_at DESC NULLS LAST
    LIMIT 200
  `);
  return {
    headers: ["ID", "Title", "Severity", "Status", "Detected", "Category"],
    rows: rows as unknown as Array<Record<string, unknown>>,
  };
}

async function fetchThreatsTable(ctx: FetchContext): Promise<TableData> {
  const rows = await db.execute(sql`
    SELECT t.code, t.title, t.threat_category, t.likelihood_rating
    FROM threat t
    WHERE t.org_id = ${ctx.orgId}
    ORDER BY t.likelihood_rating DESC NULLS LAST
    LIMIT 200
  `);
  return {
    headers: ["Code", "Title", "Category", "Likelihood"],
    rows: rows as unknown as Array<Record<string, unknown>>,
  };
}

async function fetchVulnerabilitiesTable(
  ctx: FetchContext,
): Promise<TableData> {
  const rows = await db.execute(sql`
    SELECT v.title, v.severity, v.status, v.cvss_score
    FROM vulnerability v
    WHERE v.org_id = ${ctx.orgId}
    ORDER BY v.cvss_score DESC NULLS LAST
    LIMIT 200
  `);
  return {
    headers: ["Title", "Severity", "Status", "CVSS"],
    rows: rows as unknown as Array<Record<string, unknown>>,
  };
}

async function fetchIncidentCount(ctx: FetchContext): Promise<KPIData> {
  const [result] = await db.execute(sql`
    SELECT count(*)::int as cnt FROM security_incident
    WHERE org_id = ${ctx.orgId}
      AND status NOT IN ('closed', 'lessons_learned')
  `);
  return {
    value: (result as Record<string, unknown>).cnt as number,
    label: "Open Incidents",
  };
}

async function fetchThreatCount(ctx: FetchContext): Promise<KPIData> {
  const [result] = await db.execute(sql`
    SELECT count(*)::int as cnt FROM threat
    WHERE org_id = ${ctx.orgId}
  `);
  return {
    value: (result as Record<string, unknown>).cnt as number,
    label: "Total Threats",
  };
}

async function fetchPostureScore(ctx: FetchContext): Promise<KPIData> {
  // Posture score is a composite metric — return placeholder if no data
  return {
    value: 0,
    label: "Security Posture Score",
    trend: "stable",
  };
}

async function fetchIncidentBySeverity(
  ctx: FetchContext,
): Promise<ChartData> {
  const rows = await db.execute(sql`
    SELECT severity, count(*)::int as cnt
    FROM security_incident
    WHERE org_id = ${ctx.orgId}
    GROUP BY severity
    ORDER BY cnt DESC
  `);
  const data = rows as unknown as Array<{ severity: string; cnt: number }>;
  return {
    labels: data.map((r) => r.severity),
    datasets: [{ label: "Incidents", data: data.map((r) => r.cnt) }],
  };
}

/**
 * Get list of available data sources for the template builder.
 */
export function getAvailableDataSources(): {
  tables: string[];
  charts: string[];
  kpis: string[];
} {
  return {
    tables: Object.keys(TABLE_DATA_SOURCES),
    charts: Object.keys(CHART_DATA_SOURCES),
    kpis: Object.keys(KPI_DATA_SOURCES),
  };
}
