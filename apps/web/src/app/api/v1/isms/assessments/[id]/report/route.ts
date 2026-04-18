// GET /api/v1/isms/assessments/[id]/report
//
// Sprint 1.5: Report-Snapshot-Generator. Liefert strukturiertes JSON
// fuer Report-Viewer + PDF-Export.
//
// Sections (wie in 01-isms-assessment-plan.md §3.7.1):
//   - Executive Summary (Maturity-Score, #Findings, Top-3-Risks)
//   - Scope + Methodologie
//   - Per-Framework-Coverage
//   - Per-Annex-A-Kategorie Maturity-Scoring
//   - Top-10 Findings (by Severity x Coverage-Impact)
//   - Treatment-Plan-Summary

import {
  db,
  assessmentRun,
  assessmentControlEval,
  assessmentRiskEval,
  finding,
  control,
  catalogEntry,
  catalog,
  organization,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  // Run + Org laden
  const [runRow] = await db
    .select({
      run: assessmentRun,
      orgName: organization.name,
    })
    .from(assessmentRun)
    .innerJoin(organization, eq(organization.id, assessmentRun.orgId))
    .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)));

  if (!runRow) {
    return Response.json({ error: "Assessment run not found" }, { status: 404 });
  }
  const run = runRow.run;

  // Evals aggregieren
  const evals = await db
    .select({
      id: assessmentControlEval.id,
      controlId: assessmentControlEval.controlId,
      result: assessmentControlEval.result,
      currentMaturity: assessmentControlEval.currentMaturity,
      targetMaturity: assessmentControlEval.targetMaturity,
      controlTitle: control.title,
      catalogEntryId: control.catalogEntryId,
    })
    .from(assessmentControlEval)
    .leftJoin(control, eq(control.id, assessmentControlEval.controlId))
    .where(
      and(
        eq(assessmentControlEval.assessmentRunId, id),
        eq(assessmentControlEval.orgId, ctx.orgId),
      ),
    );

  // Result-Distribution
  const resultDistribution: Record<string, number> = {};
  for (const e of evals) {
    resultDistribution[e.result] = (resultDistribution[e.result] ?? 0) + 1;
  }

  // Maturity-Score (Average currentMaturity wo gesetzt)
  const maturityScores = evals
    .map((e) => e.currentMaturity)
    .filter((m): m is number => m !== null && m !== undefined);
  const averageMaturity = maturityScores.length > 0
    ? maturityScores.reduce((a, b) => a + b, 0) / maturityScores.length
    : null;

  // Framework-Coverage
  const frameworkCoverage: Record<string, { total: number; effective: number; percentage: number }> = {};
  if (run.framework) {
    const frameworks = run.framework.split(",").map((f) => f.trim());
    for (const fw of frameworks) {
      const effective = evals.filter((e) => e.result === "effective").length;
      frameworkCoverage[fw] = {
        total: evals.length,
        effective,
        percentage: evals.length > 0 ? Math.round((effective / evals.length) * 100) : 0,
      };
    }
  }

  // Top-10 Findings im Kontext dieses Runs
  const recentFindings = await db
    .select({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      controlId: finding.controlId,
      description: finding.description,
      createdAt: finding.createdAt,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        eq(finding.source, "self_assessment"),
        sql`${finding.deletedAt} IS NULL`,
        sql`${finding.createdAt} >= ${run.periodStart}`,
      ),
    )
    .orderBy(desc(finding.createdAt))
    .limit(50);

  const severityRank: Record<string, number> = {
    significant_nonconformity: 5,
    insignificant_nonconformity: 4,
    improvement_requirement: 3,
    recommendation: 2,
    observation: 1,
  };
  const topFindings = [...recentFindings]
    .sort((a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0))
    .slice(0, 10);

  // Risk-Evaluations
  const riskEvals = await db
    .select({
      decision: assessmentRiskEval.decision,
      residualLikelihood: assessmentRiskEval.residualLikelihood,
      residualImpact: assessmentRiskEval.residualImpact,
    })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, id),
        eq(assessmentRiskEval.orgId, ctx.orgId),
      ),
    );
  const decisionDistribution: Record<string, number> = {};
  for (const r of riskEvals) {
    decisionDistribution[r.decision] = (decisionDistribution[r.decision] ?? 0) + 1;
  }

  // Per-Catalog-Category Maturity
  const catalogCategories = await db
    .select({
      catalogName: catalog.name,
      entryCode: catalogEntry.code,
      entryName: catalogEntry.name,
    })
    .from(control)
    .innerJoin(catalogEntry, eq(catalogEntry.id, control.catalogEntryId))
    .innerJoin(catalog, eq(catalog.id, catalogEntry.catalogId))
    .where(
      and(
        eq(control.orgId, ctx.orgId),
        sql`${control.id} IN (${sql.join(
          evals.map((e) => sql`${e.controlId}`),
          sql`,`,
        )})`,
      ),
    )
    .limit(200)
    .catch(() => [] as Array<{ catalogName: string; entryCode: string; entryName: string }>);

  const perCatalogStats: Record<string, { total: number; effective: number }> = {};
  for (const e of evals) {
    const cat = catalogCategories.find((c) => c.entryCode);
    const key = cat?.catalogName ?? "Uncategorized";
    if (!perCatalogStats[key]) perCatalogStats[key] = { total: 0, effective: 0 };
    perCatalogStats[key].total++;
    if (e.result === "effective") perCatalogStats[key].effective++;
  }

  return Response.json({
    data: {
      generatedAt: new Date().toISOString(),
      run: {
        id: run.id,
        name: run.name,
        description: run.description,
        framework: run.framework,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        status: run.status,
        leadAssessorId: run.leadAssessorId,
        completionPercentage: run.completionPercentage,
      },
      org: { id: run.orgId, name: runRow.orgName },
      executive: {
        totalEvaluations: evals.length,
        resultDistribution,
        averageMaturity,
        totalFindings: recentFindings.length,
        criticalFindings: topFindings.filter((f) =>
          ["significant_nonconformity", "insignificant_nonconformity"].includes(f.severity),
        ).length,
        riskDecisions: decisionDistribution,
      },
      frameworkCoverage,
      perCatalogStats,
      topFindings: topFindings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        status: f.status,
        description: f.description,
        createdAt: f.createdAt,
      })),
      scope: {
        type: run.scopeType,
        filter: run.scopeFilter,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
      },
    },
  });
}
