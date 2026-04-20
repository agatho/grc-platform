import { db, bcExercise } from "@grc/db";
import { completeExerciseSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/bcms/exercises/[id]/complete — Complete an exercise
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = completeExerciseSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [current] = await db
    .select()
    .from(bcExercise)
    .where(and(eq(bcExercise.id, id), eq(bcExercise.orgId, ctx.orgId)));

  if (!current) {
    return Response.json({ error: "Exercise not found" }, { status: 404 });
  }

  if (current.status === "completed" || current.status === "cancelled") {
    return Response.json(
      {
        error: `Exercise is already '${current.status}' and cannot be completed.`,
      },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(bcExercise)
      .set({
        status: "completed",
        actualDate: body.data.actualDate,
        actualDurationHours: body.data.actualDurationHours,
        overallResult: body.data.overallResult,
        lessonsLearned: body.data.lessonsLearned,
        objectives: body.data.objectives,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bcExercise.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
