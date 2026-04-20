// POST /api/v1/ai-act/systems/[id]/fria-required
//
// Sprint 5.6: Art. 27 FRIA-Requirement-Determination.

import { db, aiSystem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { determineFriaRequirement, type FriaDetermination } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  deployerType: z.enum(["public_sector", "private_sector"]),
  annexIIICategory: z.string().max(50).nullable().default(null),
  isCreditScoring: z.boolean().default(false),
  isLifeHealthInsurance: z.boolean().default(false),
  isLawEnforcement: z.boolean().default(false),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager", "dpo");
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

  const input: FriaDetermination = {
    riskClassification:
      system.riskClassification as FriaDetermination["riskClassification"],
    deployerType: parsed.data.deployerType,
    annexIIICategory: parsed.data.annexIIICategory,
    isCreditScoring: parsed.data.isCreditScoring,
    isLifeHealthInsurance: parsed.data.isLifeHealthInsurance,
    isLawEnforcement: parsed.data.isLawEnforcement,
  };
  const result = determineFriaRequirement(input);

  return Response.json({
    data: {
      aiSystemId: id,
      riskClassification: system.riskClassification,
      deployerType: parsed.data.deployerType,
      isFriaRequired: result.isFriaRequired,
      recommendationLevel: result.recommendationLevel,
      reason: result.reason,
    },
  });
}
