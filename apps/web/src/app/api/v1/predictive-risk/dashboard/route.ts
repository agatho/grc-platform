import { db, riskPredictionModel, riskPrediction, riskAnomalyDetection } from "@grc/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/predictive-risk/dashboard
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const [modelStats] = await db
    .select({
      activeModels: sql<number>`count(*) filter (where ${riskPredictionModel.isActive} = true)`,
      avgAccuracy: sql<number>`coalesce(avg(${riskPredictionModel.accuracy}) filter (where ${riskPredictionModel.isActive} = true), 0)`,
    })
    .from(riskPredictionModel)
    .where(eq(riskPredictionModel.orgId, ctx.orgId));

  const [predStats] = await db
    .select({
      totalPredictions: sql<number>`count(*)`,
      earlyWarnings: sql<number>`count(*) filter (where ${riskPrediction.earlyWarning} = true)`,
    })
    .from(riskPrediction)
    .where(and(eq(riskPrediction.orgId, ctx.orgId), eq(riskPrediction.isActive, true)));

  const [anomalyStats] = await db
    .select({
      activeAnomalies: sql<number>`count(*) filter (where ${riskAnomalyDetection.status} in ('new', 'investigating'))`,
      criticalAnomalies: sql<number>`count(*) filter (where ${riskAnomalyDetection.severity} = 'critical' and ${riskAnomalyDetection.status} in ('new', 'investigating'))`,
    })
    .from(riskAnomalyDetection)
    .where(eq(riskAnomalyDetection.orgId, ctx.orgId));

  const topAnomalies = await db.select().from(riskAnomalyDetection)
    .where(and(
      eq(riskAnomalyDetection.orgId, ctx.orgId),
      sql`${riskAnomalyDetection.status} in ('new', 'investigating')`,
    ))
    .orderBy(desc(riskAnomalyDetection.detectedAt))
    .limit(10);

  const topEarlyWarnings = await db.select().from(riskPrediction)
    .where(and(
      eq(riskPrediction.orgId, ctx.orgId),
      eq(riskPrediction.isActive, true),
      eq(riskPrediction.earlyWarning, true),
    ))
    .orderBy(desc(riskPrediction.createdAt))
    .limit(10);

  return Response.json({
    data: {
      ...modelStats,
      ...predStats,
      ...anomalyStats,
      topAnomalies,
      topEarlyWarnings,
    },
  });
}
