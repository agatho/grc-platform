import { db, aiPromptLog } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { aiUsageQuerySchema } from "@grc/shared";

// GET /api/v1/ai/usage — AI usage summary for admin
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-10, S05-11]
// Zwei Ergänzungen:
//   * `byProvider`/`byJurisdiction` aus `ai_egress_log` — die Frage
//     „welche Inhalte gingen in welchem Zeitraum an welchen
//     Drittlandempfänger" (DSGVO Art. 30 Abs. 1 lit. e) war aus
//     `ai_prompt_log` nicht zu beantworten: die Tabelle hatte keine
//     Provider-Spalte.
//   * `costCoverage` — `cost_usd` wurde nur von 4 der 23 Routen gesetzt,
//     das Dashboard summierte deshalb strukturell zu niedrig, ohne das zu
//     sagen. Die Kennzahl weist jetzt aus, für wie viele Aufrufe
//     überhaupt Kosten vorliegen.
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
      totalInputTokens:
        sql<number>`COALESCE(SUM(${aiPromptLog.inputTokens}), 0)`.as(
          "total_input",
        ),
      totalOutputTokens:
        sql<number>`COALESCE(SUM(${aiPromptLog.outputTokens}), 0)`.as(
          "total_output",
        ),
      totalCostUsd:
        sql<number>`COALESCE(SUM(${aiPromptLog.costUsd}::numeric), 0)`.as(
          "total_cost",
        ),
      cachedCount:
        sql<number>`SUM(CASE WHEN ${aiPromptLog.cachedResult} THEN 1 ELSE 0 END)`.as(
          "cached",
        ),
    })
    .from(aiPromptLog)
    .where(where);

  // By model
  const byModelRows = await db
    .select({
      model: aiPromptLog.model,
      prompts: sql<number>`COUNT(*)`.as("prompts"),
      tokens:
        sql<number>`COALESCE(SUM(${aiPromptLog.inputTokens} + ${aiPromptLog.outputTokens}), 0)`.as(
          "tokens",
        ),
      cost: sql<number>`COALESCE(SUM(${aiPromptLog.costUsd}::numeric), 0)`.as(
        "cost",
      ),
    })
    .from(aiPromptLog)
    .where(where)
    .groupBy(aiPromptLog.model);

  // By template
  const byTemplateRows = await db
    .select({
      template: aiPromptLog.promptTemplate,
      prompts: sql<number>`COUNT(*)`.as("prompts"),
      tokens:
        sql<number>`COALESCE(SUM(${aiPromptLog.inputTokens} + ${aiPromptLog.outputTokens}), 0)`.as(
          "tokens",
        ),
      cost: sql<number>`COALESCE(SUM(${aiPromptLog.costUsd}::numeric), 0)`.as(
        "cost",
      ),
      avgLatencyMs: sql<number>`ROUND(AVG(${aiPromptLog.latencyMs}))`.as(
        "avg_latency",
      ),
    })
    .from(aiPromptLog)
    .where(where)
    .groupBy(aiPromptLog.promptTemplate);

  const byModel: Record<
    string,
    { prompts: number; tokens: number; cost: number }
  > = {};
  for (const r of byModelRows) {
    byModel[r.model] = {
      prompts: Number(r.prompts),
      tokens: Number(r.tokens),
      cost: Number(r.cost),
    };
  }

  const byTemplate: Record<
    string,
    { prompts: number; tokens: number; cost: number; avgLatencyMs: number }
  > = {};
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

  const [costRows] = (await db.execute(sql`
    SELECT count(*) FILTER (WHERE cost_usd IS NOT NULL)::int AS with_cost,
           count(*)::int AS total
      FROM ai_prompt_log
     WHERE org_id = ${ctx.orgId}::uuid
  `)) as unknown as Array<{ with_cost: number; total: number }>;

  const egressRows = (await db.execute(sql`
    SELECT provider,
           provider_placement,
           provider_country,
           count(*) FILTER (WHERE outcome = 'completed')::int      AS calls,
           count(*) FILTER (WHERE outcome = 'blocked')::int        AS blocked,
           count(*) FILTER (WHERE outcome = 'invalid_output')::int AS invalid_output,
           count(*) FILTER (WHERE contains_personal_data)::int     AS personal_data_calls,
           COALESCE(SUM(input_tokens), 0)::int                     AS input_tokens,
           COALESCE(SUM(output_tokens), 0)::int                    AS output_tokens,
           max(created_at)::text                                   AS last_used
      FROM ai_egress_log
     WHERE org_id = ${ctx.orgId}::uuid
     GROUP BY provider, provider_placement, provider_country
  `)) as unknown as Array<Record<string, unknown>>;

  const thirdCountryCalls = egressRows
    .filter((r) => r.provider_placement === "third_country")
    .reduce((n, r) => n + Number(r.calls ?? 0), 0);

  return Response.json({
    data: {
      totalPrompts,
      totalInputTokens: Number(totals?.totalInputTokens ?? 0),
      totalOutputTokens: Number(totals?.totalOutputTokens ?? 0),
      totalCostUsd: Number(totals?.totalCostUsd ?? 0),
      cacheHitRate:
        totalPrompts > 0 ? Math.round((cachedCount / totalPrompts) * 100) : 0,
      byModel,
      byTemplate,
      costCoverage: {
        promptsWithCost: Number(costRows?.with_cost ?? 0),
        promptsTotal: Number(costRows?.total ?? 0),
        note: "cost_usd wird nicht von allen Aufrufpfaden gesetzt; totalCostUsd ist eine Untergrenze.",
      },
      egress: {
        thirdCountryCalls,
        byProvider: egressRows,
      },
    },
  });
}
