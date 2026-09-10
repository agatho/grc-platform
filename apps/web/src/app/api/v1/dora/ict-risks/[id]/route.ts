import { db, doraIctRisk } from "@grc/db";
import { updateDoraIctRiskSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/dora/ict-risks/:id
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("erm", ctx.orgId, req.method);
  if (m) return m;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(doraIctRisk)
    .where(
      and(
        eq(doraIctRisk.id, id),
        eq(doraIctRisk.orgId, ctx.orgId),
        isNull(doraIctRisk.deletedAt),
      ),
    );

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
});
// PATCH /api/v1/dora/ict-risks/:id
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("erm", ctx.orgId, req.method);
  if (m) return m;
  const { id } = await params;

  const body = updateDoraIctRiskSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(doraIctRisk)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(doraIctRisk.id, id), eq(doraIctRisk.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
});
// DELETE /api/v1/dora/ict-risks/:id (soft delete)
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("erm", ctx.orgId, req.method);
  if (m) return m;
  const { id } = await params;

  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .update(doraIctRisk)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(doraIctRisk.id, id), eq(doraIctRisk.orgId, ctx.orgId)))
      .returning();
    return deleted;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id } });
});
