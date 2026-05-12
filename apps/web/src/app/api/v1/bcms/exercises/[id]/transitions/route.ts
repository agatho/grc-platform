import { db, bcExercise } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { EXERCISE_ALLOWED_TRANSITIONS } from "@grc/shared";
import type { ExerciseStatus } from "@grc/shared";

// #NIGHT-045: BCMS exercise transition discovery.
// Lifecycle: planned → preparation → executing → evaluation → completed
// (cancellable from any non-terminal state).
export const GET = withErrorHandler<{ params: Promise<{ id: string }> }>(
  async function GET(req: Request, { params }) {
    const ctx = await withAuth();
    if (ctx instanceof Response) return ctx;

    const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
    if (moduleCheck) return moduleCheck;

    const { id } = await params;

    const [row] = await db
      .select({ status: bcExercise.status })
      .from(bcExercise)
      .where(and(eq(bcExercise.id, id), eq(bcExercise.orgId, ctx.orgId)));

    if (!row) {
      return Response.json({ error: "Exercise not found" }, { status: 404 });
    }

    const current = row.status as ExerciseStatus;
    const allowed = EXERCISE_ALLOWED_TRANSITIONS[current] ?? [];

    return Response.json({
      data: {
        current,
        allowed,
        endpoint: `/api/v1/bcms/exercises/${id}`,
        method: "PUT",
        bodyShape: { status: "<target>" },
      },
    });
  },
);
