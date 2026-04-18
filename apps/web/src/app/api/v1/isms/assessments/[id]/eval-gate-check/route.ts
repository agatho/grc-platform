// GET /api/v1/isms/assessments/[id]/eval-gate-check
//
// Sprint 1.4 Gate-G4-Check. Live-Stats aus assessment_control_eval-Zahlen.

import { db, assessmentRun } from "@grc/db";
import { requireModule } from "@grc/auth";
import { validateGate4Coverage, type AssessmentSnapshot } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [run] = await db
    .select()
    .from(assessmentRun)
    .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)));
  if (!run) {
    return Response.json({ error: "Assessment run not found" }, { status: 404 });
  }

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

  const blockers = validateGate4Coverage(snapshot);
  const coverage =
    snapshot.totalEvaluations > 0
      ? Math.round((snapshot.completedEvaluations / snapshot.totalEvaluations) * 100)
      : 0;

  return Response.json({
    data: {
      assessmentRunId: run.id,
      stats: {
        totalEvaluations: snapshot.totalEvaluations,
        completedEvaluations: snapshot.completedEvaluations,
      },
      coverage,
      blockers,
      passed: blockers.filter((b) => b.severity === "error").length === 0,
    },
  });
}
