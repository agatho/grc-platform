// GET /api/v1/ai-act/annual-report/[year]
//
// Sprint 5.7: Annual AI-Act-Compliance-Report. Aggregiert Systems + Conformity +
// Incidents + FRIAs + QMS + GPAI + Corrective-Actions + Overdue-Notifications
// in einen Jahres-Snapshot.

import {
  db,
  aiSystem,
  aiConformityAssessment,
  aiFria,
  aiIncident,
  aiCorrectiveAction,
  aiGpaiModel,
  aiProviderQms,
  organization,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  computeAnnualReport,
  assessQmsReadinessForCe,
  type AnnualReportInput,
  type QmsProcedureChecklist,
} from "@grc/shared";
import { and, eq, gte, lt, sql, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ year: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 2000 || year > 3000) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));
  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const endOfYear = new Date(Date.UTC(year + 1, 0, 1));

  // ─── Systems ──────────────────────────────────────────────
  const [sysCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unacceptable: sql<number>`count(*) filter (where ${aiSystem.riskClassification} = 'unacceptable')::int`,
      high: sql<number>`count(*) filter (where ${aiSystem.riskClassification} = 'high')::int`,
      limited: sql<number>`count(*) filter (where ${aiSystem.riskClassification} = 'limited')::int`,
      minimal: sql<number>`count(*) filter (where ${aiSystem.riskClassification} = 'minimal')::int`,
      compliant: sql<number>`count(*) filter (where ${aiSystem.status} = 'compliant')::int`,
      nonCompliant: sql<number>`count(*) filter (where ${aiSystem.status} = 'non_compliant')::int`,
      inAssessment: sql<number>`count(*) filter (where ${aiSystem.status} = 'under_review')::int`,
    })
    .from(aiSystem)
    .where(and(eq(aiSystem.orgId, ctx.orgId), isNull(aiSystem.deletedAt)));

  // ─── Conformity Assessments ───────────────────────────────
  const [conformityCounts] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${aiConformityAssessment.status} = 'completed')::int`,
      passed: sql<number>`count(*) filter (where ${aiConformityAssessment.overallResult} = 'pass')::int`,
      failed: sql<number>`count(*) filter (where ${aiConformityAssessment.overallResult} = 'fail')::int`,
      pending: sql<number>`count(*) filter (where ${aiConformityAssessment.overallResult} = 'pending' or ${aiConformityAssessment.overallResult} is null)::int`,
    })
    .from(aiConformityAssessment)
    .where(
      and(
        eq(aiConformityAssessment.orgId, ctx.orgId),
        gte(aiConformityAssessment.createdAt, startOfYear),
        lt(aiConformityAssessment.createdAt, endOfYear),
      ),
    );

  // ─── Incidents ────────────────────────────────────────────
  const [incidentCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      serious: sql<number>`count(*) filter (where ${aiIncident.isSerious} = true)::int`,
      overdue: sql<number>`count(*) filter (where ${aiIncident.authorityDeadline} < now() and ${aiIncident.authorityNotifiedAt} is null)::int`,
      avgNotifyHours: sql<
        number | null
      >`avg(extract(epoch from (${aiIncident.authorityNotifiedAt} - ${aiIncident.detectedAt}))/3600) filter (where ${aiIncident.authorityNotifiedAt} is not null)`,
    })
    .from(aiIncident)
    .where(
      and(
        eq(aiIncident.orgId, ctx.orgId),
        gte(aiIncident.detectedAt, startOfYear),
        lt(aiIncident.detectedAt, endOfYear),
      ),
    );

  // ─── FRIAs ────────────────────────────────────────────────
  const [friaCounts] = await db
    .select({
      required: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${aiFria.status} in ('completed','approved'))::int`,
      approved: sql<number>`count(*) filter (where ${aiFria.status} = 'approved')::int`,
    })
    .from(aiFria)
    .where(eq(aiFria.orgId, ctx.orgId));

  // ─── QMS ──────────────────────────────────────────────────
  const qmsRows = await db
    .select()
    .from(aiProviderQms)
    .where(eq(aiProviderQms.orgId, ctx.orgId));

  let totalMaturity = 0;
  let readyForCe = 0;
  for (const q of qmsRows) {
    const checklist: QmsProcedureChecklist = {
      riskManagementProcedure: q.riskManagementProcedure,
      dataGovernanceProcedure: q.dataGovernanceProcedure,
      technicalDocumentationProcedure: q.technicalDocumentationProcedure,
      recordKeepingProcedure: q.recordKeepingProcedure,
      transparencyProcedure: q.transparencyProcedure,
      humanOversightProcedure: q.humanOversightProcedure,
      accuracyRobustnessProcedure: q.accuracyRobustnessProcedure,
      cybersecurityProcedure: q.cybersecurityProcedure,
      incidentReportingProcedure: q.incidentReportingProcedure,
      thirdPartyManagementProcedure: q.thirdPartyManagementProcedure,
    };
    const readiness = assessQmsReadinessForCe(checklist);
    totalMaturity += readiness.maturityScore;
    if (readiness.readyForCe) readyForCe++;
  }
  const avgMaturity =
    qmsRows.length > 0 ? Math.round(totalMaturity / qmsRows.length) : 0;
  const notReadyForCe = qmsRows.length - readyForCe;

  // ─── GPAI ─────────────────────────────────────────────────
  const [gpaiCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      systemic: sql<number>`count(*) filter (where ${aiGpaiModel.modelType} = 'systemic')::int`,
    })
    .from(aiGpaiModel)
    .where(eq(aiGpaiModel.orgId, ctx.orgId));

  // ─── Corrective Actions ───────────────────────────────────
  const [caCounts] = await db
    .select({
      open: sql<number>`count(*) filter (where ${aiCorrectiveAction.status} = 'open')::int`,
      closed: sql<number>`count(*) filter (where ${aiCorrectiveAction.status} = 'closed')::int`,
      overdue: sql<number>`count(*) filter (where ${aiCorrectiveAction.dueDate} < current_date and ${aiCorrectiveAction.status} != 'closed')::int`,
    })
    .from(aiCorrectiveAction)
    .where(eq(aiCorrectiveAction.orgId, ctx.orgId));

  const reportInput: AnnualReportInput = {
    year,
    systems: {
      total: sysCounts?.total ?? 0,
      byRisk: {
        unacceptable: sysCounts?.unacceptable ?? 0,
        high: sysCounts?.high ?? 0,
        limited: sysCounts?.limited ?? 0,
        minimal: sysCounts?.minimal ?? 0,
      },
      compliant: sysCounts?.compliant ?? 0,
      nonCompliant: sysCounts?.nonCompliant ?? 0,
      inAssessment: sysCounts?.inAssessment ?? 0,
    },
    conformityAssessments: {
      completed: conformityCounts?.completed ?? 0,
      passed: conformityCounts?.passed ?? 0,
      failed: conformityCounts?.failed ?? 0,
      pending: conformityCounts?.pending ?? 0,
    },
    incidents: {
      totalReported: incidentCounts?.total ?? 0,
      seriousIncidents: incidentCounts?.serious ?? 0,
      overdueNotifications: incidentCounts?.overdue ?? 0,
      averageTimeToNotifyHours: incidentCounts?.avgNotifyHours
        ? Math.round(Number(incidentCounts.avgNotifyHours))
        : null,
    },
    fria: {
      required: friaCounts?.required ?? 0,
      completed: friaCounts?.completed ?? 0,
      approved: friaCounts?.approved ?? 0,
    },
    qms: {
      avgMaturity,
      readyForCe,
      notReadyForCe,
    },
    gpai: {
      total: gpaiCounts?.total ?? 0,
      systemic: gpaiCounts?.systemic ?? 0,
    },
    correctiveActions: {
      open: caCounts?.open ?? 0,
      closed: caCounts?.closed ?? 0,
      overdue: caCounts?.overdue ?? 0,
    },
  };

  const report = computeAnnualReport(reportInput);

  return Response.json({
    data: {
      organization: { id: org.id, name: org.name },
      ...report,
      rawInput: reportInput,
    },
  });
}
