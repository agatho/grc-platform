import { db, doraIctRisk, doraIctIncident, doraIctProvider, doraTlptPlan, doraNis2CrossRef } from "@grc/db";
import { eq, and, sql, isNull, ne } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const [
    totalIctRisks, criticalRisks, openIncidents, majorIncidents,
    totalProviders, criticalProviders, pendingReports, nis2Stats,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(doraIctRisk).where(and(eq(doraIctRisk.orgId, ctx.orgId), isNull(doraIctRisk.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(doraIctRisk).where(and(eq(doraIctRisk.orgId, ctx.orgId), eq(doraIctRisk.riskLevel, "critical"), isNull(doraIctRisk.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(doraIctIncident).where(and(eq(doraIctIncident.orgId, ctx.orgId), ne(doraIctIncident.status, "closed"))),
    db.select({ count: sql<number>`count(*)` }).from(doraIctIncident).where(and(eq(doraIctIncident.orgId, ctx.orgId), eq(doraIctIncident.classification, "major"), ne(doraIctIncident.status, "closed"))),
    db.select({ count: sql<number>`count(*)` }).from(doraIctProvider).where(eq(doraIctProvider.orgId, ctx.orgId)),
    db.select({ count: sql<number>`count(*)` }).from(doraIctProvider).where(and(eq(doraIctProvider.orgId, ctx.orgId), eq(doraIctProvider.criticality, "critical"))),
    db.select({ count: sql<number>`count(*)` }).from(doraIctIncident).where(and(eq(doraIctIncident.orgId, ctx.orgId), sql`initial_report_sent IS NULL AND initial_report_due < now()`)),
    db.select({ count: sql<number>`count(*)` }).from(doraNis2CrossRef).where(and(eq(doraNis2CrossRef.orgId, ctx.orgId), eq(doraNis2CrossRef.complianceStatus, "compliant"))),
  ]);

  const totalNis2 = await db.select({ count: sql<number>`count(*)` }).from(doraNis2CrossRef).where(eq(doraNis2CrossRef.orgId, ctx.orgId));

  return Response.json({
    data: {
      totalIctRisks: Number(totalIctRisks[0]?.count ?? 0),
      criticalRisks: Number(criticalRisks[0]?.count ?? 0),
      openIncidents: Number(openIncidents[0]?.count ?? 0),
      majorIncidents: Number(majorIncidents[0]?.count ?? 0),
      totalProviders: Number(totalProviders[0]?.count ?? 0),
      criticalProviders: Number(criticalProviders[0]?.count ?? 0),
      pendingReports: Number(pendingReports[0]?.count ?? 0),
      nis2ComplianceRate: Number(totalNis2[0]?.count) > 0
        ? Math.round((Number(nis2Stats[0]?.count ?? 0) / Number(totalNis2[0]?.count)) * 100)
        : 0,
      upcomingTlptTests: [],
      recentIncidents: [],
    },
  });
}
