// Sprint 37: Architecture Health Snapshot Worker
// Runs monthly (1st of month) — computes and stores health score snapshot

import {
  db,
  architectureHealthSnapshot,
  applicationPortfolio,
  technologyEntry,
  architectureRuleViolation,
  dataFlow,
  organization,
} from "@grc/db";
import { eq, and, sql } from "drizzle-orm";

export async function processArchitectureHealthSnapshot(): Promise<{
  orgsProcessed: number;
}> {
  console.log(
    "[arch-health-snapshot] Computing monthly architecture health snapshots",
  );

  const orgs = await db.select({ id: organization.id }).from(organization);

  let orgsProcessed = 0;

  for (const org of orgs) {
    try {
      // Portfolio age score
      const [appStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          healthy: sql<number>`count(*) filter (where lifecycle_status not in ('end_of_life', 'retired'))::int`,
        })
        .from(applicationPortfolio)
        .where(eq(applicationPortfolio.orgId, org.id));

      const portfolioAge = appStats?.total
        ? Math.round((appStats.healthy / appStats.total) * 100)
        : 100;

      // Tech currency
      const [techStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          current: sql<number>`count(*) filter (where ring in ('adopt', 'trial'))::int`,
        })
        .from(technologyEntry)
        .where(eq(technologyEntry.orgId, org.id));

      const techCurrency = techStats?.total
        ? Math.round((techStats.current / techStats.total) * 100)
        : 100;

      // Violations
      const [violStats] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(architectureRuleViolation)
        .where(
          and(
            eq(architectureRuleViolation.orgId, org.id),
            eq(architectureRuleViolation.status, "open"),
          ),
        );

      const ruleViolationCount = violStats?.count ?? 0;
      const ruleCompliance = Math.max(0, 100 - ruleViolationCount * 5);

      // Data flow compliance
      const [flowStats] = await db
        .select({
          personalTotal: sql<number>`count(*) filter (where contains_personal_data = true)::int`,
          compliant: sql<number>`count(*) filter (where contains_personal_data = true and (crosses_eu_border = false or schrems_ii_safeguard != 'none'))::int`,
        })
        .from(dataFlow)
        .where(eq(dataFlow.orgId, org.id));

      const dfCompliance = flowStats?.personalTotal
        ? Math.round((flowStats.compliant / flowStats.personalTotal) * 100)
        : 100;

      const overall = Math.round(
        portfolioAge * 0.2 +
          techCurrency * 0.2 +
          80 * 0.15 +
          80 * 0.15 +
          ruleCompliance * 0.15 +
          dfCompliance * 0.15,
      );

      await db.insert(architectureHealthSnapshot).values({
        orgId: org.id,
        overallScore: overall,
        portfolioAgeScore: portfolioAge,
        technologyCurrencyScore: techCurrency,
        integrationComplexityScore: 80,
        spofCount: 0,
        ruleViolations: ruleViolationCount,
        dataFlowComplianceScore: dfCompliance,
      });

      orgsProcessed++;
    } catch (err) {
      console.error(`[arch-health-snapshot] Failed for org ${org.id}:`, err);
    }
  }

  console.log(`[arch-health-snapshot] Processed ${orgsProcessed} orgs`);
  return { orgsProcessed };
}
