import { db, connectorSchedule } from "@grc/db";
import { updateConnectorScheduleSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PATCH /api/v1/connectors/:id/schedules/:scheduleId
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { scheduleId } = await params;
  const body = updateConnectorScheduleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(connectorSchedule)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(connectorSchedule.id, scheduleId), eq(connectorSchedule.orgId, ctx.orgId)))
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/connectors/:id/schedules/:scheduleId
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { scheduleId } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(connectorSchedule)
      .where(and(eq(connectorSchedule.id, scheduleId), eq(connectorSchedule.orgId, ctx.orgId)))
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deleted: true } });
}
