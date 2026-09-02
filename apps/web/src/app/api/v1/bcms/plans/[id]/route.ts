import { db, bcp } from "@grc/db";
import { updateBcpSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bcms/plans/[id]
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
    .from(bcp)
    .where(
      and(eq(bcp.id, id), eq(bcp.orgId, ctx.orgId), isNull(bcp.deletedAt)),
    );

  if (!row) {
    return Response.json({ error: "BCP not found" }, { status: 404 });
  }

  return Response.json({ data: row });
});
// PUT /api/v1/bcms/plans/[id]
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = updateBcpSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(bcp)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(eq(bcp.id, id), eq(bcp.orgId, ctx.orgId), isNull(bcp.deletedAt)),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "BCP not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
});
// DELETE /api/v1/bcms/plans/[id] — Soft delete
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
      .update(bcp)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(bcp.id, id), eq(bcp.orgId, ctx.orgId), isNull(bcp.deletedAt)),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "BCP not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deleted: true } });
});
