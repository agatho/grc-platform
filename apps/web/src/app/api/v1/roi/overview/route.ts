import { db, grcRoiCalculation } from "@grc/db";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { sql, count } from "drizzle-orm";

// GET /api/v1/roi/overview — Top ROI investments
export async function GET(req: Request) {
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
}
