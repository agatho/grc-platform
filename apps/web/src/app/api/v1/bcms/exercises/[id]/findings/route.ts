import { db, bcExerciseFinding, bcExercise } from "@grc/db";
import { createExerciseFindingSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/bcms/exercises/[id]/findings — Add finding
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: exerciseId } = await params;

  const body = createExerciseFindingSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify exercise exists
  const [exercise] = await db
    .select({ id: bcExercise.id })
    .from(bcExercise)
    .where(and(eq(bcExercise.id, exerciseId), eq(bcExercise.orgId, ctx.orgId)));

  if (!exercise) {
    return Response.json({ error: "Exercise not found" }, { status: 404 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(bcExerciseFinding)
      .values({
        exerciseId,
        orgId: ctx.orgId,
        title: body.data.title,
        description: body.data.description,
        severity: body.data.severity,
        recommendation: body.data.recommendation,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
// GET /api/v1/bcms/exercises/[id]/findings — List findings
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: exerciseId } = await params;
  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(bcExerciseFinding.exerciseId, exerciseId),
    eq(bcExerciseFinding.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(bcExerciseFinding)
      .where(where)
      .orderBy(desc(bcExerciseFinding.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(bcExerciseFinding).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
