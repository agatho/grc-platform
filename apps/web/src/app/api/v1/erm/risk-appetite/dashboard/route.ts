import { db, riskAppetiteThreshold, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { RiskAppetiteDashboardItem, RiskCategory } from "@grc/shared";

// GET /api/v1/erm/risk-appetite/dashboard — Appetite vs Residual per category
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Get active thresholds
  const thresholds = await db
    .select()
    .from(riskAppetiteThreshold)
    .where(
      and(
        eq(riskAppetiteThreshold.orgId, ctx.orgId),
        eq(riskAppetiteThreshold.isActive, true),
        isNull(riskAppetiteThreshold.deletedAt),
      ),
    );

  // Get aggregated risk scores per category
  const riskStats = await db
    .select({
      category: risk.riskCategory,
      avgResidual: sql<number>`COALESCE(AVG(${risk.riskScoreResidual}), 0)::integer`,
      maxResidual: sql<number>`COALESCE(MAX(${risk.riskScoreResidual}), 0)::integer`,
      riskCount: sql<number>`COUNT(*)::integer`,
    })
    .from(risk)
    .where(
      and(
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
        isNotNull(risk.riskScoreResidual),
      ),
    )
    .groupBy(risk.riskCategory);

  const statsMap = new Map<string, (typeof riskStats)[number]>(
    riskStats.map((s) => [s.category, s]),
  );

  const dashboard: RiskAppetiteDashboardItem[] = thresholds.map((t) => {
    const stats = statsMap.get(t.riskCategory);
    const avgResidual = stats?.avgResidual ?? 0;
    const maxResidual = stats?.maxResidual ?? 0;
    const riskCount = stats?.riskCount ?? 0;

    return {
      category: t.riskCategory,
      avgResidual,
      maxResidual,
      appetiteThreshold: t.maxResidualScore,
      riskCount,
      breachCount: 0, // will compute below
      isBreached: maxResidual > t.maxResidualScore,
    };
  });

  // Compute breach counts
  for (const item of dashboard) {
    const threshold = thresholds.find((t) => t.riskCategory === item.category);
    if (!threshold) continue;

    const [result] = await db
      .select({
        count: sql<number>`COUNT(*)::integer`,
      })
      .from(risk)
      .where(
        and(
          eq(risk.orgId, ctx.orgId),
          eq(risk.riskCategory, item.category as RiskCategory),
          isNull(risk.deletedAt),
          isNotNull(risk.riskScoreResidual),
          sql`${risk.riskScoreResidual} > ${threshold.maxResidualScore}`,
        ),
      );

    item.breachCount = result?.count ?? 0;
  }

  const totalWithin = dashboard.filter((d) => !d.isBreached).length;
  const totalCategories = dashboard.length;

  return Response.json({
    data: dashboard,
    summary: {
      categoriesWithinAppetite: totalWithin,
      totalCategories,
    },
  });
}
