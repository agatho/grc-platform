import { db, controlTestScript } from "@grc/db";
import { generateTestScriptSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/control-testing/scripts/generate — AI-generate test script
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = generateTestScriptSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // AI generation placeholder - integrates with Sprint 51 LLM infrastructure
  const generatedScript = {
    controlId: body.data.controlId,
    name: `AI-Generated Test Script for Control`,
    description:
      "Automatically generated test script based on control requirements.",
    testType: body.data.testType,
    scriptContent: `# AI-Generated Test Script\n# Control: ${body.data.controlId}\n# Type: ${body.data.testType}\n\n# Step 1: Verify control configuration\nassert control.isActive == true\n\n# Step 2: Check evidence freshness\nassert evidence.lastUpdated > now() - 90.days\n\n# Step 3: Validate control effectiveness\nassert control.effectivenessScore >= 70`,
    steps: [
      {
        order: 1,
        instruction: "Verify control is active and configured",
        expectedResult: "Control is enabled",
        isAutomated: true,
      },
      {
        order: 2,
        instruction: "Check evidence is current (< 90 days)",
        expectedResult: "Evidence is fresh",
        isAutomated: true,
      },
      {
        order: 3,
        instruction: "Validate control effectiveness score",
        expectedResult: "Score >= 70%",
        isAutomated: false,
      },
    ],
  };

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(controlTestScript)
      .values({
        ...generatedScript,
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        aiGenerated: true,
        aiModel: "default",
        aiConfidence: "85.00",
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
