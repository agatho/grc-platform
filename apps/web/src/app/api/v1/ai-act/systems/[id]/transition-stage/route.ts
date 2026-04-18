// POST /api/v1/ai-act/systems/[id]/transition-stage
//
// Sprint 5.1: Development-Stage-Transition mit Prohibited-Hard-Stop
// + High-Risk-Production-Gate.

import { db, aiSystem, aiProhibitedScreening, aiConformityAssessment, aiProviderQms } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  AI_STAGE_ALLOWED_TRANSITIONS,
  canTransitionToProduction,
  validateHighRiskProductionGate,
  type AiDevelopmentStage,
  type ProhibitedPracticesFlags,
  type HighRiskProductionReadiness,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  targetStage: z.enum(["research", "prototype", "production", "retired"]),
  readiness: z
    .object({
      hasQms: z.boolean().default(false),
      hasRiskManagement: z.boolean().default(false),
      hasDataGovernance: z.boolean().default(false),
      hasTechnicalDocumentation: z.boolean().default(false),
      hasOperationalLogging: z.boolean().default(false),
      hasHumanOversight: z.boolean().default(false),
      hasConformityAssessment: z.boolean().default(false),
      ceMarkingAffixed: z.boolean().default(false),
    })
    .optional(),
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
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const [system] = await db
    .select()
    .from(aiSystem)
    .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)));
  if (!system) {
    return Response.json({ error: "AI system not found" }, { status: 404 });
  }

  // ai_system-Schema hat keine `developmentStage` Spalte, sondern `status`
  // mit anderen Werten. Wir mappen unsere Workflow-Stages auf den
  // bestehenden `status`-Wert:
  //   research -> draft
  //   prototype -> under_review
  //   production -> compliant
  //   retired -> decommissioned
  const DB_STATUS_TO_STAGE: Record<string, AiDevelopmentStage> = {
    draft: "research",
    registered: "prototype",
    under_review: "prototype",
    compliant: "production",
    non_compliant: "production",
    decommissioned: "retired",
  };
  const STAGE_TO_DB_STATUS: Record<AiDevelopmentStage, string> = {
    research: "draft",
    prototype: "under_review",
    production: "compliant",
    retired: "decommissioned",
  };
  const currentStage = DB_STATUS_TO_STAGE[system.status] ?? "research";
  const targetStage = parsed.data.targetStage;

  // Basis-Transition-Check
  const allowed = AI_STAGE_ALLOWED_TRANSITIONS[currentStage] ?? [];
  if (!allowed.includes(targetStage)) {
    return Response.json(
      {
        blocked: true,
        reason: `Stage-Transition ${currentStage} → ${targetStage} nicht erlaubt. Zulaessig: ${allowed.join(", ") || "(keine)"}.`,
      },
      { status: 422 },
    );
  }

  // Prohibited-Hard-Stop-Check bei Production
  if (targetStage === "production") {
    const [screening] = await db
      .select()
      .from(aiProhibitedScreening)
      .where(and(eq(aiProhibitedScreening.aiSystemId, id), eq(aiProhibitedScreening.orgId, ctx.orgId)));

    if (!screening) {
      return Response.json(
        {
          blocked: true,
          reason:
            "Kein Prohibited-Screening erfolgt. Fuehre zuerst /api/v1/ai-act/systems/{id}/classify aus.",
        },
        { status: 422 },
      );
    }

    const flags: ProhibitedPracticesFlags = {
      subliminalManipulation: screening.subliminalManipulation,
      exploitationVulnerable: screening.exploitationVulnerable,
      socialScoring: screening.socialScoring,
      predictivePolicingIndividual: screening.predictivePolicingIndividual,
      facialRecognitionScraping: screening.facialRecognitionScraping,
      emotionInferenceWorkplace: screening.emotionInferenceWorkplace,
      biometricCategorization: screening.biometricCategorization,
      realTimeBiometricPublic: screening.realTimeBiometricPublic,
    };

    const prodCheck = canTransitionToProduction(
      currentStage,
      flags,
      screening.exceptionApplied ?? false,
      screening.exceptionJustification,
    );
    if (!prodCheck.allowed) {
      return Response.json({ blocked: true, reason: prodCheck.reason }, { status: 422 });
    }

    // Fuer High-Risk zusaetzlich alle 8 Gates pruefen
    // ai_system.riskClassification = 'high' | 'unacceptable' | 'limited' | 'minimal'
    if (system.riskClassification === "high") {
      // Checks: falls Readiness NICHT explicit uebergeben, aus DB ableiten
      let readiness: HighRiskProductionReadiness;
      if (parsed.data.readiness) {
        readiness = parsed.data.readiness;
      } else {
        const [qms] = await db
          .select({ maturity: aiProviderQms.overallMaturity })
          .from(aiProviderQms)
          .where(and(eq(aiProviderQms.orgId, ctx.orgId), eq(aiProviderQms.aiSystemId, id)));
        const [conformity] = await db
          .select({
            overallResult: aiConformityAssessment.overallResult,
            certificateReference: aiConformityAssessment.certificateReference,
          })
          .from(aiConformityAssessment)
          .where(and(eq(aiConformityAssessment.orgId, ctx.orgId), eq(aiConformityAssessment.aiSystemId, id)));
        readiness = {
          hasQms: (qms?.maturity ?? 0) > 0,
          hasRiskManagement: false,
          hasDataGovernance: false,
          hasTechnicalDocumentation: (system.technicalDocumentation as Record<string, unknown> | null)
            ? Object.keys((system.technicalDocumentation as Record<string, unknown>) ?? {}).length > 0
            : false,
          hasOperationalLogging: false,
          hasHumanOversight: system.humanOversightRequired ?? false,
          hasConformityAssessment: conformity?.overallResult === "pass",
          ceMarkingAffixed: !!conformity?.certificateReference,
        };
      }
      const blockers = validateHighRiskProductionGate(readiness);
      if (blockers.filter((b) => b.severity === "error").length > 0) {
        return Response.json(
          {
            blocked: true,
            reason: "High-Risk-Production-Gate nicht erfuellt.",
            blockers,
          },
          { status: 422 },
        );
      }
    }
  }

  // Transition durchfuehren -- mappe logical Stage auf DB-Status
  const newDbStatus = STAGE_TO_DB_STATUS[targetStage];
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(aiSystem)
      .set({ status: newDbStatus, updatedAt: new Date() })
      .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  return Response.json({
    data: result,
    previousStage: currentStage,
  });
}
