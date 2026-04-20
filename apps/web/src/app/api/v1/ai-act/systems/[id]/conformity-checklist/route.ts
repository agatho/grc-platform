// POST /api/v1/ai-act/systems/[id]/conformity-checklist
//
// Sprint 5.5: Evaluates aiConformityAssessment.requirements JSONB gegen die
// Requirement-State-Machine. Nutzt das existierende aiConformityAssessment-Record
// (assessmentId in body) oder ad-hoc requirements-list.

import { db, aiSystem, aiConformityAssessment } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  evaluateConformityChecklist,
  type ConformityRequirement,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const requirementSchema = z.object({
  requirementId: z.string().min(1).max(100),
  description: z.string().max(2000),
  status: z.enum(["not_assessed", "pass", "fail", "partial", "not_applicable"]),
  evidence: z.string().max(2000).nullable(),
  notes: z.string().max(2000).nullable(),
});

const bodySchema = z.object({
  assessmentId: z.string().uuid().optional(),
  requirements: z.array(requirementSchema).max(200).optional(),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager", "auditor");
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
    })
    .from(aiSystem)
    .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)));
  if (!system) {
    return Response.json({ error: "AI system not found" }, { status: 404 });
  }

  let requirements: ConformityRequirement[] = [];

  if (parsed.data.assessmentId) {
    const [assessment] = await db
      .select()
      .from(aiConformityAssessment)
      .where(
        and(
          eq(aiConformityAssessment.id, parsed.data.assessmentId),
          eq(aiConformityAssessment.orgId, ctx.orgId),
          eq(aiConformityAssessment.aiSystemId, id),
        ),
      );
    if (!assessment) {
      return Response.json({ error: "Assessment not found" }, { status: 404 });
    }
    requirements = (assessment.requirements as ConformityRequirement[]) ?? [];
  } else if (parsed.data.requirements) {
    requirements = parsed.data.requirements;
  } else {
    return Response.json(
      { error: "Either assessmentId or requirements must be provided" },
      { status: 422 },
    );
  }

  const result = evaluateConformityChecklist(requirements);

  return Response.json({
    data: {
      aiSystemId: id,
      assessmentId: parsed.data.assessmentId ?? null,
      totalRequirements: result.totalRequirements,
      passCount: result.passCount,
      failCount: result.failCount,
      partialCount: result.partialCount,
      naCount: result.naCount,
      notAssessedCount: result.notAssessedCount,
      coveragePercent: result.coveragePercent,
      readyForDecision: result.readyForDecision,
      overallResult: result.overallResult,
    },
  });
}
