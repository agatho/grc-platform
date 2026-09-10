import { db, riskPrediction } from "@grc/db";
import { radarQuerySchema } from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/predictive-risk/radar — Predictive Risk Radar data
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("erm", ctx.orgId, req.method);
  if (m) return m;

  const url = new URL(req.url);
  const query = radarQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { horizonDays } = query.data;

  const radarData = await db
    .select({
      entityType: riskPrediction.entityType,
      entityId: riskPrediction.entityId,
      currentValue: riskPrediction.currentValue,
      predictedValue: riskPrediction.predictedValue,
      riskLevel: riskPrediction.riskLevel,
      trendDirection: riskPrediction.trendDirection,
      confidence: riskPrediction.confidence,
      earlyWarning: riskPrediction.earlyWarning,
    })
    .from(riskPrediction)
    .where(
      and(
        eq(riskPrediction.orgId, ctx.orgId),
        eq(riskPrediction.isActive, true),
        sql`${riskPrediction.predictionHorizonDays} <= ${horizonDays}`,
      ),
    )
    .orderBy(sql`${riskPrediction.riskLevel} desc`)
    .limit(100);

  return Response.json({ data: radarData });
});
