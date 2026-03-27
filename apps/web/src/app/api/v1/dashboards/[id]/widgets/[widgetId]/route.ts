import {
  db,
  customDashboard,
  customDashboardWidget,
} from "@grc/db";
import { updateWidgetSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/dashboards/:id/widgets/:widgetId — Update widget config/position
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; widgetId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id, widgetId } = await params;
  const body = await req.json();
  const parsed = updateWidgetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Verify dashboard access
  const dashboard = await db.query.customDashboard.findFirst({
    where: and(
      eq(customDashboard.id, id),
      eq(customDashboard.orgId, ctx.orgId),
      isNull(customDashboard.deletedAt),
    ),
  });

  if (!dashboard) {
    return Response.json({ error: "Dashboard not found" }, { status: 404 });
  }

  if (
    dashboard.visibility === "personal" &&
    dashboard.userId !== ctx.userId
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify widget exists on this dashboard
  const widget = await db.query.customDashboardWidget.findFirst({
    where: and(
      eq(customDashboardWidget.id, widgetId),
      eq(customDashboardWidget.dashboardId, id),
    ),
  });

  if (!widget) {
    return Response.json({ error: "Widget not found" }, { status: 404 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updateFields: Record<string, unknown> = {};

    if (data.positionJson !== undefined)
      updateFields.positionJson = data.positionJson;
    if (data.configJson !== undefined) updateFields.configJson = data.configJson;
    if (data.sortOrder !== undefined) updateFields.sortOrder = data.sortOrder;

    const [updated] = await tx
      .update(customDashboardWidget)
      .set(updateFields)
      .where(eq(customDashboardWidget.id, widgetId))
      .returning();

    return updated;
  });

  return Response.json({ data: result });
}

// DELETE /api/v1/dashboards/:id/widgets/:widgetId — Remove widget
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; widgetId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id, widgetId } = await params;

  // Verify dashboard access
  const dashboard = await db.query.customDashboard.findFirst({
    where: and(
      eq(customDashboard.id, id),
      eq(customDashboard.orgId, ctx.orgId),
      isNull(customDashboard.deletedAt),
    ),
  });

  if (!dashboard) {
    return Response.json({ error: "Dashboard not found" }, { status: 404 });
  }

  if (
    dashboard.visibility === "personal" &&
    dashboard.userId !== ctx.userId
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const widget = await db.query.customDashboardWidget.findFirst({
    where: and(
      eq(customDashboardWidget.id, widgetId),
      eq(customDashboardWidget.dashboardId, id),
    ),
  });

  if (!widget) {
    return Response.json({ error: "Widget not found" }, { status: 404 });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(customDashboardWidget)
      .where(eq(customDashboardWidget.id, widgetId));
  });

  return Response.json({ success: true });
}
