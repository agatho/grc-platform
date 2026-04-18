// POST /api/v1/ai-act/frias/[id]/quality-check
//
// Sprint 5.6: FRIA-Quality-Assessment basierend auf aiFria.rightsAssessed JSONB.

import { db, aiFria } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  assessFriaQuality,
  type FriaQualityInput,
  type FriaRightAssessment,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  hasDiscriminationAnalysis: z.boolean().default(false),
  hasDataProtectionImpact: z.boolean().default(false),
  hasAccessToJusticeAnalysis: z.boolean().default(false),
  hasAffectedPersonsConsultation: z.boolean().default(false),
  hasOverallImpactStatement: z.boolean().default(false),
  hasMitigationMeasuresDocumented: z.boolean().default(false),
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

  const [fria] = await db
    .select()
    .from(aiFria)
    .where(and(eq(aiFria.id, id), eq(aiFria.orgId, ctx.orgId)));
  if (!fria) {
    return Response.json({ error: "FRIA not found" }, { status: 404 });
  }

  const rightsRaw = (fria.rightsAssessed ?? []) as unknown[];
  const rightsAssessed: FriaRightAssessment[] = rightsRaw.filter(
    (r): r is FriaRightAssessment =>
      typeof r === "object" &&
      r !== null &&
      "right" in r &&
      "impact" in r &&
      "residualRisk" in r,
  );

  const input: FriaQualityInput = {
    rightsAssessed,
    ...parsed.data,
  };
  const result = assessFriaQuality(input);

  return Response.json({
    data: {
      friaId: id,
      aiSystemId: fria.aiSystemId,
      overallImpact: fria.overallImpact,
      rightsCoverage: result.rightsCoverage,
      qualityChecksPercent: result.qualityChecksPercent,
      hasHighResidualRisk: result.hasHighResidualRisk,
      highResidualRights: result.highResidualRights,
      missing: result.missing,
      isApprovable: result.isApprovable,
    },
  });
}
