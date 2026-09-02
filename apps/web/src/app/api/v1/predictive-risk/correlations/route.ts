import { db, riskPrediction } from "@grc/db";
import { correlationQuerySchema } from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/predictive-risk/correlations — Correlation analysis
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("erm", ctx.orgId, req.method);
  if (m) return m;

  const url = new URL(req.url);
  const query = correlationQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
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
    .where(
      and(
        eq(riskPrediction.orgId, ctx.orgId),
        eq(riskPrediction.entityType, entityType),
        eq(riskPrediction.entityId, entityId),
        eq(riskPrediction.isActive, true),
      ),
    )
    .limit(50);

  return Response.json({ data: predictions });
});
