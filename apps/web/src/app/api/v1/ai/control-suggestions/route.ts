import { db, risk, riskControl, control, aiPromptLog } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { aiControlSuggestionsSchema } from "@grc/shared";
import { aiComplete } from "@grc/ai";

// Simple in-memory rate limiter: 5 requests per minute per user
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return true;
}

// POST /api/v1/ai/control-suggestions — AI-generated control suggestions for a risk
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  if (!checkRateLimit(ctx.userId)) {
    return Response.json(
      { error: "Rate limit exceeded. Maximum 5 requests per minute." },
      { status: 429 },
    );
  }

  const body = aiControlSuggestionsSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Fetch risk details
  const [riskRow] = await db
    .select({
      id: risk.id,
      title: risk.title,
      description: risk.description,
      riskCategory: risk.riskCategory,
      riskSource: risk.riskSource,
      riskScoreInherent: risk.riskScoreInherent,
    })
    .from(risk)
    .where(
      and(
        eq(risk.id, body.data.riskId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    )
    .limit(1);

  if (!riskRow) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Fetch existing controls for context
  const existingLinks = await db
    .select({
      title: control.title,
      controlType: control.controlType,
      frequency: control.frequency,
    })
    .from(riskControl)
    .innerJoin(control, eq(control.id, riskControl.controlId))
    .where(
      and(
        eq(riskControl.riskId, body.data.riskId),
        eq(riskControl.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );

  const prompt = `You are a GRC expert. Suggest 3-5 internal controls for the following risk. Return JSON array only.

Risk: "${riskRow.title}"
Description: "${riskRow.description ?? "N/A"}"
Category: ${riskRow.riskCategory}
Source: ${riskRow.riskSource}
Inherent Score: ${riskRow.riskScoreInherent ?? "N/A"}

Existing controls: ${existingLinks.length > 0 ? existingLinks.map((c) => `${c.title} (${c.controlType}, ${c.frequency})`).join("; ") : "None"}

Return JSON: [{"title": string, "controlType": "preventive"|"detective"|"corrective", "frequency": "daily"|"weekly"|"monthly"|"quarterly"|"annually"|"event_driven", "frameworkRef": string, "rationale": string}]`;

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
    maxTokens: 2000,
    temperature: 0.3,
  });

  const latencyMs = Date.now() - startMs;

  // Log AI usage
  await db.insert(aiPromptLog).values({
    orgId: ctx.orgId,
    userId: ctx.userId,
    promptTemplate: "control-suggestions",
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

  // Parse AI response
  let suggestions: unknown[];
  try {
    const cleaned = aiResponse.text.replace(/```json\n?|\n?```/g, "").trim();
    suggestions = JSON.parse(cleaned);
  } catch {
    suggestions = [];
  }

  return Response.json({
    data: {
      riskId: body.data.riskId,
      suggestions,
      model: aiResponse.model,
      provider: aiResponse.provider,
    },
  });
}
