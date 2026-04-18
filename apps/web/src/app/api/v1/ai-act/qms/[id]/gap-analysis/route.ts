// GET /api/v1/ai-act/qms/[id]/gap-analysis
//
// Sprint 5.2: QMS-Maturity + ISO-42001-Gap-Analysis.
// Liefert Composite-Report fuer Sprint 5.2 Dashboard.

import { db, aiProviderQms } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  assessQmsReadinessForCe,
  assessIso42001Gap,
  type QmsProcedureChecklist,
  type Iso42001Context,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [qms] = await db
    .select()
    .from(aiProviderQms)
    .where(and(eq(aiProviderQms.id, id), eq(aiProviderQms.orgId, ctx.orgId)));
  if (!qms) {
    return Response.json({ error: "QMS not found" }, { status: 404 });
  }

  const checklist: QmsProcedureChecklist = {
    riskManagementProcedure: qms.riskManagementProcedure,
    dataGovernanceProcedure: qms.dataGovernanceProcedure,
    technicalDocumentationProcedure: qms.technicalDocumentationProcedure,
    recordKeepingProcedure: qms.recordKeepingProcedure,
    transparencyProcedure: qms.transparencyProcedure,
    humanOversightProcedure: qms.humanOversightProcedure,
    accuracyRobustnessProcedure: qms.accuracyRobustnessProcedure,
    cybersecurityProcedure: qms.cybersecurityProcedure,
    incidentReportingProcedure: qms.incidentReportingProcedure,
    thirdPartyManagementProcedure: qms.thirdPartyManagementProcedure,
  };

  const readiness = assessQmsReadinessForCe(checklist);

  // ISO-42001-Context: aus URL-Params oder Defaults. In spaeterer Iteration:
  // eigene Tabelle iso_42001_assessment.
  const url = new URL(req.url);
  const hasAiPolicy = url.searchParams.get("hasAiPolicy") === "true";
  const hasManagementObjectives = url.searchParams.get("hasManagementObjectives") === "true";
  const hasAiImpactAssessment = url.searchParams.get("hasAiImpactAssessment") === "true";
  const hasResourceAllocation = url.searchParams.get("hasResourceAllocation") === "true";
  const hasCompetenceManagement = url.searchParams.get("hasCompetenceManagement") === "true";
  const hasInternalAudit = url.searchParams.get("hasInternalAudit") === "true";
  const hasManagementReview = url.searchParams.get("hasManagementReview") === "true";

  const iso42001Ctx: Iso42001Context = {
    qms: checklist,
    hasAiPolicy,
    hasManagementObjectives,
    hasAiImpactAssessment,
    hasResourceAllocation,
    hasCompetenceManagement,
    hasInternalAudit,
    hasManagementReview,
  };
  const iso42001 = assessIso42001Gap(iso42001Ctx);

  return Response.json({
    data: {
      qmsId: qms.id,
      aiSystemId: qms.aiSystemId,
      maturityScore: readiness.maturityScore,
      readyForCe: readiness.readyForCe,
      reasoning: readiness.reasoning,
      procedureChecklist: checklist,
      completed: readiness.completed,
      missing: readiness.missing,
      iso42001: {
        totalControls: iso42001.totalControls,
        implementedControls: iso42001.implementedControls,
        coveragePercent: iso42001.coveragePercent,
        gaps: iso42001.gaps,
        strongOverlaps: iso42001.strongOverlaps,
      },
    },
  });
}
