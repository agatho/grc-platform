// Sprint 30: Threat Landscape Dashboard data aggregation
// Computes heatmap, top threats, trends, control coverage

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import type {
  ThreatDashboardKPIs,
  ThreatHeatmapCell,
  ThreatTrendPoint,
  ThreatTopEntry,
  ThreatControlCoverage,
} from "@grc/shared";

/**
 * Get aggregated KPIs for the threat landscape dashboard.
 */
export async function getThreatDashboardKPIs(
  orgId: string,
): Promise<ThreatDashboardKPIs> {
  // Active threats
  const [threatsResult] = await db.execute(sql`
    SELECT count(*)::int as cnt FROM threat WHERE org_id = ${orgId}
  `);
  const activeThreats = (threatsResult as Record<string, unknown>).cnt as number;

  // New CVEs in last 7 days
  const [cvesResult] = await db.execute(sql`
    SELECT count(*)::int as cnt FROM cve_feed_item
    WHERE published_at >= now() - interval '7 days'
  `);
  const newCves7d = (cvesResult as Record<string, unknown>).cnt as number;

  // Open incidents
  const [incidentsResult] = await db.execute(sql`
    SELECT count(*)::int as cnt FROM security_incident
    WHERE org_id = ${orgId}
      AND status NOT IN ('closed', 'lessons_learned')
  `);
  const openIncidents = (incidentsResult as Record<string, unknown>).cnt as number;

  // Average CVSS
  const [cvssResult] = await db.execute(sql`
    SELECT coalesce(round(avg(cvss_score::numeric), 1), 0) as avg_score
    FROM cve_feed_item
    WHERE published_at >= now() - interval '90 days'
      AND cvss_score IS NOT NULL
  `);
  const avgCvss = Number((cvssResult as Record<string, unknown>).avg_score);

  // Critical CVEs last 30 days
  const [critResult] = await db.execute(sql`
    SELECT count(*)::int as cnt FROM cve_feed_item
    WHERE published_at >= now() - interval '30 days'
      AND cvss_severity = 'critical'
  `);
  const criticalCves = (critResult as Record<string, unknown>).cnt as number;

  // Mitigated threats this month (risk scenarios that moved to mitigated)
  const mitigatedThreatsMonth = 0; // Placeholder — computed from risk_scenario status changes

  return {
    activeThreats,
    newCves7d,
    openIncidents,
    avgCvss,
    criticalCves,
    mitigatedThreatsMonth,
  };
}

/**
 * Compute heatmap data: threat categories vs asset tiers.
 */
export async function getThreatHeatmap(
  orgId: string,
): Promise<ThreatHeatmapCell[]> {
  const rows = await db.execute(sql`
    SELECT
      t.threat_category,
      COALESCE(ac.overall_protection, 'normal') as asset_tier,
      count(DISTINCT rs.id)::int as scenario_count
    FROM threat t
    LEFT JOIN risk_scenario rs ON rs.threat_id = t.id AND rs.org_id = ${orgId}
    LEFT JOIN vulnerability v ON rs.vulnerability_id = v.id
    LEFT JOIN asset a ON v.asset_id = a.id
    LEFT JOIN asset_classification ac ON ac.asset_id = a.id
    WHERE t.org_id = ${orgId}
    GROUP BY t.threat_category, asset_tier
    ORDER BY scenario_count DESC
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((row) => {
    const count = row.scenario_count as number;
    let color: ThreatHeatmapCell["color"] = "white";
    if (count >= 6) color = "red";
    else if (count >= 3) color = "orange";
    else if (count >= 1) color = "yellow";

    return {
      threatCategory: (row.threat_category as string) || "Unknown",
      assetTier: (row.asset_tier as string) || "normal",
      count,
      color,
    };
  });
}

/**
 * Get top-10 threats sorted by impact (risk scenarios * assets).
 */
export async function getTopThreats(
  orgId: string,
  limit: number = 10,
): Promise<ThreatTopEntry[]> {
  const rows = await db.execute(sql`
    SELECT
      t.id as threat_id,
      t.title,
      t.code,
      t.threat_category as category,
      count(DISTINCT rs.id)::int as risk_scenario_count,
      count(DISTINCT v.asset_id)::int as affected_assets,
      coalesce(sum(COALESCE(t.likelihood_rating, 1) * count(DISTINCT rs.id)::int), 0)::int as impact_score
    FROM threat t
    LEFT JOIN risk_scenario rs ON rs.threat_id = t.id AND rs.org_id = ${orgId}
    LEFT JOIN vulnerability v ON rs.vulnerability_id = v.id
    WHERE t.org_id = ${orgId}
    GROUP BY t.id, t.title, t.code, t.threat_category
    ORDER BY risk_scenario_count DESC, affected_assets DESC
    LIMIT ${limit}
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    threatId: row.threat_id as string,
    title: row.title as string,
    code: (row.code as string) || null,
    category: (row.category as string) || null,
    impactScore: row.impact_score as number,
    affectedAssets: row.affected_assets as number,
    riskScenarioCount: row.risk_scenario_count as number,
  }));
}

