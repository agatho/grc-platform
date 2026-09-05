import { db, exportSchedule } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { updateExportScheduleSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/export/schedules/:id — Get single schedule
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [schedule] = await db
    .select()
    .from(exportSchedule)
    .where(and(eq(exportSchedule.id, id), eq(exportSchedule.orgId, ctx.orgId)));

  if (!schedule) {
    return Response.json({ error: "Schedule not found" }, { status: 404 });
  }

  return Response.json(schedule);
});
// PATCH /api/v1/export/schedules/:id — Update schedule
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const body = updateExportScheduleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select()
    .from(exportSchedule)
    .where(and(eq(exportSchedule.id, id), eq(exportSchedule.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Schedule not found" }, { status: 404 });
  }

  const [updated] = await withAuditContext(ctx, async (tx) => {
    return tx
      .update(exportSchedule)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(eq(exportSchedule.id, id))
      .returning();
  });

  return Response.json(updated);
});
// DELETE /api/v1/export/schedules/:id — Delete schedule
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [deleted] = await db
    .delete(exportSchedule)
    .where(and(eq(exportSchedule.id, id), eq(exportSchedule.orgId, ctx.orgId)))
    .returning();

  if (!deleted) {
    return Response.json({ error: "Schedule not found" }, { status: 404 });
  }

  return Response.json({ success: true });
});
