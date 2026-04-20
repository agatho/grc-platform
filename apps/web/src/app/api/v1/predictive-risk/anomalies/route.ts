import { db, riskAnomalyDetection } from "@grc/db";
import { anomalyQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/predictive-risk/anomalies — List anomalies
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = anomalyQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, entityType, entityId, severity, status, anomalyType } =
    query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(riskAnomalyDetection.orgId, ctx.orgId)];
  if (entityType)
    conditions.push(eq(riskAnomalyDetection.entityType, entityType));
  if (entityId) conditions.push(eq(riskAnomalyDetection.entityId, entityId));
  if (severity) conditions.push(eq(riskAnomalyDetection.severity, severity));
  if (status) conditions.push(eq(riskAnomalyDetection.status, status));
  if (anomalyType)
    conditions.push(eq(riskAnomalyDetection.anomalyType, anomalyType));

  const [anomalies, countResult] = await Promise.all([
    db
      .select()
      .from(riskAnomalyDetection)
      .where(and(...conditions))
      .orderBy(desc(riskAnomalyDetection.detectedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(riskAnomalyDetection)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: anomalies,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
