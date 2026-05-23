import {
  db,
  asset,
  assetClassification,
  securityIncident,
  threat,
  vulnerability,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/dashboard
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // #PERF-MEDIUM-F08: previously 7 sequential queries — collapsed into
  // a single Promise.all batch. All 7 are independent (no
  // cross-dependencies), so the planner runs them concurrently on the
  // node-postgres pool. With a single round-trip of network latency
  // each, the dashboard now resolves in 1× the slowest query instead
  // of sum-of-all.
  const [
    [{ totalAssets }],
    classificationRows,
    incidentStatusRows,
    incidentSeverityRows,
    [{ threatCount }],
    vulnRows,
    recentIncidents,
  ] = await Promise.all([
    db
      .select({ totalAssets: sql<number>`count(*)::int` })
      .from(asset)
      .where(and(eq(asset.orgId, ctx.orgId), isNull(asset.deletedAt))),
    db
      .select({
        overallProtection: assetClassification.overallProtection,
        count: sql<number>`count(*)::int`,
      })
      .from(assetClassification)
      .where(eq(assetClassification.orgId, ctx.orgId))
      .groupBy(assetClassification.overallProtection),
    db
      .select({
        status: securityIncident.status,
        count: sql<number>`count(*)::int`,
      })
      .from(securityIncident)
      .where(
        and(
          eq(securityIncident.orgId, ctx.orgId),
          isNull(securityIncident.deletedAt),
        ),
      )
      .groupBy(securityIncident.status),
    db
      .select({
        severity: securityIncident.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(securityIncident)
      .where(
        and(
          eq(securityIncident.orgId, ctx.orgId),
          isNull(securityIncident.deletedAt),
        ),
      )
      .groupBy(securityIncident.severity),
    db
      .select({ threatCount: sql<number>`count(*)::int` })
      .from(threat)
      .where(eq(threat.orgId, ctx.orgId)),
    db
      .select({
        severity: vulnerability.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(vulnerability)
      .where(
        and(
          eq(vulnerability.orgId, ctx.orgId),
          isNull(vulnerability.deletedAt),
        ),
      )
      .groupBy(vulnerability.severity),
    db
      .select({
        id: securityIncident.id,
        elementId: securityIncident.elementId,
        title: securityIncident.title,
        severity: securityIncident.severity,
        status: securityIncident.status,
        detectedAt: securityIncident.detectedAt,
        isDataBreach: securityIncident.isDataBreach,
        dataBreachDeadline: securityIncident.dataBreachDeadline,
      })
      .from(securityIncident)
      .where(
        and(
          eq(securityIncident.orgId, ctx.orgId),
          isNull(securityIncident.deletedAt),
        ),
      )
      .orderBy(sql`${securityIncident.detectedAt} DESC`)
      .limit(10),
  ]);

  // Post-process the 7 batched query results.
  const classificationStats: Record<string, number> = {
    normal: 0,
    high: 0,
    very_high: 0,
  };
  let classifiedCount = 0;
  for (const row of classificationRows) {
    classificationStats[row.overallProtection] = row.count;
    classifiedCount += row.count;
  }
  const unclassifiedCount = totalAssets - classifiedCount;

  const incidentsByStatus: Record<string, number> = {};
  let totalIncidents = 0;
  for (const row of incidentStatusRows) {
    incidentsByStatus[row.status] = row.count;
    totalIncidents += row.count;
  }
  const openIncidents = totalIncidents - (incidentsByStatus["closed"] ?? 0);

  const incidentsBySeverity: Record<string, number> = {};
  for (const row of incidentSeverityRows) {
    incidentsBySeverity[row.severity] = row.count;
  }

  const vulnsBySeverity: Record<string, number> = {};
  let totalVulns = 0;
  for (const row of vulnRows) {
    vulnsBySeverity[row.severity] = row.count;
    totalVulns += row.count;
  }

  return Response.json({
    data: {
      assets: {
        total: totalAssets,
        classified: classifiedCount,
        unclassified: unclassifiedCount,
        byProtection: classificationStats,
      },
      incidents: {
        total: totalIncidents,
        open: openIncidents,
        byStatus: incidentsByStatus,
        bySeverity: incidentsBySeverity,
        recent: recentIncidents,
      },
      threats: {
        total: threatCount,
      },
      vulnerabilities: {
        total: totalVulns,
        bySeverity: vulnsBySeverity,
      },
    },
  });
}
