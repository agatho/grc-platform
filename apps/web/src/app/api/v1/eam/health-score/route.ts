import { db, architectureElement, applicationPortfolio, technologyEntry, architectureRuleViolation, dataFlow, applicationInterface, architectureHealthSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/health-score — Architecture health score (current)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Portfolio age: % of apps NOT in end_of_life or retired
  const [appStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      healthy: sql<number>`count(*) filter (where lifecycle_status not in ('end_of_life', 'retired'))::int`,
    })
    .from(applicationPortfolio)
    .where(eq(applicationPortfolio.orgId, ctx.orgId));

  const portfolioAge = appStats?.total ? Math.round((appStats.healthy / appStats.total) * 100) : 100;

  // Tech currency: % in adopt or trial
  const [techStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      current: sql<number>`count(*) filter (where ring in ('adopt', 'trial'))::int`,
    })
    .from(technologyEntry)
    .where(eq(technologyEntry.orgId, ctx.orgId));

  const techCurrency = techStats?.total ? Math.round((techStats.current / techStats.total) * 100) : 100;

  // Rule violations
  const [violStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(architectureRuleViolation)
    .where(and(eq(architectureRuleViolation.orgId, ctx.orgId), eq(architectureRuleViolation.status, "open")));

  const ruleCompliance = Math.max(0, 100 - (violStats?.count ?? 0) * 5);

  // Personal data flow compliance
  const [flowStats] = await db
    .select({
      personalTotal: sql<number>`count(*) filter (where contains_personal_data = true)::int`,
      compliant: sql<number>`count(*) filter (where contains_personal_data = true and (crosses_eu_border = false or schrems_ii_safeguard != 'none'))::int`,
    })
    .from(dataFlow)
    .where(eq(dataFlow.orgId, ctx.orgId));

  const dataFlowCompliance = flowStats?.personalTotal
    ? Math.round((flowStats.compliant / flowStats.personalTotal) * 100)
    : 100;

  // Compute overall
  const weights = { portfolioAge: 0.20, techCurrency: 0.20, integrationComplexity: 0.15, spof: 0.15, ruleCompliance: 0.15, dataFlowCompliance: 0.15 };
  const integrationComplexity = 80; // placeholder
  const spofScore = 80; // placeholder

  const overall = Math.round(
    portfolioAge * weights.portfolioAge +
    techCurrency * weights.techCurrency +
    integrationComplexity * weights.integrationComplexity +
    spofScore * weights.spof +
    ruleCompliance * weights.ruleCompliance +
    dataFlowCompliance * weights.dataFlowCompliance
  );

  return Response.json({
    data: {
      overall,
      portfolioAge,
      techCurrency,
      integrationComplexity,
      spofScore,
      ruleCompliance,
      dataFlowCompliance,
    },
  });
}
