// POST /api/v1/isms/assessments/[id]/finalize
//
// Sprint 1.5: Finalize-Endpoint. Orchestriert den Abschluss eines
// Assessment-Runs:
//   1. Gate-Checks (G4 hart, G3 hart)
//   2. Auto-Generation von findings aus ineffective + partially_effective Evals
//   3. Snapshot-Erzeugung im Run (completionPercentage=100, completedAt)
//   4. Transition auf status='review' (nicht 'completed' -- das triggert
//      erst nach Management-Review)
//
// Returns: { runId, status, findingsCreated, blockers[], summary }

import {
  db,
  assessmentRun,
  assessmentControlEval,
  finding,
  control,
  catalogEntry,
  soaEntry,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, inArray, sql } from "drizzle-orm";
import { validateGate4Coverage, type AssessmentSnapshot } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteParams) {
  const { id: runId } = await params;
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "POST");
  if (moduleCheck) return moduleCheck;

  // Run laden
  const [run] = await db
    .select()
    .from(assessmentRun)
    .where(and(eq(assessmentRun.id, runId), eq(assessmentRun.orgId, ctx.orgId)));
  if (!run) {
    return Response.json({ error: "Assessment run not found" }, { status: 404 });
  }
  if (run.status !== "in_progress") {
    return Response.json(
      { error: `Run status must be 'in_progress' to finalize (ist: '${run.status}')` },
      { status: 422 },
    );
  }

  // Gate G4 hart
  const snapshot: AssessmentSnapshot = {
    status: run.status,
    completionPercentage: run.completionPercentage,
    name: run.name,
    description: run.description,
    scopeType: run.scopeType,
    scopeFilter: run.scopeFilter as Record<string, unknown> | null,
    framework: run.framework,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    leadAssessorId: run.leadAssessorId,
    totalEvaluations: run.totalEvaluations,
    completedEvaluations: run.completedEvaluations,
  };
  const g4Blockers = validateGate4Coverage(snapshot);
  const hardG4 = g4Blockers.filter((b) => b.severity === "error");
  if (hardG4.length > 0) {
    return Response.json(
      {
        blocked: true,
        gate: "G4",
        blockers: g4Blockers,
      },
      { status: 422 },
    );
  }

  // Ineffective + partially_effective Evals sammeln
  const badEvals = await db
    .select({
      id: assessmentControlEval.id,
      controlId: assessmentControlEval.controlId,
      assetId: assessmentControlEval.assetId,
      result: assessmentControlEval.result,
      notes: assessmentControlEval.notes,
      evidence: assessmentControlEval.evidence,
    })
    .from(assessmentControlEval)
    .where(
      and(
        eq(assessmentControlEval.assessmentRunId, runId),
        eq(assessmentControlEval.orgId, ctx.orgId),
        inArray(assessmentControlEval.result, ["ineffective", "partially_effective"]),
      ),
    );

  // Bestehende Findings auf diese Control-IDs (in Run-Period) dedupen
  const controlIds = badEvals.map((e) => e.controlId);
  let existingFindings: Array<{ controlId: string | null }> = [];
  if (controlIds.length > 0) {
    existingFindings = await db
      .select({ controlId: finding.controlId })
      .from(finding)
      .where(
        and(
          eq(finding.orgId, ctx.orgId),
          inArray(finding.controlId, controlIds),
          eq(finding.source, "self_assessment"),
          sql`${finding.deletedAt} IS NULL`,
          sql`${finding.createdAt} >= ${run.periodStart}`,
          // Findings dieser Run-Period
        ),
      );
  }
  const existingSet = new Set(
    existingFindings.map((f) => f.controlId).filter((id): id is string => id !== null),
  );

  const newFindings = badEvals.filter((e) => !existingSet.has(e.controlId));

  // Control-Namen fuer Finding-Titles laden
  const controlRows = newFindings.length > 0
    ? await db
        .select({
          id: control.id,
          title: control.title,
          catalogEntryId: control.catalogEntryId,
        })
        .from(control)
        .where(inArray(control.id, newFindings.map((e) => e.controlId)))
    : [];
  const controlById = new Map(controlRows.map((c) => [c.id, c]));

  let findingsCreated = 0;

  if (newFindings.length > 0) {
    await withAuditContext(ctx, async (tx) => {
      const CHUNK = 100;
      for (let i = 0; i < newFindings.length; i += CHUNK) {
        const chunk = newFindings.slice(i, i + CHUNK);
        await tx.insert(finding).values(
          chunk.map((e) => {
            const c = controlById.get(e.controlId);
            const controlTitle = c?.title ?? "Unknown Control";
            const severity =
              e.result === "ineffective"
                ? "significant_nonconformity" as const
                : "improvement_requirement" as const;
            return {
              orgId: ctx.orgId,
              controlId: e.controlId,
              title: `[ISMS-Assessment] ${controlTitle}: ${e.result === "ineffective" ? "Ineffective" : "Partially Effective"}`,
              description: e.notes ?? "Finding automatisch aus ISMS-Assessment-Eval generiert.",
              severity,
              status: "identified" as const,
              source: "self_assessment" as const,
              createdBy: ctx.userId,
            };
          }),
        );
        findingsCreated += chunk.length;
      }
    });
  }

  // Transition auf status='review' + Snapshot-Markers
  const [updated] = await withAuditContext(ctx, async (tx) => {
    return tx
      .update(assessmentRun)
      .set({
        status: "review",
        updatedAt: new Date(),
      })
      .where(and(eq(assessmentRun.id, runId), eq(assessmentRun.orgId, ctx.orgId)))
      .returning();
  });

  // Summary-Aggregate
  const resultCounts: Record<string, number> = {};
  const allEvals = await db
    .select({ result: assessmentControlEval.result })
    .from(assessmentControlEval)
    .where(
      and(
        eq(assessmentControlEval.assessmentRunId, runId),
        eq(assessmentControlEval.orgId, ctx.orgId),
      ),
    );
  for (const e of allEvals) {
    resultCounts[e.result] = (resultCounts[e.result] ?? 0) + 1;
  }

  // Framework-Coverage (pro Framework: % effective)
  const frameworkCoverage: Record<string, { total: number; effective: number; percentage: number }> = {};
  if (run.framework) {
    const frameworks = run.framework.split(",").map((f) => f.trim());
    for (const fw of frameworks) {
      const evalsForFw = await db
        .select({
          result: assessmentControlEval.result,
        })
        .from(assessmentControlEval)
        .innerJoin(control, eq(control.id, assessmentControlEval.controlId))
        .innerJoin(catalogEntry, eq(catalogEntry.id, control.catalogEntryId))
        .where(
          and(
            eq(assessmentControlEval.assessmentRunId, runId),
            eq(assessmentControlEval.orgId, ctx.orgId),
            sql`${catalogEntry.code} IS NOT NULL`,
          ),
        );
      const effective = evalsForFw.filter((e) => e.result === "effective").length;
      frameworkCoverage[fw] = {
        total: evalsForFw.length,
        effective,
        percentage: evalsForFw.length > 0 ? Math.round((effective / evalsForFw.length) * 100) : 0,
      };
    }
  }

  return Response.json({
    data: {
      runId: updated.id,
      status: updated.status,
      previousStatus: "in_progress",
      findingsCreated,
      findingsSkippedAsDuplicate: badEvals.length - newFindings.length,
      summary: {
        totalEvaluations: allEvals.length,
        resultDistribution: resultCounts,
        frameworkCoverage,
      },
      nextSteps: [
        {
          step: "management_review",
          label: "Management-Review abhalten (ISO 27001 Clause 9.3)",
          endpoint: `/api/v1/isms/reviews`,
        },
        {
          step: "transition_completed",
          label: "Nach Review-Abschluss: Transition auf 'completed'",
          endpoint: `/api/v1/isms/assessments/${runId}/transition`,
        },
      ],
    },
  });
}
