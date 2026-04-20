import { db, riskPrediction } from "@grc/db";
import { predictionQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/predictive-risk/predictions — List predictions
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = predictionQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const {
    page,
    limit,
    entityType,
    entityId,
    riskLevel,
    earlyWarning,
    modelId,
    predictionType,
  } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(riskPrediction.orgId, ctx.orgId),
    eq(riskPrediction.isActive, true),
  ];
  if (entityType) conditions.push(eq(riskPrediction.entityType, entityType));
  if (entityId) conditions.push(eq(riskPrediction.entityId, entityId));
  if (riskLevel) conditions.push(eq(riskPrediction.riskLevel, riskLevel));
  if (earlyWarning !== undefined)
    conditions.push(eq(riskPrediction.earlyWarning, earlyWarning));
  if (modelId) conditions.push(eq(riskPrediction.modelId, modelId));
  if (predictionType)
    conditions.push(eq(riskPrediction.predictionType, predictionType));

  const [predictions, countResult] = await Promise.all([
    db
      .select()
      .from(riskPrediction)
      .where(and(...conditions))
      .orderBy(desc(riskPrediction.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(riskPrediction)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: predictions,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
