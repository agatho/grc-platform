import { db, grcRoiCalculation } from "@grc/db";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { withAuth, paginate } from "@/lib/api";
import { sql, count } from "drizzle-orm";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/roi/overview — Top ROI investments
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const conditions = and(
    eq(grcRoiCalculation.orgId, ctx.orgId),
    isNotNull(grcRoiCalculation.roiPercent),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: grcRoiCalculation.id,
        entityType: grcRoiCalculation.entityType,
        entityId: grcRoiCalculation.entityId,
        investmentCost: grcRoiCalculation.investmentCost,
        riskReductionValue: grcRoiCalculation.riskReductionValue,
        roiPercent: grcRoiCalculation.roiPercent,
        calculationMethod: grcRoiCalculation.calculationMethod,
        computedAt: grcRoiCalculation.computedAt,
      })
      .from(grcRoiCalculation)
      .where(conditions)
      .orderBy(desc(grcRoiCalculation.roiPercent))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(grcRoiCalculation).where(conditions),
  ]);

  // Aggregate totals
  const [totals] = await db
    .select({
      totalInvestment: sql<string>`COALESCE(SUM(${grcRoiCalculation.investmentCost}), 0)`,
      totalReduction: sql<string>`COALESCE(SUM(${grcRoiCalculation.riskReductionValue}), 0)`,
      avgRoi: sql<string>`COALESCE(AVG(${grcRoiCalculation.roiPercent}), 0)`,
    })
    .from(grcRoiCalculation)
    .where(conditions);

  return Response.json({
    data: items,
    summary: {
      totalInvestment: Number(totals.totalInvestment),
      totalRiskReduction: Number(totals.totalReduction),
      averageRoiPercent: Math.round(Number(totals.avgRoi) * 100) / 100,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
