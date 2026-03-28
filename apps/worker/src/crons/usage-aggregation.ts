// Sprint 61: Worker — Aggregate usage records and check plan limits
import { db, usageRecord, usageMeter, orgSubscription, subscriptionPlan } from "@grc/db";
import { eq, and, sql, gte } from "drizzle-orm";

export async function aggregateUsage(): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get all active subscriptions
  const subscriptions = await db
    .select({
      orgId: orgSubscription.orgId,
      planKey: subscriptionPlan.key,
      maxApiCalls: subscriptionPlan.maxApiCallsPerMonth,
      maxUsers: subscriptionPlan.maxUsers,
      maxStorageGb: subscriptionPlan.maxStorageGb,
    })
    .from(orgSubscription)
    .innerJoin(subscriptionPlan, eq(orgSubscription.planId, subscriptionPlan.id))
    .where(eq(orgSubscription.status, "active"));

  for (const sub of subscriptions) {
    // Check API call limits
    if (sub.maxApiCalls && sub.maxApiCalls > 0) {
      const [apiUsage] = await db
        .select({
          total: sql<number>`COALESCE(sum(${usageRecord.quantity}::numeric), 0)`,
        })
        .from(usageRecord)
        .innerJoin(usageMeter, eq(usageRecord.meterId, usageMeter.id))
        .where(and(
          eq(usageRecord.orgId, sub.orgId),
          eq(usageMeter.key, "api_calls"),
          gte(usageRecord.periodStart, periodStart),
        ));

      if (Number(apiUsage.total) > sub.maxApiCalls) {
        console.log(
          `[usage-aggregation] Org ${sub.orgId} exceeded API call limit: ` +
          `${apiUsage.total}/${sub.maxApiCalls}`,
        );
      }
    }
  }

  console.log(`[usage-aggregation] Checked ${subscriptions.length} subscriptions`);
}
