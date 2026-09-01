// POST /api/v1/ai/test-plan — AI-generated test plan for a control
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]
// Vorher: Inline-Prompt mit Kontroll-, Test- und Feststellungstexten im
// Fliesstext, kein Rate-Limit, `testPlan = { error: "Failed to parse AI
// response" }` als Ergebnisobjekt im Erfolgspfad.

import { db, control, finding, controlTest } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { requireModule } from "@grc/auth";
import { aiTestPlanSchema } from "@grc/shared";
import {
  aiCompleteGoverned,
  buildTestPlanPrompt,
  testPlanSchema,
  safeJsonParse,
} from "@grc/ai";
import { aiRateLimit, aiErrorResponse, aiJson } from "../_shared/ai-route";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const body = aiTestPlanSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

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

  const recentTests = await db
    .select({
      testDate: controlTest.testDate,
      todResult: controlTest.todResult,
      toeResult: controlTest.toeResult,
      conclusion: controlTest.conclusion,
    })
    .from(controlTest)
    .where(
      and(eq(controlTest.controlId, ctrl.id), eq(controlTest.orgId, ctx.orgId)),
    )
    .orderBy(desc(controlTest.testDate))
    .limit(5);

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

  try {
    const result = await aiCompleteGoverned({
      feature: "ai.test_plan",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "control",
      entityId: ctrl.id,
      messages: buildTestPlanPrompt({
        control: {
          title: ctrl.title,
          description: ctrl.description,
          controlType: ctrl.controlType,
          frequency: ctrl.frequency,
          automationLevel: ctrl.automationLevel,
          objective: ctrl.objective,
          testInstructions: ctrl.testInstructions,
          assertions: ctrl.assertions ?? null,
        },
        recentTests,
        recentFindings,
      }),
      maxTokens: 3000,
      temperature: 0.3,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: testPlanSchema,
    });

    return aiJson(
      {
        controlId: body.data.controlId,
        controlTitle: ctrl.title,
        testPlan: result.data,
        model: result.model,
        provider: result.provider,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
