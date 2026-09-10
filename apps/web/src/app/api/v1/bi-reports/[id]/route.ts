import { db, biReport } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateBiReportSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bi-reports/:id
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const [row] = await db
    .select()
    .from(biReport)
    .where(and(eq(biReport.id, id), eq(biReport.orgId, ctx.orgId)));

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
});
// PATCH /api/v1/bi-reports/:id
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = updateBiReportSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(biReport)
      .set({ ...body, updatedBy: ctx.userId, updatedAt: new Date() })
      .where(and(eq(biReport.id, id), eq(biReport.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
});
// DELETE /api/v1/bi-reports/:id
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(biReport)
      .where(and(eq(biReport.id, id), eq(biReport.orgId, ctx.orgId)))
      .returning();
    return deleted;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id: result.id, deleted: true } });
});
