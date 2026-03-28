import { db, aiSystem, aiConformityAssessment, aiHumanOversightLog, aiTransparencyEntry, aiFria } from "@grc/db";
import { eq, and, sql, isNull, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [totalSystems, highRisk, unacceptable, pendingAssessments, oversightCount, transparencyCount, friasPending] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(aiSystem).where(and(eq(aiSystem.orgId, ctx.orgId), isNull(aiSystem.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(aiSystem).where(and(eq(aiSystem.orgId, ctx.orgId), eq(aiSystem.riskClassification, "high"), isNull(aiSystem.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(aiSystem).where(and(eq(aiSystem.orgId, ctx.orgId), eq(aiSystem.riskClassification, "unacceptable"), isNull(aiSystem.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(aiConformityAssessment).where(and(eq(aiConformityAssessment.orgId, ctx.orgId), eq(aiConformityAssessment.status, "draft"))),
    db.select({ count: sql<number>`count(*)` }).from(aiHumanOversightLog).where(and(eq(aiHumanOversightLog.orgId, ctx.orgId), gte(aiHumanOversightLog.reviewedAt, thirtyDaysAgo))),
    db.select({ count: sql<number>`count(*)` }).from(aiTransparencyEntry).where(eq(aiTransparencyEntry.orgId, ctx.orgId)),
    db.select({ count: sql<number>`count(*)` }).from(aiFria).where(and(eq(aiFria.orgId, ctx.orgId), eq(aiFria.status, "draft"))),
  ]);

  return Response.json({
    data: {
      totalSystems: Number(totalSystems[0]?.count ?? 0),
      highRiskSystems: Number(highRisk[0]?.count ?? 0),
      unacceptableSystems: Number(unacceptable[0]?.count ?? 0),
      pendingAssessments: Number(pendingAssessments[0]?.count ?? 0),
      oversightLogs30d: Number(oversightCount[0]?.count ?? 0),
      transparencyEntries: Number(transparencyCount[0]?.count ?? 0),
      friasPending: Number(friasPending[0]?.count ?? 0),
      frameworkCompliance: {},
      systemsByRisk: {},
      recentOversightLogs: [],
    },
  });
}
