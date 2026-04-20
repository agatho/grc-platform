// POST /api/v1/ai-act/systems/[id]/substantial-change-check
//
// Sprint 5.3: Art. 43 (4) Substantial-Change-Detection.
// Bei substantial change => Re-Assessment + ggf. neuer Conformity-Assessment noetig.

import { db, aiSystem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { assessSubstantialChange, type ChangeSignal } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  trainingDataChange: z.boolean().default(false),
  architectureChange: z.boolean().default(false),
  purposeChange: z.boolean().default(false),
  performanceDrift: z.boolean().default(false),
  newDataCategories: z.boolean().default(false),
  contextChange: z.boolean().default(false),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [system] = await db
    .select({
      id: aiSystem.id,
      riskClassification: aiSystem.riskClassification,
      status: aiSystem.status,
    })
    .from(aiSystem)
    .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)));
  if (!system) {
    return Response.json({ error: "AI system not found" }, { status: 404 });
  }

  const signals: ChangeSignal = parsed.data;
  const result = assessSubstantialChange(signals);

  const requiresConformityReassessment =
    result.isSubstantial && system.riskClassification === "high";

  return Response.json({
    data: {
      aiSystemId: id,
      riskClassification: system.riskClassification,
      changeCount: result.changeCount,
      triggeredSignals: result.triggeredSignals,
      isSubstantial: result.isSubstantial,
      requiresReassessment: result.requiresReassessment,
      requiresConformityReassessment,
      reason: result.reason,
      warnings: requiresConformityReassessment
        ? [
            "Substantial change an High-Risk-System: neues Conformity-Assessment nach Art. 43 (4) erforderlich.",
          ]
        : [],
    },
  });
}
