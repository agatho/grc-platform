// POST /api/v1/ai-act/systems/[id]/ce-marking-gate
//
// Sprint 5.5: Composite CE-Marking-Gate-Check.
// Aggregiert Conformity-Result + DoC + Annex IV + Notified-Body-Cert +
// EU-DB-Registration + Post-Market-Plan in EINER Antwort -- "kann CE aufgebracht
// werden?"

import { db, aiSystem, aiConformityAssessment } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateCeMarkingGate,
  type CeMarkingGateContext,
  type ConformityProcedure,
} from "@grc/shared";
import { and, eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  procedure: z.enum(["annex_vi", "annex_vii"]),
  hasSignedDeclarationOfConformity: z.boolean().default(false),
  annexIvSectionsCompleted: z.number().int().min(0).max(9).default(0),
  hasNotifiedBodyCertificate: z.boolean().default(false),
  registeredInEuDatabase: z.boolean().default(false),
  hasPostMarketMonitoringPlan: z.boolean().default(false),
  certificateValidUntilIso: z.string().datetime().nullable().optional(),
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
    })
    .from(aiSystem)
    .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)));
  if (!system) {
    return Response.json({ error: "AI system not found" }, { status: 404 });
  }

  if (system.riskClassification !== "high") {
    return Response.json(
      {
        error: "CE-Marking only applicable to high-risk systems",
        riskClassification: system.riskClassification,
      },
      { status: 422 },
    );
  }

  // Holt das letzte Conformity-Assessment (by created_at desc)
  const [latestAssessment] = await db
    .select({
      overallResult: aiConformityAssessment.overallResult,
      status: aiConformityAssessment.status,
    })
    .from(aiConformityAssessment)
    .where(
      and(
        eq(aiConformityAssessment.orgId, ctx.orgId),
        eq(aiConformityAssessment.aiSystemId, id),
      ),
    )
    .orderBy(desc(aiConformityAssessment.createdAt))
    .limit(1);

  const conformityResult: CeMarkingGateContext["conformityResult"] =
    latestAssessment
      ? ((latestAssessment.overallResult as CeMarkingGateContext["conformityResult"]) ??
        "pending")
      : "pending";

  const gateCtx: CeMarkingGateContext = {
    conformityResult,
    procedure: parsed.data.procedure as ConformityProcedure,
    hasSignedDeclarationOfConformity:
      parsed.data.hasSignedDeclarationOfConformity,
    annexIvSectionsCompleted: parsed.data.annexIvSectionsCompleted,
    hasNotifiedBodyCertificate: parsed.data.hasNotifiedBodyCertificate,
    registeredInEuDatabase: parsed.data.registeredInEuDatabase,
    hasPostMarketMonitoringPlan: parsed.data.hasPostMarketMonitoringPlan,
    certificateValidUntil: parsed.data.certificateValidUntilIso
      ? new Date(parsed.data.certificateValidUntilIso)
      : null,
  };

  const result = validateCeMarkingGate(gateCtx);

  return Response.json({
    data: {
      aiSystemId: id,
      conformityResult,
      procedure: gateCtx.procedure,
      canAffixCeMarking: result.canAffixCeMarking,
      blockers: result.blockers,
      warnings: result.warnings,
      certificateExpiresInDays: result.certificateExpiresInDays,
    },
  });
}
