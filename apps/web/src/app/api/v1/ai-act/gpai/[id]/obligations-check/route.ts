// POST /api/v1/ai-act/gpai/[id]/obligations-check
//
// Sprint 5.7: Art. 53 (GPAI) + Art. 55 (Systemic) Obligations-Check.

import { db, aiGpaiModel } from "@grc/db";
import { requireModule } from "@grc/auth";
import { assessGpaiObligations, type GpaiObligationContext } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  respectsCopyrightDirective: z.boolean().default(false),
  downstreamProviderInfoShared: z.boolean().default(false),
  isNonEuProvider: z.boolean().default(false),
  isSystemic: z.boolean().default(false),
  hasModelEvaluations: z.boolean().default(false),
  hasSystemicRiskAssessment: z.boolean().default(false),
});

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: RouteParams,
) {
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
    .select()
    .from(aiGpaiModel)
    .where(and(eq(aiGpaiModel.id, id), eq(aiGpaiModel.orgId, ctx.orgId)));
  if (!model) {
    return Response.json({ error: "GPAI model not found" }, { status: 404 });
  }

  const adversarialResults = (model.adversarialTestingResults ?? {}) as Record<
    string,
    unknown
  >;
  const hasAdversarialTesting = Object.keys(adversarialResults).length > 0;

  const input: GpaiObligationContext = {
    hasTechnicalDocumentation:
      Boolean(model.capabilitiesSummary) && Boolean(model.intendedUse),
    hasTrainingDataSummary: Boolean(model.trainingDataSummary),
    respectsCopyrightDirective: parsed.data.respectsCopyrightDirective,
    downstreamProviderInfoShared: parsed.data.downstreamProviderInfoShared,
    hasEuRepresentative: Boolean(model.euRepresentativeContact),
    isNonEuProvider: parsed.data.isNonEuProvider,
    isSystemic: parsed.data.isSystemic,
    hasModelEvaluations: parsed.data.hasModelEvaluations,
    hasAdversarialTesting,
    hasSystemicRiskAssessment: parsed.data.hasSystemicRiskAssessment,
    hasIncidentReporting: model.incidentReportingEnabled ?? false,
    hasCybersecurityMeasures: Boolean(model.cybersecurityMeasures),
  };
  const result = assessGpaiObligations(input);

  return Response.json({
    data: {
      gpaiModelId: id,
      name: model.name,
      isSystemic: parsed.data.isSystemic,
      standardPercent: result.standardPercent,
      systemicPercent: result.systemicPercent,
      standardObligationsMet: result.standardObligationsMet,
      systemicObligationsMet: result.systemicObligationsMet,
      missing: result.missing,
      isFullyCompliant: result.isFullyCompliant,
    },
  });
});
