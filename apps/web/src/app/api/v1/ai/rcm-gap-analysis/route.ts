import { db, risk, riskControl, control, aiPromptLog } from "@grc/db";
import { eq, and, isNull, sql, count } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { aiRcmGapAnalysisSchema } from "@grc/shared";
import { aiComplete } from "@grc/ai";

// POST /api/v1/ai/rcm-gap-analysis — AI-driven RCM gap analysis
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = aiRcmGapAnalysisSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Fetch risks with their linked control counts
  const riskConditions = [eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)];

  if (body.data.scope === "high_risk") {
    riskConditions.push(sql`${risk.riskScoreInherent} >= 15`);
  }

  const risks = await db
    .select({
      id: risk.id,
      title: risk.title,
      riskCategory: risk.riskCategory,
      riskScoreInherent: risk.riskScoreInherent,
      riskScoreResidual: risk.riskScoreResidual,
    })
    .from(risk)
    .where(and(...riskConditions));

  // Fetch control linkage for each risk
  const riskData: Array<{
    id: string;
    title: string;
    category: string;
    inherentScore: number | null;
    controls: Array<{ title: string; type: string; frequency: string }>;
  }> = [];

  for (const r of risks) {
    const links = await db
      .select({
        title: control.title,
        controlType: control.controlType,
        frequency: control.frequency,
      })
      .from(riskControl)
      .innerJoin(control, eq(control.id, riskControl.controlId))
      .where(
        and(
          eq(riskControl.riskId, r.id),
          eq(riskControl.orgId, ctx.orgId),
          isNull(control.deletedAt),
        ),
      );

    if (body.data.scope === "unlinked" && links.length > 0) continue;

    riskData.push({
      id: r.id,
      title: r.title,
      category: r.riskCategory,
      inherentScore: r.riskScoreInherent,
      controls: links.map((l) => ({
        title: l.title,
        type: l.controlType,
        frequency: l.frequency,
      })),
    });
  }

  const prompt = `You are a GRC expert performing a Risk-Control Matrix (RCM) gap analysis.

Analyze the following risks and their linked controls. Identify gaps:
1. Risks with NO controls (unmitigated)
2. Risks with only one control type (e.g. only detective, missing preventive)
3. Controls that appear orphaned (linked but risk is low-priority)
4. High-risk items with insufficient control frequency

Risk-Control data:
${JSON.stringify(riskData.slice(0, 50), null, 2)}

Return JSON: {"gaps": [{"riskId": string, "riskTitle": string, "gapType": "unmitigated"|"type_gap"|"frequency_gap"|"orphaned", "severity": "high"|"medium"|"low", "recommendation": string}]}`;

  const startMs = Date.now();

  const aiResponse = await aiComplete({
    messages: [
      {
        role: "system",
        content:
          "You are a GRC and internal controls expert. Respond with valid JSON only, no markdown.",
      },
      { role: "user", content: prompt },
    ],
    maxTokens: 4000,
    temperature: 0.2,
  });

  const latencyMs = Date.now() - startMs;

  await db.insert(aiPromptLog).values({
    orgId: ctx.orgId,
    userId: ctx.userId,
    promptTemplate: "rcm-gap-analysis",
    inputTokens: aiResponse.usage?.inputTokens ?? 0,
    outputTokens: aiResponse.usage?.outputTokens ?? 0,
    model: aiResponse.model,
    latencyMs,
    costUsd: String(
      (aiResponse.usage?.inputTokens ?? 0) * 0.000003 +
        (aiResponse.usage?.outputTokens ?? 0) * 0.000015,
    ),
    cachedResult: false,
  });

  let result: unknown;
  try {
    const cleaned = aiResponse.text.replace(/```json\n?|\n?```/g, "").trim();
    result = JSON.parse(cleaned);
  } catch {
    result = { gaps: [] };
  }

  return Response.json({
    data: {
      scope: body.data.scope,
      risksAnalyzed: riskData.length,
      ...(result as object),
      model: aiResponse.model,
      provider: aiResponse.provider,
    },
  });
}