/**
 * Get monthly trend data for threats and incidents.
 */
export async function getThreatTrends(
  orgId: string,
  months: number = 12,
): Promise<ThreatTrendPoint[]> {
  const rows = await db.execute(sql`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', now()) - (${months} || ' months')::interval,
        date_trunc('month', now()),
        '1 month'::interval
      ) as month
    ),
    new_threats AS (
      SELECT date_trunc('month', created_at) as month, count(*)::int as cnt
      FROM threat WHERE org_id = ${orgId}
      GROUP BY 1
    ),
    new_incidents AS (
      SELECT date_trunc('month', detected_at) as month, count(*)::int as cnt
      FROM security_incident WHERE org_id = ${orgId}
      GROUP BY 1
    ),
    new_cves AS (
      SELECT date_trunc('month', published_at) as month, count(*)::int as cnt
      FROM cve_feed_item
      WHERE published_at >= now() - (${months} || ' months')::interval
      GROUP BY 1
    )
    SELECT
      to_char(m.month, 'YYYY-MM') as month,
      coalesce(nt.cnt, 0) as new_threats,
      0 as mitigated_threats,
      coalesce(nc.cnt, 0) as cve_count,
      coalesce(ni.cnt, 0) as incident_count
    FROM months m
    LEFT JOIN new_threats nt ON nt.month = m.month
    LEFT JOIN new_incidents ni ON ni.month = m.month
    LEFT JOIN new_cves nc ON nc.month = m.month
    ORDER BY m.month
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    month: row.month as string,
    newThreats: row.new_threats as number,
    mitigatedThreats: row.mitigated_threats as number,
    cveCount: row.cve_count as number,
    incidentCount: row.incident_count as number,
  }));
}

/**
 * Get control coverage per threat category.
 */
export async function getControlCoverage(
  orgId: string,
): Promise<ThreatControlCoverage[]> {
  const rows = await db.execute(sql`
    SELECT
      t.threat_category,
      count(DISTINCT v.id)::int as total_vulnerabilities,
      count(DISTINCT CASE WHEN pc.control_id IS NOT NULL THEN v.id END)::int as covered_vulnerabilities
    FROM threat t
    JOIN risk_scenario rs ON rs.threat_id = t.id AND rs.org_id = ${orgId}
    JOIN vulnerability v ON rs.vulnerability_id = v.id
    LEFT JOIN process_control pc ON pc.process_id IS NOT NULL
    WHERE t.org_id = ${orgId}
      AND t.threat_category IS NOT NULL
    GROUP BY t.threat_category
    ORDER BY total_vulnerabilities DESC
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((row) => {
    const total = row.total_vulnerabilities as number;
    const covered = row.covered_vulnerabilities as number;
    return {
      threatCategory: row.threat_category as string,
      totalVulnerabilities: total,
      coveredVulnerabilities: covered,
      coveragePercent: total > 0 ? Math.round((covered / total) * 100) : 0,
    };
  });
}
