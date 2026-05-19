// POST /api/v1/ai-act/systems/[id]/classify
//
// Sprint 5.1: AI-System Classification + Prohibited-Screening in einem Schritt.
// Erzeugt / updated ai_prohibited_screening + setzt risk_category auf ai_system.

import { db, aiSystem, aiProhibitedScreening } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  classifyAiSystem,
  determineFriaRequirement,
  hasProhibitedPractice,
  type ClassificationContext,
  type FriaDetermination,
  type ProhibitedPracticesFlags,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const flagsSchema = z.object({
  subliminalManipulation: z.boolean().default(false),
  exploitationVulnerable: z.boolean().default(false),
  socialScoring: z.boolean().default(false),
  predictivePolicingIndividual: z.boolean().default(false),
  facialRecognitionScraping: z.boolean().default(false),
  emotionInferenceWorkplace: z.boolean().default(false),
  biometricCategorization: z.boolean().default(false),
  realTimeBiometricPublic: z.boolean().default(false),
});

const bodySchema = z.object({
  prohibited: flagsSchema,
  annexIII: z.object({
    biometric: z.boolean().default(false),
    criticalInfra: z.boolean().default(false),
    education: z.boolean().default(false),
    employment: z.boolean().default(false),
    essentialServices: z.boolean().default(false),
    lawEnforcement: z.boolean().default(false),
    migrationBorder: z.boolean().default(false),
    justice: z.boolean().default(false),
  }),
  art6ExceptionApplies: z.boolean().default(false),
  isGpaiFoundation: z.boolean().default(false),
  isGpaiSystemicRisk: z.boolean().default(false),
  hasArt50TransparencyObligation: z.boolean().default(false),
  exceptionApplied: z.boolean().default(false),
  exceptionJustification: z.string().max(5000).nullable().optional(),
  // F#25 (overnight 2026-05-18): if the deployer context is known at
  // classification time, also tell the caller whether a FRIA is required.
  // All three default to neutral values so existing callers don't break.
  deployerType: z.enum(["public_sector", "private_sector"]).optional(),
  isCreditScoring: z.boolean().default(false),
  isLifeHealthInsurance: z.boolean().default(false),
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
    .select()
    .from(aiSystem)
    .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)));
  if (!system) {
    return Response.json({ error: "AI system not found" }, { status: 404 });
  }

  const flags: ProhibitedPracticesFlags = parsed.data.prohibited;

  const classificationCtx: ClassificationContext = {
    annexIIIBiometric: parsed.data.annexIII.biometric,
    annexIIICriticalInfra: parsed.data.annexIII.criticalInfra,
    annexIIIEducation: parsed.data.annexIII.education,
    annexIIIEmployment: parsed.data.annexIII.employment,
    annexIIIEssentialServices: parsed.data.annexIII.essentialServices,
    annexIIILawEnforcement: parsed.data.annexIII.lawEnforcement,
    annexIIIMigrationBorder: parsed.data.annexIII.migrationBorder,
    annexIIIJustice: parsed.data.annexIII.justice,
    art6ExceptionApplies: parsed.data.art6ExceptionApplies,
    isGpaiFoundation: parsed.data.isGpaiFoundation,
    isGpaiSystemicRisk: parsed.data.isGpaiSystemicRisk,
    hasArt50TransparencyObligation: parsed.data.hasArt50TransparencyObligation,
    prohibitedFlags: flags,
  };

  const { category, reasoning } = classifyAiSystem(classificationCtx);

  // Prohibited-Screening persist
  await withAuditContext(ctx, async (tx) => {
    const existingScreenings = await tx
      .select({ id: aiProhibitedScreening.id })
      .from(aiProhibitedScreening)
      .where(
        and(
          eq(aiProhibitedScreening.orgId, ctx.orgId),
          eq(aiProhibitedScreening.aiSystemId, id),
        ),
      );
    if (existingScreenings.length > 0) {
      await tx
        .update(aiProhibitedScreening)
        .set({
          subliminalManipulation: flags.subliminalManipulation,
          exploitationVulnerable: flags.exploitationVulnerable,
          socialScoring: flags.socialScoring,
          predictivePolicingIndividual: flags.predictivePolicingIndividual,
          facialRecognitionScraping: flags.facialRecognitionScraping,
          emotionInferenceWorkplace: flags.emotionInferenceWorkplace,
          biometricCategorization: flags.biometricCategorization,
          realTimeBiometricPublic: flags.realTimeBiometricPublic,
          exceptionApplied: parsed.data.exceptionApplied,
          exceptionJustification: parsed.data.exceptionJustification ?? null,
          screeningDate: new Date(),
          screenedBy: ctx.userId,
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(aiProhibitedScreening.id, existingScreenings[0].id));
    } else {
      await tx.insert(aiProhibitedScreening).values({
        orgId: ctx.orgId,
        aiSystemId: id,
        subliminalManipulation: flags.subliminalManipulation,
        exploitationVulnerable: flags.exploitationVulnerable,
        socialScoring: flags.socialScoring,
        predictivePolicingIndividual: flags.predictivePolicingIndividual,
        facialRecognitionScraping: flags.facialRecognitionScraping,
        emotionInferenceWorkplace: flags.emotionInferenceWorkplace,
        biometricCategorization: flags.biometricCategorization,
        realTimeBiometricPublic: flags.realTimeBiometricPublic,
        exceptionApplied: parsed.data.exceptionApplied,
        exceptionJustification: parsed.data.exceptionJustification ?? null,
        screenedBy: ctx.userId,
        status: "completed",
      });
    }
  });

  // F#25: derive the FRIA recommendation in the same response, so callers
  // see the Art. 27 obligation without a second round-trip. If deployer
  // context wasn't supplied we still emit a "may be required" hint when
  // the classification came back high-risk, pointing at the dedicated
  // /fria-required endpoint for the full determination.
  const friaCtx: FriaDetermination = {
    riskClassification: category,
    deployerType: parsed.data.deployerType ?? "private_sector",
    annexIIICategory: parsed.data.annexIII.lawEnforcement
      ? "law_enforcement"
      : parsed.data.annexIII.criticalInfra
        ? "critical_infrastructure"
        : null,
    isCreditScoring: parsed.data.isCreditScoring,
    isLifeHealthInsurance: parsed.data.isLifeHealthInsurance,
    isLawEnforcement: parsed.data.annexIII.lawEnforcement,
  };
  const fria = determineFriaRequirement(friaCtx);

  const warnings: string[] = [];
  if (hasProhibitedPractice(flags) && !parsed.data.exceptionApplied) {
    warnings.push(
      "HARD-STOP: prohibited practice erkannt. Transition zu production nur mit exceptionApplied + justification moeglich.",
    );
  }
  if (
    category === "high" &&
    parsed.data.deployerType === undefined &&
    fria.recommendationLevel !== "not_required"
  ) {
    warnings.push(
      "High-Risk classified — FRIA may be required (Art. 27). Call POST /api/v1/ai-act/systems/:id/fria-required with deployerType + sector flags for the full determination.",
    );
  }

  return Response.json({
    data: {
      aiSystemId: id,
      prohibited: flags,
      hasProhibited: hasProhibitedPractice(flags),
      classification: {
        category,
        reasoning,
      },
      fria,
      warnings,
    },
  });
}
