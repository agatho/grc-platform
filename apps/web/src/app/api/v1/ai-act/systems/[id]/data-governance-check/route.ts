// POST /api/v1/ai-act/systems/[id]/data-governance-check
//
// Sprint 5.3: Art. 10 Data-Governance-Assessment.
// Pruefung Training-Data-Qualitaet, Bias-Testing, Provenance + Legal-Basis.

import { db, aiSystem } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  assessDataGovernance,
  type DataGovernanceQuality,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  hasTrainingDataDescription: z.boolean().default(false),
  hasDataCollectionProcess: z.boolean().default(false),
  hasLabelingProcess: z.boolean().default(false),
  hasDataCleaningSteps: z.boolean().default(false),
  datasetSize: z.number().int().nonnegative().nullable().default(null),
  hasDemographicCoverage: z.boolean().default(false),
  hasBiasTestingDone: z.boolean().default(false),
  biasTestResults: z
    .array(
      z.object({
        cohort: z.string().min(1).max(200),
        metric: z.string().min(1).max(100),
        score: z.number(),
      }),
    )
    .nullable()
    .default(null),
  hasDataProvenance: z.boolean().default(false),
  hasLegalBasisForTraining: z.boolean().default(false),
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
    .select({ id: aiSystem.id, riskClassification: aiSystem.riskClassification })
    .from(aiSystem)
    .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)));
  if (!system) {
    return Response.json({ error: "AI system not found" }, { status: 404 });
  }

  const input: DataGovernanceQuality = parsed.data;
  const result = assessDataGovernance(input);

  return Response.json({
    data: {
      aiSystemId: id,
      riskClassification: system.riskClassification,
      completenessPercent: result.completenessPercent,
      biasTestingCoverage: result.biasTestingCoverage,
      missing: result.missing,
      hasCriticalGaps: result.hasCriticalGaps,
      readyForHighRisk: result.readyForHighRisk,
      warnings: result.hasCriticalGaps
        ? ["Kritische Luecken: ohne bias-testing / legal-basis / provenance kein AI-Act-konformes Training."]
        : [],
    },
  });
}
