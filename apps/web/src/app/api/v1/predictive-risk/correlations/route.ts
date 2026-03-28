import { db, riskPrediction } from "@grc/db";
import { correlationQuerySchema } from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/predictive-risk/correlations — Correlation analysis
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = correlationQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });
  }

  const { entityType, entityId, minCorrelation } = query.data;

  // Get predictions with correlations for the specified entity
  const predictions = await db
    .select({
      id: riskPrediction.id,
      entityType: riskPrediction.entityType,
      entityId: riskPrediction.entityId,
      correlatedEntities: riskPrediction.correlatedEntities,
      confidence: riskPrediction.confidence,
    })
    .from(riskPrediction)
    .where(and(
      eq(riskPrediction.orgId, ctx.orgId),
      eq(riskPrediction.entityType, entityType),
      eq(riskPrediction.entityId, entityId),
      eq(riskPrediction.isActive, true),
    ))
    .limit(50);

  return Response.json({ data: predictions });
}
