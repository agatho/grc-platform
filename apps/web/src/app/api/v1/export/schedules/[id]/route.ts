import { db, exportSchedule } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { updateExportScheduleSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/export/schedules/:id — Get single schedule
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [schedule] = await db
    .select()
    .from(exportSchedule)
    .where(
      and(eq(exportSchedule.id, id), eq(exportSchedule.orgId, ctx.orgId)),
    );

  if (!schedule) {
    return Response.json({ error: "Schedule not found" }, { status: 404 });
  }

  return Response.json(schedule);
}

// PATCH /api/v1/export/schedules/:id — Update schedule
export async function PATCH(
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
    .where(
      and(eq(exportSchedule.id, id), eq(exportSchedule.orgId, ctx.orgId)),
    );

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
}

// DELETE /api/v1/export/schedules/:id — Delete schedule
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [deleted] = await db
    .delete(exportSchedule)
    .where(
      and(eq(exportSchedule.id, id), eq(exportSchedule.orgId, ctx.orgId)),
    )
    .returning();

  if (!deleted) {
    return Response.json({ error: "Schedule not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
