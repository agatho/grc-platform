// GET /api/v1/bcms/exercises/[id]/gate-check
//
// Sprint 2.3: Live-Status fuer Exercise-Gates B7 + B8.

import { db, bcExercise, bcExerciseFinding } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateExerciseGate7Execute,
  validateExerciseGate8Close,
  type ExerciseSnapshot,
} from "@grc/shared";
import { and, eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [exercise] = await db
    .select()
    .from(bcExercise)
    .where(and(eq(bcExercise.id, id), eq(bcExercise.orgId, ctx.orgId)));
  if (!exercise) {
    return Response.json({ error: "Exercise not found" }, { status: 404 });
  }

  const [{ findingsCount }] = await db
    .select({ findingsCount: sql<number>`count(*)::int` })
    .from(bcExerciseFinding)
    .where(eq(bcExerciseFinding.exerciseId, id));

  const lessonsLearnedCount =
    exercise.lessonsLearned && exercise.lessonsLearned.trim().length > 0
      ? 1
      : 0;

  const snapshot: ExerciseSnapshot = {
    status: exercise.status,
    title: exercise.title,
    exerciseType: exercise.exerciseType,
    plannedDate: exercise.plannedDate,
    exerciseLeadId: exercise.exerciseLeadId,
    participantIds: exercise.participantIds as string[] | null,
    bcpId: exercise.bcpId,
    crisisScenarioId: exercise.crisisScenarioId,
    objectives: exercise.objectives,
    overallResult: exercise.overallResult,
    findingsCount: findingsCount ?? 0,
    lessonsLearnedCount,
  };

  const b7 = validateExerciseGate7Execute(snapshot);
  const b8 = validateExerciseGate8Close(snapshot);

  return Response.json({
    data: {
      exerciseId: exercise.id,
      status: exercise.status,
      snapshot,
      b7: {
        passed: b7.filter((b) => b.severity === "error").length === 0,
        blockers: b7,
      },
      b8: {
        passed: b8.filter((b) => b.severity === "error").length === 0,
        blockers: b8,
      },
    },
  });
}
