import { db, aiPromptLog } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { aiUsageQuerySchema } from "@grc/shared";

// GET /api/v1/ai/usage — AI usage summary for admin
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = aiUsageQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const conditions = [eq(aiPromptLog.orgId, ctx.orgId)];

  if (parsed.success && parsed.data.from) {
    conditions.push(sql`${aiPromptLog.createdAt} >= ${parsed.data.from}`);
  }
  if (parsed.success && parsed.data.to) {
    conditions.push(sql`${aiPromptLog.createdAt} <= ${parsed.data.to}`);
  }

  const where = and(...conditions);

  // Totals
  const [totals] = await db
    .select({
      totalPrompts: sql<number>`COUNT(*)`.as("total_prompts"),
      totalInputTokens: sql<number>`COALESCE(SUM(${aiPromptLog.inputTokens}), 0)`.as("total_input"),
      totalOutputTokens: sql<number>`COALESCE(SUM(${aiPromptLog.outputTokens}), 0)`.as("total_output"),
      totalCostUsd: sql<number>`COALESCE(SUM(${aiPromptLog.costUsd}::numeric), 0)`.as("total_cost"),
      cachedCount: sql<number>`SUM(CASE WHEN ${aiPromptLog.cachedResult} THEN 1 ELSE 0 END)`.as("cached"),
    })
    .from(aiPromptLog)
    .where(where);

  // By model
  const byModelRows = await db
    .select({
      model: aiPromptLog.model,
      prompts: sql<number>`COUNT(*)`.as("prompts"),
      tokens: sql<number>`COALESCE(SUM(${aiPromptLog.inputTokens} + ${aiPromptLog.outputTokens}), 0)`.as("tokens"),
      cost: sql<number>`COALESCE(SUM(${aiPromptLog.costUsd}::numeric), 0)`.as("cost"),
    })
    .from(aiPromptLog)
    .where(where)
    .groupBy(aiPromptLog.model);

  // By template
  const byTemplateRows = await db
    .select({
      template: aiPromptLog.promptTemplate,
      prompts: sql<number>`COUNT(*)`.as("prompts"),
      tokens: sql<number>`COALESCE(SUM(${aiPromptLog.inputTokens} + ${aiPromptLog.outputTokens}), 0)`.as("tokens"),
      cost: sql<number>`COALESCE(SUM(${aiPromptLog.costUsd}::numeric), 0)`.as("cost"),
      avgLatencyMs: sql<number>`ROUND(AVG(${aiPromptLog.latencyMs}))`.as("avg_latency"),
    })
    .from(aiPromptLog)
    .where(where)
    .groupBy(aiPromptLog.promptTemplate);

  const byModel: Record<string, { prompts: number; tokens: number; cost: number }> = {};
  for (const r of byModelRows) {
    byModel[r.model] = {
      prompts: Number(r.prompts),
      tokens: Number(r.tokens),
      cost: Number(r.cost),
    };
  }

  const byTemplate: Record<string, { prompts: number; tokens: number; cost: number; avgLatencyMs: number }> = {};
  for (const r of byTemplateRows) {
    byTemplate[r.template] = {
      prompts: Number(r.prompts),
      tokens: Number(r.tokens),
      cost: Number(r.cost),
      avgLatencyMs: Number(r.avgLatencyMs),
    };
  }

  const totalPrompts = Number(totals?.totalPrompts ?? 0);
  const cachedCount = Number(totals?.cachedCount ?? 0);

  return Response.json({
    data: {
      totalPrompts,
      totalInputTokens: Number(totals?.totalInputTokens ?? 0),
      totalOutputTokens: Number(totals?.totalOutputTokens ?? 0),
      totalCostUsd: Number(totals?.totalCostUsd ?? 0),
      cacheHitRate: totalPrompts > 0 ? Math.round((cachedCount / totalPrompts) * 100) : 0,
      byModel,
      byTemplate,
    },
  });
}
