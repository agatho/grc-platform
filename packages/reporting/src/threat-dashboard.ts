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
  const activeThreats = (threatsResult as Record<string, unknown>)
    .cnt as number;

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
  const openIncidents = (incidentsResult as Record<string, unknown>)
    .cnt as number;

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
 *
 * [ARCTOS-FULL-2026-08-31 / Restdefekte · O-3]
 * `GET /api/v1/isms/threats/heatmap` answered 500 with
 * `column v.asset_id does not exist` (42703). The raw SQL joined
 * `asset a ON v.asset_id = a.id`, but `vulnerability` has never carried an
 * `asset_id`: the column is `affected_asset_id` (see
 * `vulnerability_affected_asset_id_asset_id_fk` and index `vuln_asset_idx`).
 * The query could therefore never have run — on any database, with any data.
 *
 * The asset is resolved through `risk_scenario.asset_id` FIRST and only then
 * through the vulnerability. A scenario names its asset directly; the
 * vulnerability's asset is the fallback for scenarios that were entered
 * vulnerability-first. Joining through the vulnerability alone would have
 * bucketed every directly-assigned scenario into the 'normal' tier even
 * after the column name was corrected.
 *
 * `GROUP BY … asset_tier` was a second, hidden defect on the same statement:
 * `asset` HAS a real column called `asset_tier`, and PostgreSQL resolves a
 * bare GROUP BY identifier to an INPUT column before an output alias. The
 * grouping therefore bound to `a.asset_tier`, and the statement failed with
 * 42803 the moment the join above it was corrected. The grouping expression
 * is written out now, which is unambiguous by construction.
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
    LEFT JOIN asset a ON a.id = COALESCE(rs.asset_id, v.affected_asset_id)
    LEFT JOIN asset_classification ac ON ac.asset_id = a.id
    WHERE t.org_id = ${orgId}
    GROUP BY t.threat_category, COALESCE(ac.overall_protection, 'normal')
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
 *
 * [ARCTOS-FULL-2026-08-31 / Restdefekte · O-3]
 * `GET /api/v1/isms/threats/top` carried the SAME two defects as the heatmap
 * above and answered 500 as well:
 *   1. `v.asset_id` does not exist — the column is `affected_asset_id`;
 *   2. `sum(… * count(…))` is a nested aggregate, which PostgreSQL rejects
 *      outright ("aggregate function calls cannot be nested"). Since `t.id`
 *      is in the GROUP BY, `t.likelihood_rating` is functionally dependent
 *      and the multiplication needs no outer aggregate at all.
 * Fixing only the endpoint named in the finding would have left the second
 * route 500-ing on the identical two lines.
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
      count(DISTINCT COALESCE(rs.asset_id, v.affected_asset_id))::int as affected_assets,
      (COALESCE(t.likelihood_rating, 1) * count(DISTINCT rs.id))::int as impact_score
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
 * Kontrollabdeckung je Bedrohungskategorie.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-140] Hier stand
 * `LEFT JOIN process_control pc ON pc.process_id IS NOT NULL` — eine Bedingung
 * ohne einen einzigen Bezug zu `t`, `rs` oder `v`. Das ist kein Verbund,
 * sondern ein Kreuzprodukt mit der gesamten Tabelle, und der abgeleitete
 * Zähler `CASE WHEN pc.control_id IS NOT NULL` beantwortet deshalb nicht
 * „ist diese Schwachstelle abgedeckt", sondern „gibt es irgendwo in der
 * Datenbank eine Prozess-Kontroll-Verknüpfung". Die Kennzahl konnte damit nur
 * zwei Werte annehmen — 100 % für jede Kategorie oder 0 % für jede — und
 * kostete dabei ein Kreuzprodukt aus Schwachstellen × `process_control`.
 *
 * Abgedeckt heisst jetzt, was die Spalten sagen:
 *   * `vulnerability.mitigation_control_id` ist gesetzt — die Schwachstelle
 *     hat eine benannte mindernde Kontrolle, oder
 *   * das Risiko des Szenarios trägt mindestens eine Kontrolle
 *     (`risk_control`) — dieselbe Aussage eine Ebene höher.
 *
 * `process_control` bleibt aussen vor: es verknüpft Kontrollen mit
 * PROZESSEN und sagt über eine Schwachstelle nichts aus.
 */
export async function getControlCoverage(
  orgId: string,
): Promise<ThreatControlCoverage[]> {
  const rows = await db.execute(sql`
    SELECT
      t.threat_category,
      count(DISTINCT v.id)::int AS total_vulnerabilities,
      count(DISTINCT v.id) FILTER (
        WHERE v.mitigation_control_id IS NOT NULL
           OR EXISTS (
                SELECT 1 FROM risk_control rc
                 WHERE rc.risk_id = rs.risk_id
                   AND rc.org_id = ${orgId}
              )
      )::int AS covered_vulnerabilities
    FROM threat t
    JOIN risk_scenario rs ON rs.threat_id = t.id AND rs.org_id = ${orgId}
    JOIN vulnerability v ON rs.vulnerability_id = v.id
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
