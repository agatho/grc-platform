// GET /api/v1/bcms/exercises/[id]/report
//
// Sprint 2.3: Post-Exercise-Report-Generator.
// Aggregiert Exercise-Meta + Findings + Lessons + Objective-Results.

import {
  db,
  bcExercise,
  bcExerciseFinding,
  bcp,
  crisisScenario,
  user,
  organization,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [row] = await db
    .select({
      exercise: bcExercise,
      orgName: organization.name,
      bcpTitle: bcp.title,
      scenarioName: crisisScenario.name,
    })
    .from(bcExercise)
    .innerJoin(organization, eq(organization.id, bcExercise.orgId))
    .leftJoin(bcp, eq(bcp.id, bcExercise.bcpId))
    .leftJoin(crisisScenario, eq(crisisScenario.id, bcExercise.crisisScenarioId))
    .where(and(eq(bcExercise.id, id), eq(bcExercise.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Exercise not found" }, { status: 404 });
  }

  const findings = await db
    .select()
    .from(bcExerciseFinding)
    .where(eq(bcExerciseFinding.exerciseId, id));

  // Lead-User-Info laden (falls assigned)
  let leadUser: { id: string; name: string | null; email: string } | null = null;
  if (row.exercise.exerciseLeadId) {
    const [u] = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, row.exercise.exerciseLeadId));
    leadUser = u ?? null;
  }

  // Objective-Aggregat
  const objectives = Array.isArray(row.exercise.objectives) ? row.exercise.objectives : [];
  type Objective = { title?: string; achieved?: string; [k: string]: unknown };
  const objAchievedCount = (objectives as Objective[]).filter(
    (o) => o.achieved === "achieved",
  ).length;
  const objPartialCount = (objectives as Objective[]).filter(
    (o) => o.achieved === "partially_achieved",
  ).length;
  const objNotAchievedCount = (objectives as Objective[]).filter(
    (o) => o.achieved === "not_achieved",
  ).length;

  // Severity-Distribution
  const severityDistribution: Record<string, number> = {};
  for (const f of findings) {
    severityDistribution[f.severity] = (severityDistribution[f.severity] ?? 0) + 1;
  }

  // RTO-Adherence (wenn rtoTargetHours + rtoActualHours in objectives / metadata)
  // Nicht Schema-mandatiert; als Platzhalter
  const rtoAdherence: { target: number | null; actual: number | null; gap: number | null } = {
    target: null,
    actual: null,
    gap: null,
  };

  return Response.json({
    data: {
      generatedAt: new Date().toISOString(),
      exercise: {
        id: row.exercise.id,
        title: row.exercise.title,
        type: row.exercise.exerciseType,
        status: row.exercise.status,
        description: row.exercise.description,
        overallResult: row.exercise.overallResult,
        plannedDate: row.exercise.plannedDate,
        actualDate: row.exercise.actualDate,
        plannedDurationHours: row.exercise.plannedDurationHours,
        actualDurationHours: row.exercise.actualDurationHours,
        completedAt: row.exercise.completedAt,
        lessonsLearned: row.exercise.lessonsLearned,
      },
      context: {
        org: { id: row.exercise.orgId, name: row.orgName },
        bcp: row.bcpTitle ? { id: row.exercise.bcpId, title: row.bcpTitle } : null,
        scenario: row.scenarioName
          ? { id: row.exercise.crisisScenarioId, name: row.scenarioName }
          : null,
      },
      team: {
        lead: leadUser,
        participantIds: row.exercise.participantIds ?? [],
        observerIds: row.exercise.observerIds ?? [],
      },
      objectives,
      objectiveStats: {
        total: (objectives as Objective[]).length,
        achieved: objAchievedCount,
        partiallyAchieved: objPartialCount,
        notAchieved: objNotAchievedCount,
      },
      findings: findings.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        severity: f.severity,
        recommendation: f.recommendation,
      })),
      findingStats: {
        total: findings.length,
        severityDistribution,
      },
      rtoAdherence,
    },
  });
}
