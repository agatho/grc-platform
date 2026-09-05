import { db, grcRoiCalculation } from "@grc/db";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/roni/overview — Aggregated RONI across all entities
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const conditions = and(
    eq(grcRoiCalculation.orgId, ctx.orgId),
    isNotNull(grcRoiCalculation.roniCfo),
  );

  // Per-entity RONI details
  const items = await db
    .select({
      entityType: grcRoiCalculation.entityType,
      entityId: grcRoiCalculation.entityId,
      roniCfo: grcRoiCalculation.roniCfo,
      roniCiso: grcRoiCalculation.roniCiso,
      inherentAle: grcRoiCalculation.inherentAle,
      residualAle: grcRoiCalculation.residualAle,
      calculationMethod: grcRoiCalculation.calculationMethod,
      computedAt: grcRoiCalculation.computedAt,
    })
    .from(grcRoiCalculation)
    .where(conditions)
    .orderBy(sql`${grcRoiCalculation.roniCfo} ASC`);

  // Aggregated totals
  const [totals] = await db
    .select({
      totalRoniCfo: sql<string>`COALESCE(SUM(${grcRoiCalculation.roniCfo}), 0)`,
      totalRoniCiso: sql<string>`COALESCE(SUM(${grcRoiCalculation.roniCiso}), 0)`,
      totalInherentAle: sql<string>`COALESCE(SUM(${grcRoiCalculation.inherentAle}), 0)`,
      totalResidualAle: sql<string>`COALESCE(SUM(${grcRoiCalculation.residualAle}), 0)`,
      entityCount: sql<number>`COUNT(*)`,
    })
    .from(grcRoiCalculation)
    .where(conditions);

  return Response.json({
    data: items,
    summary: {
      totalRoniCfo: Number(totals.totalRoniCfo),
      totalRoniCiso: Number(totals.totalRoniCiso),
      totalInherentAle: Number(totals.totalInherentAle),
      totalResidualAle: Number(totals.totalResidualAle),
      aleReduction:
        Number(totals.totalInherentAle) - Number(totals.totalResidualAle),
      entityCount: Number(totals.entityCount),
    },
  });
});
