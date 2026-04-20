import { db, automationRule, automationRuleExecution } from "@grc/db";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/automation/dashboard — Stats: active rules, executions/24h, errors (admin only)
export async function GET(_req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Active rules count
  const [{ activeRules }] = await db
    .select({ activeRules: sql<number>`count(*)::int` })
    .from(automationRule)
    .where(
      and(
        eq(automationRule.orgId, ctx.orgId),
        eq(automationRule.isActive, true),
      ),
    );

  // Total rules count
  const [{ totalRules }] = await db
    .select({ totalRules: sql<number>`count(*)::int` })
    .from(automationRule)
    .where(eq(automationRule.orgId, ctx.orgId));

  // Executions in last 24h
  const [{ executions24h }] = await db
    .select({ executions24h: sql<number>`count(*)::int` })
    .from(automationRuleExecution)
    .where(
      and(
        eq(automationRuleExecution.orgId, ctx.orgId),
        gte(automationRuleExecution.executedAt, twentyFourHoursAgo),
      ),
    );

  // Success count in last 24h
  const [{ successCount }] = await db
    .select({ successCount: sql<number>`count(*)::int` })
    .from(automationRuleExecution)
    .where(
      and(
        eq(automationRuleExecution.orgId, ctx.orgId),
        gte(automationRuleExecution.executedAt, twentyFourHoursAgo),
        eq(automationRuleExecution.status, "success"),
      ),
    );

  // Error count in last 24h
  const [{ errorCount }] = await db
    .select({ errorCount: sql<number>`count(*)::int` })
    .from(automationRuleExecution)
    .where(
      and(
        eq(automationRuleExecution.orgId, ctx.orgId),
        gte(automationRuleExecution.executedAt, twentyFourHoursAgo),
        sql`${automationRuleExecution.status} IN ('failure', 'partial_failure')`,
      ),
    );

  const successRate24h =
    executions24h > 0 ? Math.round((successCount / executions24h) * 100) : 100;
  const errorRate24h =
    executions24h > 0 ? Math.round((errorCount / executions24h) * 100) : 0;

  // Top 5 rules by execution count in last 24h
  const topRules = await db
    .select({
      ruleId: automationRuleExecution.ruleId,
      ruleName: automationRule.name,
      executionCount: sql<number>`count(*)::int`,
      errorCount: sql<number>`count(*) FILTER (WHERE ${automationRuleExecution.status} IN ('failure', 'partial_failure'))::int`,
    })
    .from(automationRuleExecution)
    .leftJoin(
      automationRule,
      eq(automationRuleExecution.ruleId, automationRule.id),
    )
    .where(
      and(
        eq(automationRuleExecution.orgId, ctx.orgId),
        gte(automationRuleExecution.executedAt, twentyFourHoursAgo),
      ),
    )
    .groupBy(automationRuleExecution.ruleId, automationRule.name)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  return Response.json({
    data: {
      activeRules,
      totalRules,
      executions24h,
      successRate24h,
      errorRate24h,
      topRules,
    },
  });
}
