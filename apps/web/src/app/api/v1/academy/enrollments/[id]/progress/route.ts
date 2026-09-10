import { db, academyEnrollment } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateEnrollmentProgressSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PATCH /api/v1/academy/enrollments/:id/progress
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateEnrollmentProgressSchema.parse(await req.json());

  const [existing] = await db
    .select()
    .from(academyEnrollment)
    .where(
      and(eq(academyEnrollment.id, id), eq(academyEnrollment.orgId, ctx.orgId)),
    );
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const completedLessons = Array.isArray(existing.completedLessons)
    ? existing.completedLessons
    : [];
  if (!completedLessons.includes(body.lessonId)) {
    completedLessons.push(body.lessonId);
  }

  const isCompleted = body.progressPct === 100;
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(academyEnrollment)
      .set({
        progressPct: body.progressPct,
        completedLessons,
        lastLessonId: body.lessonId,
        status: isCompleted ? "completed" : "in_progress",
        startedAt: existing.startedAt ?? new Date(),
        completedAt: isCompleted ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(academyEnrollment.id, id))
      .returning();
    return updated;
  });

  return Response.json({ data: result });
});
