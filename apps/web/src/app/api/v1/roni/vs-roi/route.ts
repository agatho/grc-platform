import { db, grcRoiCalculation } from "@grc/db";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { count } from "drizzle-orm";

// GET /api/v1/roni/vs-roi — Side-by-side: investment cost vs. RONI per entity
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const conditions = and(
    eq(grcRoiCalculation.orgId, ctx.orgId),
    isNotNull(grcRoiCalculation.investmentCost),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        entityType: grcRoiCalculation.entityType,
        entityId: grcRoiCalculation.entityId,
        investmentCost: grcRoiCalculation.investmentCost,
        roiPercent: grcRoiCalculation.roiPercent,
        roniCfo: grcRoiCalculation.roniCfo,
        roniCiso: grcRoiCalculation.roniCiso,
        inherentAle: grcRoiCalculation.inherentAle,
        residualAle: grcRoiCalculation.residualAle,
        riskReductionValue: grcRoiCalculation.riskReductionValue,
        calculationMethod: grcRoiCalculation.calculationMethod,
        computedAt: grcRoiCalculation.computedAt,
      })
      .from(grcRoiCalculation)
      .where(conditions)
      .orderBy(sql`${grcRoiCalculation.roiPercent} DESC NULLS LAST`)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(grcRoiCalculation).where(conditions),
  ]);

  // Summary aggregates
  const [summary] = await db
    .select({
      totalInvestment: sql<string>`COALESCE(SUM(${grcRoiCalculation.investmentCost}), 0)`,
      totalRoniCfo: sql<string>`COALESCE(SUM(${grcRoiCalculation.roniCfo}), 0)`,
      totalRoniCiso: sql<string>`COALESCE(SUM(${grcRoiCalculation.roniCiso}), 0)`,
      avgRoi: sql<string>`COALESCE(AVG(${grcRoiCalculation.roiPercent}), 0)`,
    })
    .from(grcRoiCalculation)
    .where(conditions);

  return Response.json({
    data: items.map((item) => ({
      entityType: item.entityType,
      entityId: item.entityId,
      investmentCost: Number(item.investmentCost),
      roiPercent: item.roiPercent ? Number(item.roiPercent) : null,
      roniCfo: item.roniCfo ? Number(item.roniCfo) : null,
      roniCiso: item.roniCiso ? Number(item.roniCiso) : null,
      inherentAle: item.inherentAle ? Number(item.inherentAle) : null,
      residualAle: item.residualAle ? Number(item.residualAle) : null,
      riskReductionValue: item.riskReductionValue ? Number(item.riskReductionValue) : null,
      calculationMethod: item.calculationMethod,
      computedAt: item.computedAt,
    })),
    summary: {
      totalInvestment: Number(summary.totalInvestment),
      totalRoniCfo: Number(summary.totalRoniCfo),
      totalRoniCiso: Number(summary.totalRoniCiso),
      averageRoiPercent: Math.round(Number(summary.avgRoi) * 100) / 100,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
