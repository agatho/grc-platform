import { db, riskPrediction } from "@grc/db";
import { radarQuerySchema } from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/predictive-risk/radar — Predictive Risk Radar data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = radarQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });
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
    .where(and(
      eq(riskPrediction.orgId, ctx.orgId),
      eq(riskPrediction.isActive, true),
      sql`${riskPrediction.predictionHorizonDays} <= ${horizonDays}`,
    ))
    .orderBy(sql`${riskPrediction.riskLevel} desc`)
    .limit(100);

  return Response.json({ data: radarData });
}
