import { db, bcExercise } from "@grc/db";
import { updateBcExerciseSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

type IdCtx = { params: Promise<{ id: string }> };

// GET /api/v1/bcms/exercises/[id]
export const GET = withErrorHandler<IdCtx>(async function GET(
  req: Request,
  { params }: IdCtx,
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select()
    .from(bcExercise)
    .where(and(eq(bcExercise.id, id), eq(bcExercise.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Exercise not found" }, { status: 404 });
  }

  return Response.json({ data: row });
});

// PUT /api/v1/bcms/exercises/[id]
export const PUT = withErrorHandler<IdCtx>(async function PUT(
  req: Request,
  { params }: IdCtx,
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = updateBcExerciseSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(bcExercise)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(bcExercise.id, id), eq(bcExercise.orgId, ctx.orgId)))
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Exercise not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
});
