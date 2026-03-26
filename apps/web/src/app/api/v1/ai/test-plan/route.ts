import { db, control, finding, controlTest, aiPromptLog } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { aiTestPlanSchema } from "@grc/shared";
import { aiComplete } from "@grc/ai";

// POST /api/v1/ai/test-plan — AI-generated test plan for a control
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "control_owner");
  if (ctx instanceof Response) return ctx;

  const body = aiTestPlanSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Fetch control details
  const [ctrl] = await db
    .select({
      id: control.id,
      title: control.title,
      description: control.description,
      controlType: control.controlType,
      frequency: control.frequency,
      automationLevel: control.automationLevel,
      objective: control.objective,
      testInstructions: control.testInstructions,
      assertions: control.assertions,
    })
    .from(control)
    .where(
      and(
        eq(control.id, body.data.controlId),
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    )
    .limit(1);

  if (!ctrl) {
    return Response.json({ error: "Control not found" }, { status: 404 });
  }

  // Fetch recent test history
  const recentTests = await db
    .select({
      testDate: controlTest.testDate,
      todResult: controlTest.todResult,
      toeResult: controlTest.toeResult,
      conclusion: controlTest.conclusion,
    })
    .from(controlTest)
    .where(
      and(
        eq(controlTest.controlId, ctrl.id),
        eq(controlTest.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(controlTest.testDate))
    .limit(5);

  // Fetch recent findings
  const recentFindings = await db
    .select({
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
    })
    .from(finding)
    .where(
      and(
        eq(finding.controlId, ctrl.id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    )
    .orderBy(desc(finding.createdAt))
    .limit(5);

  const prompt = `You are a GRC auditor. Generate a structured test plan for this internal control.

Control: "${ctrl.title}"
Description: "${ctrl.description ?? "N/A"}"
Type: ${ctrl.controlType}
Frequency: ${ctrl.frequency}
Automation: ${ctrl.automationLevel}
Objective: "${ctrl.objective ?? "N/A"}"
Assertions: ${ctrl.assertions?.join(", ") ?? "N/A"}
Existing test instructions: "${ctrl.testInstructions ?? "None"}"

Recent test results: ${recentTests.length > 0 ? JSON.stringify(recentTests) : "None"}
Recent findings: ${recentFindings.length > 0 ? JSON.stringify(recentFindings) : "None"}

Return JSON:
{
  "objective": string,
  "scope": string,
  "approach": string,
  "sampleSize": string,
  "steps": [{"step": number, "action": string, "expectedEvidence": string}],
  "focusAreas": [string],
  "riskBasedConsiderations": string,
  "estimatedDuration": string
}`;

  const startMs = Date.now();

  const aiResponse = await aiComplete({
    messages: [
      { role: "system", content: "You are a GRC audit expert. Respond with valid JSON only, no markdown." },
      { role: "user", content: prompt },
    ],
    maxTokens: 3000,
    temperature: 0.3,
  });

  const latencyMs = Date.now() - startMs;

  await db.insert(aiPromptLog).values({
    orgId: ctx.orgId,
    userId: ctx.userId,
    promptTemplate: "test-plan",
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

  let testPlan: unknown;
  try {
    const cleaned = aiResponse.text.replace(/```json\n?|\n?```/g, "").trim();
    testPlan = JSON.parse(cleaned);
  } catch {
    testPlan = { error: "Failed to parse AI response" };
  }

  return Response.json({
    data: {
      controlId: body.data.controlId,
      controlTitle: ctrl.title,
      testPlan,
      model: aiResponse.model,
      provider: aiResponse.provider,
    },
  });
}
