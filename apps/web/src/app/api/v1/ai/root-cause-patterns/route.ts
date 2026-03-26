import { db, finding, aiPromptLog } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { aiRootCausePatternsSchema } from "@grc/shared";
import { aiComplete } from "@grc/ai";

// POST /api/v1/ai/root-cause-patterns — AI pattern detection across findings
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = aiRootCausePatternsSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Determine date range
  const months = body.data.period === "3m" ? 3 : body.data.period === "6m" ? 6 : 12;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const findings = await db
    .select({
      id: finding.id,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      source: finding.source,
      status: finding.status,
      createdAt: finding.createdAt,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`${finding.createdAt} >= ${since.toISOString()}`,
      ),
    )
    .limit(200);

  if (findings.length < 3) {
    return Response.json({
      data: {
        patterns: [],
        message: "Not enough findings for pattern analysis (minimum 3 required)",
        findingsAnalyzed: findings.length,
      },
    });
  }

  const prompt = `You are a GRC expert. Analyze these findings and identify root-cause patterns.

Findings (${findings.length} total, last ${months} months):
${JSON.stringify(
  findings.map((f) => ({
    title: f.title,
    description: f.description?.substring(0, 200),
    severity: f.severity,
    source: f.source,
  })),
  null,
  2,
)}

Identify top 5 patterns. Return JSON:
{"patterns": [{"pattern": string, "frequency": number, "affectedFindingCount": number, "severity": "high"|"medium"|"low", "systemicRecommendation": string}]}`;

  const startMs = Date.now();

  const aiResponse = await aiComplete({
    messages: [
      { role: "system", content: "You are a GRC expert specializing in root cause analysis. Respond with valid JSON only, no markdown." },
      { role: "user", content: prompt },
    ],
    maxTokens: 3000,
    temperature: 0.2,
  });

  const latencyMs = Date.now() - startMs;

  await db.insert(aiPromptLog).values({
    orgId: ctx.orgId,
    userId: ctx.userId,
    promptTemplate: "root-cause-patterns",
    inputTokens: aiResponse.usage?.inputTokens ?? 0,
    outputTokens: aiResponse.usage?.outputTokens ?? 0,
    model: aiResponse.model,
    latencyMs,
    costUsd: String(
      ((aiResponse.usage?.inputTokens ?? 0) * 0.000003 +
        (aiResponse.usage?.outputTokens ?? 0) * 0.000015),
    ),
    cachedResult: false,
  });

  let result: unknown;
  try {
    const cleaned = aiResponse.text.replace(/```json\n?|\n?```/g, "").trim();
    result = JSON.parse(cleaned);
  } catch {
    result = { patterns: [] };
  }

  return Response.json({
    data: {
      period: body.data.period,
      findingsAnalyzed: findings.length,
      ...result as object,
      model: aiResponse.model,
      provider: aiResponse.provider,
    },
  });
}
