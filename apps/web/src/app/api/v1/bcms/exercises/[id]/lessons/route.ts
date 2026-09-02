import { db, bcExerciseLesson, bcExercise, task } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createExerciseLessonSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bcms/exercises/:id/lessons — List lessons for exercise
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const lessons = await db
    .select()
    .from(bcExerciseLesson)
    .where(
      and(
        eq(bcExerciseLesson.exerciseId, id),
        eq(bcExerciseLesson.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: lessons });
});
// POST /api/v1/bcms/exercises/:id/lessons — Create lesson
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = createExerciseLessonSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify exercise exists and belongs to org
  const [exercise] = await db
    .select()
    .from(bcExercise)
    .where(and(eq(bcExercise.id, id), eq(bcExercise.orgId, ctx.orgId)));
  if (!exercise)
    return Response.json({ error: "Exercise not found" }, { status: 404 });

  const created = await withAuditContext(ctx, async (tx) => {
    const [lesson] = await tx
      .insert(bcExerciseLesson)
      .values({
        exerciseId: id,
        orgId: ctx.orgId,
        ...body.data,
      })
      .returning();
    return lesson;
  });

  return Response.json({ data: created }, { status: 201 });
});
