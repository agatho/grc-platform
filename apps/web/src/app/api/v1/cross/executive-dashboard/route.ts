// GET /api/v1/cross/executive-dashboard
//
// Epic 6.3: Composite GRC-Executive-Dashboard. Aggregiert Live-Metrics aus allen
// 4 Management-Systemen (ISMS, BCMS, DPMS, AI-Act) in eine Single-Pane-View mit
// Module-Health-Scores + Board-Briefing-Talking-Points + Top-3-Executive-Actions.

import {
  db,
  organization,
  assessmentRun,
  soaEntry,
  controlMaturity,
  finding,
  ismsNonconformity,
  biaAssessment,
  bcp,
  bcExercise,
  crisisScenario,
  ropaEntry,
  dpia,
  dsr,
  dataBreach,
  tia,
  consentRecord,
  aiSystem,
  aiProviderQms,
  aiFria,
  aiIncident,
  aiGpaiModel,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  computeExecutiveDashboard,
  assessQmsReadinessForCe,
  type ExecutiveDashboardInput,
  type QmsProcedureChecklist,
} from "@grc/shared";
import { and, eq, sql, isNull, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // Mindestens ISMS muss aktiv sein -- Dashboard ist fuer Management-System-Orgs.
  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));
  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const yearStartDate = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const yearStart = yearStartDate.toISOString();

  // ─── ISMS Metrics ────────────────────────────────────────
  const [ismsAssessments] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${assessmentRun.status} = 'completed')::int`,
    })
    .from(assessmentRun)
    .where(eq(assessmentRun.orgId, ctx.orgId));

  const [soaCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      implemented: sql<number>`count(*) filter (where ${soaEntry.implementation} = 'implemented')::int`,
    })
    .from(soaEntry)
    .where(eq(soaEntry.orgId, ctx.orgId));

  const [maturity] = await db
    .select({
      avg: sql<number | null>`avg(${controlMaturity.currentMaturity})`,
    })
    .from(controlMaturity)
    .where(eq(controlMaturity.orgId, ctx.orgId));

  const [findingCounts] = await db
    .select({
      open: sql<number>`count(*) filter (where ${finding.status} in ('identified','in_remediation'))::int`,
      critical: sql<number>`count(*) filter (where ${finding.severity} = 'significant_nonconformity' and ${finding.status} in ('identified','in_remediation'))::int`,
    })
    .from(finding)
    .where(and(eq(finding.orgId, ctx.orgId), isNull(finding.deletedAt)));

  const [capCounts] = await db
    .select({
      open: sql<number>`count(*) filter (where ${ismsNonconformity.status} not in ('closed'))::int`,
      overdue: sql<number>`count(*) filter (where ${ismsNonconformity.status} not in ('closed') and ${ismsNonconformity.dueDate} < current_date)::int`,
    })
    .from(ismsNonconformity)
    .where(eq(ismsNonconformity.orgId, ctx.orgId));

  const maturity0to100 = maturity?.avg
    ? Math.round(Number(maturity.avg) * 20)
    : 50; // 1-5 => 20-100

  // ─── BCMS Metrics ────────────────────────────────────────
  const [biaCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${biaAssessment.status} = 'approved')::int`,
    })
    .from(biaAssessment)
    .where(eq(biaAssessment.orgId, ctx.orgId));

  const [bcpCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${bcp.status} = 'published')::int`,
    })
    .from(bcp)
    .where(and(eq(bcp.orgId, ctx.orgId), isNull(bcp.deletedAt)));

  const yearStartIso = yearStartDate.toISOString().slice(0, 10);
  const [exerciseCounts] = await db
    .select({
      completedYtd: sql<number>`count(*) filter (where ${bcExercise.status} = 'completed' and ${bcExercise.actualDate} >= ${yearStartIso})::int`,
    })
    .from(bcExercise)
    .where(eq(bcExercise.orgId, ctx.orgId));

  const [crisisCounts] = await db
    .select({
      active: sql<number>`count(*) filter (where ${crisisScenario.status} = 'activated')::int`,
    })
    .from(crisisScenario)
    .where(eq(crisisScenario.orgId, ctx.orgId));

  // ─── DPMS Metrics ────────────────────────────────────────
  const [ropaCounts] = await db
    .select({
      active: sql<number>`count(*) filter (where ${ropaEntry.status} = 'active')::int`,
    })
    .from(ropaEntry)
    .where(eq(ropaEntry.orgId, ctx.orgId));

  const [dpiaCounts] = await db
    .select({
      approved: sql<number>`count(*) filter (where ${dpia.status} = 'approved')::int`,
      pending: sql<number>`count(*) filter (where ${dpia.status} in ('in_progress','pending_dpo_review'))::int`,
    })
    .from(dpia)
    .where(eq(dpia.orgId, ctx.orgId));

  const [dsrCounts] = await db
    .select({
      open: sql<number>`count(*) filter (where ${dsr.status} not in ('closed','rejected'))::int`,
      overdue: sql<number>`count(*) filter (where ${dsr.status} not in ('closed','rejected') and ${dsr.deadline} < now())::int`,
    })
    .from(dsr)
    .where(eq(dsr.orgId, ctx.orgId));

  const [breachCounts] = await db
    .select({
      ytd: sql<number>`count(*) filter (where ${dataBreach.detectedAt} >= ${yearStart})::int`,
      overdue: sql<number>`count(*) filter (where ${dataBreach.isDpaNotificationRequired} = true and ${dataBreach.dpaNotifiedAt} is null and ${dataBreach.detectedAt} < now() - interval '72 hours')::int`,
    })
    .from(dataBreach)
    .where(and(eq(dataBreach.orgId, ctx.orgId), isNull(dataBreach.deletedAt)));

  const [tiaCounts] = await db
    .select({
      reviewed: sql<number>`count(*) filter (where ${tia.assessmentDate} is not null)::int`,
    })
    .from(tia)
    .where(and(eq(tia.orgId, ctx.orgId), isNull(tia.deletedAt)));

  const [consentCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      valid: sql<number>`count(*) filter (where ${consentRecord.withdrawnAt} is null)::int`,
    })
    .from(consentRecord)
    .where(eq(consentRecord.orgId, ctx.orgId));

  // ─── AI-Act Metrics ──────────────────────────────────────
  const [aiSysCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      highRisk: sql<number>`count(*) filter (where ${aiSystem.riskClassification} = 'high')::int`,
      unacceptable: sql<number>`count(*) filter (where ${aiSystem.riskClassification} = 'unacceptable')::int`,
      compliant: sql<number>`count(*) filter (where ${aiSystem.status} = 'compliant')::int`,
    })
    .from(aiSystem)
    .where(and(eq(aiSystem.orgId, ctx.orgId), isNull(aiSystem.deletedAt)));

  const qmsRows = await db
    .select()
    .from(aiProviderQms)
    .where(eq(aiProviderQms.orgId, ctx.orgId));
  let totalMaturity = 0;
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
    totalMaturity += assessQmsReadinessForCe(checklist).maturityScore;
  }
  const qmsAverageMaturity =
    qmsRows.length > 0 ? Math.round(totalMaturity / qmsRows.length) : 0;

  const [friaCounts] = await db
    .select({
      required: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${aiFria.status} in ('completed','approved'))::int`,
    })
    .from(aiFria)
    .where(eq(aiFria.orgId, ctx.orgId));

  const [aiIncOverdue] = await db
    .select({
      overdue: sql<number>`count(*) filter (where ${aiIncident.authorityDeadline} < now() and ${aiIncident.authorityNotifiedAt} is null)::int`,
    })
    .from(aiIncident)
    .where(eq(aiIncident.orgId, ctx.orgId));

  const [gpaiSystemic] = await db
    .select({
      systemic: sql<number>`count(*) filter (where ${aiGpaiModel.modelType} = 'systemic')::int`,
    })
    .from(aiGpaiModel)
    .where(eq(aiGpaiModel.orgId, ctx.orgId));

  // ─── Compose Input ───────────────────────────────────────
  const dashboardInput: ExecutiveDashboardInput = {
    isms: {
      assessmentsTotal: ismsAssessments?.total ?? 0,
      assessmentsCompleted: ismsAssessments?.completed ?? 0,
      soaCoveragePercent:
        (soaCounts?.total ?? 0) > 0
          ? Math.round(
              ((soaCounts?.implemented ?? 0) / (soaCounts?.total ?? 1)) * 100,
            )
          : 0,
      openFindingsCount: findingCounts?.open ?? 0,
      criticalFindingsCount: findingCounts?.critical ?? 0,
      maturityAverage: maturity0to100,
      capOpenCount: capCounts?.open ?? 0,
      capOverdueCount: capCounts?.overdue ?? 0,
    },
    bcms: {
      biaCompletedCount: biaCounts?.completed ?? 0,
      biaTotalCount: biaCounts?.total ?? 0,
      bcpPublishedCount: bcpCounts?.published ?? 0,
      bcpTotalCount: bcpCounts?.total ?? 0,
      exercisesCompletedYtd: exerciseCounts?.completedYtd ?? 0,
      activeCrisisCount: crisisCounts?.active ?? 0,
      rtoCoveragePercent: 75, // Platzhalter -- Computation in spaeter Iteration
    },
    dpms: {
      ropaActiveCount: ropaCounts?.active ?? 0,
      dpiaApprovedCount: dpiaCounts?.approved ?? 0,
      dpiaPendingCount: dpiaCounts?.pending ?? 0,
      dsrOpenCount: dsrCounts?.open ?? 0,
      dsrOverdueCount: dsrCounts?.overdue ?? 0,
      breachesYtd: breachCounts?.ytd ?? 0,
      breachesOverdueNotifications: breachCounts?.overdue ?? 0,
      tiaReviewedCount: tiaCounts?.reviewed ?? 0,
      consentValidPercent:
        (consentCounts?.total ?? 0) > 0
          ? Math.round(
              ((consentCounts?.valid ?? 0) / (consentCounts?.total ?? 1)) * 100,
            )
          : 100,
    },
    aiAct: {
      systemsTotal: aiSysCounts?.total ?? 0,
      systemsHighRisk: aiSysCounts?.highRisk ?? 0,
      systemsUnacceptable: aiSysCounts?.unacceptable ?? 0,
      systemsCompliant: aiSysCounts?.compliant ?? 0,
      qmsAverageMaturity,
      friaRequired: friaCounts?.required ?? 0,
      friaCompleted: friaCounts?.completed ?? 0,
      incidentsOverdueCount: aiIncOverdue?.overdue ?? 0,
      gpaiSystemicCount: gpaiSystemic?.systemic ?? 0,
    },
    asOfDate: new Date().toISOString().slice(0, 10),
    organizationName: org.name,
  };

  void gte;
  const result = computeExecutiveDashboard(dashboardInput);

  return Response.json({
    data: {
      ...result,
      rawInput: dashboardInput,
    },
  });
}
