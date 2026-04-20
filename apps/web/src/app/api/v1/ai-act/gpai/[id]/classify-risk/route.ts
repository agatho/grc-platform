// POST /api/v1/ai-act/gpai/[id]/classify-risk
//
// Sprint 5.7: Art. 51 GPAI Systemic-Risk-Classification.

import { db, aiGpaiModel } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  classifyGpaiSystemicRisk,
  type GpaiSystemicRiskContext,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  trainingComputeFlops: z.number().nonnegative().nullable().default(null),
  commissionDesignated: z.boolean().default(false),
  hasHighImpactCapabilities: z.boolean().default(false),
  parametersCount: z.number().int().nonnegative().nullable().default(null),
  hasAdvancedReasoning: z.boolean().default(false),
  hasMultimodalCapabilities: z.boolean().default(false),
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

  const [model] = await db
    .select({
      id: aiGpaiModel.id,
      name: aiGpaiModel.name,
      modelType: aiGpaiModel.modelType,
    })
    .from(aiGpaiModel)
    .where(and(eq(aiGpaiModel.id, id), eq(aiGpaiModel.orgId, ctx.orgId)));
  if (!model) {
    return Response.json({ error: "GPAI model not found" }, { status: 404 });
  }

  const input: GpaiSystemicRiskContext = parsed.data;
  const result = classifyGpaiSystemicRisk(input);

  return Response.json({
    data: {
      gpaiModelId: id,
      name: model.name,
      modelType: model.modelType,
      isSystemic: result.isSystemic,
      tierLevel: result.tierLevel,
      triggers: result.triggers,
      reasoning: result.reasoning,
    },
  });
}
