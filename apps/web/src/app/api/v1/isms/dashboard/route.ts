import { db, asset, assetClassification, securityIncident, threat, vulnerability } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/dashboard
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Asset counts
  const [{ totalAssets }] = await db
    .select({ totalAssets: sql<number>`count(*)::int` })
    .from(asset)
    .where(and(eq(asset.orgId, ctx.orgId), isNull(asset.deletedAt)));

  // Classification counts
  const classificationRows = await db
    .select({
      overallProtection: assetClassification.overallProtection,
      count: sql<number>`count(*)::int`,
    })
    .from(assetClassification)
    .where(eq(assetClassification.orgId, ctx.orgId))
    .groupBy(assetClassification.overallProtection);

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

  // Incident counts by status
  const incidentStatusRows = await db
    .select({
      status: securityIncident.status,
      count: sql<number>`count(*)::int`,
    })
    .from(securityIncident)
    .where(and(eq(securityIncident.orgId, ctx.orgId), isNull(securityIncident.deletedAt)))
    .groupBy(securityIncident.status);

  const incidentsByStatus: Record<string, number> = {};
  let totalIncidents = 0;
  for (const row of incidentStatusRows) {
    incidentsByStatus[row.status] = row.count;
    totalIncidents += row.count;
  }

  const openIncidents = totalIncidents - (incidentsByStatus["closed"] ?? 0);

  // Incident counts by severity
  const incidentSeverityRows = await db
    .select({
      severity: securityIncident.severity,
      count: sql<number>`count(*)::int`,
    })
    .from(securityIncident)
    .where(and(eq(securityIncident.orgId, ctx.orgId), isNull(securityIncident.deletedAt)))
    .groupBy(securityIncident.severity);

  const incidentsBySeverity: Record<string, number> = {};
  for (const row of incidentSeverityRows) {
    incidentsBySeverity[row.severity] = row.count;
  }

  // Threat count
  const [{ threatCount }] = await db
    .select({ threatCount: sql<number>`count(*)::int` })
    .from(threat)
    .where(eq(threat.orgId, ctx.orgId));

  // Vulnerability counts
  const vulnRows = await db
    .select({
      severity: vulnerability.severity,
      count: sql<number>`count(*)::int`,
    })
    .from(vulnerability)
    .where(and(eq(vulnerability.orgId, ctx.orgId), isNull(vulnerability.deletedAt)))
    .groupBy(vulnerability.severity);

  const vulnsBySeverity: Record<string, number> = {};
  let totalVulns = 0;
  for (const row of vulnRows) {
    vulnsBySeverity[row.severity] = row.count;
    totalVulns += row.count;
  }

  // Recent incidents
  const recentIncidents = await db
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
    .where(and(eq(securityIncident.orgId, ctx.orgId), isNull(securityIncident.deletedAt)))
    .orderBy(sql`${securityIncident.detectedAt} DESC`)
    .limit(10);

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
