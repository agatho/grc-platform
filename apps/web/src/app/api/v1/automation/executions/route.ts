import { db, automationRuleExecution, automationRule } from "@grc/db";
import { automationExecutionQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/automation/executions — Execution log (admin only, paginated)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const query = automationExecutionQuerySchema.safeParse({
    ruleId: searchParams.get("ruleId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    entityType: searchParams.get("entityType") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    page,
    limit,
  });

  // Build where conditions
  const conditions: ReturnType<typeof eq>[] = [
    eq(automationRuleExecution.orgId, ctx.orgId),
  ];

  if (query.success) {
    if (query.data.ruleId) {
      conditions.push(eq(automationRuleExecution.ruleId, query.data.ruleId));
    }
    if (query.data.status) {
      conditions.push(eq(automationRuleExecution.status, query.data.status));
    }
    if (query.data.entityType) {
      conditions.push(
        eq(automationRuleExecution.entityType, query.data.entityType),
      );
    }
    if (query.data.from) {
      conditions.push(
        gte(automationRuleExecution.executedAt, new Date(query.data.from)),
      );
    }
    if (query.data.to) {
      conditions.push(
        lte(automationRuleExecution.executedAt, new Date(query.data.to)),
      );
    }
  }

  const rows = await db
    .select({
      id: automationRuleExecution.id,
      ruleId: automationRuleExecution.ruleId,
      ruleName: automationRule.name,
      orgId: automationRuleExecution.orgId,
      triggeredByEventId: automationRuleExecution.triggeredByEventId,
      entityType: automationRuleExecution.entityType,
      entityId: automationRuleExecution.entityId,
      conditionsMatched: automationRuleExecution.conditionsMatched,
      actionsExecuted: automationRuleExecution.actionsExecuted,
      status: automationRuleExecution.status,
      durationMs: automationRuleExecution.durationMs,
      errorMessage: automationRuleExecution.errorMessage,
      executedAt: automationRuleExecution.executedAt,
    })
    .from(automationRuleExecution)
    .leftJoin(automationRule, eq(automationRuleExecution.ruleId, automationRule.id))
    .where(and(...conditions))
    .orderBy(desc(automationRuleExecution.executedAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(automationRuleExecution)
    .where(and(...conditions));

  return paginatedResponse(rows, total, page, limit);
}
