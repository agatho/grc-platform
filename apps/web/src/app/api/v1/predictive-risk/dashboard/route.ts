import {
  db,
  riskPredictionModel,
  riskPrediction,
  riskAnomalyDetection,
} from "@grc/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/predictive-risk/dashboard
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("erm", ctx.orgId, req.method);
  if (m) return m;

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
    .where(
      and(
        eq(riskPrediction.orgId, ctx.orgId),
        eq(riskPrediction.isActive, true),
      ),
    );

  const [anomalyStats] = await db
    .select({
      activeAnomalies: sql<number>`count(*) filter (where ${riskAnomalyDetection.status} in ('new', 'investigating'))`,
      criticalAnomalies: sql<number>`count(*) filter (where ${riskAnomalyDetection.severity} = 'critical' and ${riskAnomalyDetection.status} in ('new', 'investigating'))`,
    })
    .from(riskAnomalyDetection)
    .where(eq(riskAnomalyDetection.orgId, ctx.orgId));

  const topAnomalies = await db
    .select()
    .from(riskAnomalyDetection)
    .where(
      and(
        eq(riskAnomalyDetection.orgId, ctx.orgId),
        sql`${riskAnomalyDetection.status} in ('new', 'investigating')`,
      ),
    )
    .orderBy(desc(riskAnomalyDetection.detectedAt))
    .limit(10);

  const topEarlyWarnings = await db
    .select()
    .from(riskPrediction)
    .where(
      and(
        eq(riskPrediction.orgId, ctx.orgId),
        eq(riskPrediction.isActive, true),
        eq(riskPrediction.earlyWarning, true),
      ),
    )
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
});
