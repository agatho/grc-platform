import { db, continuityStrategy } from "@grc/db";
import { updateContinuityStrategySchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bcms/strategies/[id]
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select()
    .from(continuityStrategy)
    .where(
      and(
        eq(continuityStrategy.id, id),
        eq(continuityStrategy.orgId, ctx.orgId),
      ),
    );

  if (!row) {
    return Response.json({ error: "Strategy not found" }, { status: 404 });
  }

  return Response.json({ data: row });
});
// PUT /api/v1/bcms/strategies/[id]
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = updateContinuityStrategySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updateData: Record<string, unknown> = {
    ...body.data,
    updatedAt: new Date(),
  };
  if (body.data.estimatedCostEur !== undefined) {
    updateData.estimatedCostEur = body.data.estimatedCostEur?.toString();
  }
  if (body.data.annualCostEur !== undefined) {
    updateData.annualCostEur = body.data.annualCostEur?.toString();
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(continuityStrategy)
      .set(updateData)
      .where(
        and(
          eq(continuityStrategy.id, id),
          eq(continuityStrategy.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Strategy not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
});
// DELETE /api/v1/bcms/strategies/[id]
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(continuityStrategy)
      .where(
        and(
          eq(continuityStrategy.id, id),
          eq(continuityStrategy.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Strategy not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deleted: true } });
});
