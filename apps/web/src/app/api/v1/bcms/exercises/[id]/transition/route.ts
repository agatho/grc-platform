// POST /api/v1/bcms/exercises/[id]/transition
//
// Sprint 2.3: Exercise-Status-Transitions mit Gate B7/B8.

import { db, bcExercise, bcExerciseFinding } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateExerciseTransition,
  type ExerciseSnapshot,
  type ExerciseStatus,
} from "@grc/shared";
import { and, eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  targetStatus: z.enum([
    "planned",
    "preparation",
    "executing",
    "evaluation",
    "completed",
    "cancelled",
  ]),
  forceCloseWithoutFindings: z.boolean().default(false),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const [exercise] = await db
    .select()
    .from(bcExercise)
    .where(and(eq(bcExercise.id, id), eq(bcExercise.orgId, ctx.orgId)));
  if (!exercise) {
    return Response.json({ error: "Exercise not found" }, { status: 404 });
  }

  // Findings + Lessons counts
  const [{ findingsCount }] = await db
    .select({ findingsCount: sql<number>`count(*)::int` })
    .from(bcExerciseFinding)
    .where(eq(bcExerciseFinding.exerciseId, id));

  // lessonsLearnedCount: bc_exercise.lessonsLearned Text-Feld, oder 0 wenn leer
  const lessonsLearnedCount = exercise.lessonsLearned && exercise.lessonsLearned.trim().length > 0 ? 1 : 0;

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

  const validation = validateExerciseTransition({
    currentStatus: exercise.status as ExerciseStatus,
    targetStatus: parsed.data.targetStatus,
    snapshot,
    forceCloseWithoutFindings: parsed.data.forceCloseWithoutFindings,
  });

  if (!validation.allowed) {
    return Response.json(
      {
        blocked: true,
        currentStatus: exercise.status,
        targetStatus: parsed.data.targetStatus,
        blockers: validation.blockers,
      },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = {
      status: parsed.data.targetStatus,
      updatedAt: new Date(),
    };
    if (parsed.data.targetStatus === "executing") {
      updates.actualDate = new Date().toISOString().split("T")[0];
    }
    if (parsed.data.targetStatus === "completed") {
      updates.completedAt = new Date();
    }

    const [updated] = await tx
      .update(bcExercise)
      .set(updates)
      .where(and(eq(bcExercise.id, id), eq(bcExercise.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  return Response.json({
    data: result,
    previousStatus: exercise.status,
    blockers: validation.blockers,
  });
}
