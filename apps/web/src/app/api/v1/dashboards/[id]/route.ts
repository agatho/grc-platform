import {
  db,
  customDashboard,
  customDashboardWidget,
  widgetDefinition,
} from "@grc/db";
import { updateDashboardSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/dashboards/:id — Dashboard detail + widgets
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const dashboard = await db.query.customDashboard.findFirst({
    where: and(
      eq(customDashboard.id, id),
      eq(customDashboard.orgId, ctx.orgId),
      isNull(customDashboard.deletedAt),
    ),
  });

  if (!dashboard) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Check visibility: personal dashboards only visible to owner
  if (
    dashboard.visibility === "personal" &&
    dashboard.userId !== ctx.userId
  ) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch widgets with definitions
  const widgets = await db
    .select({
      id: customDashboardWidget.id,
      dashboardId: customDashboardWidget.dashboardId,
      widgetDefinitionId: customDashboardWidget.widgetDefinitionId,
      positionJson: customDashboardWidget.positionJson,
      configJson: customDashboardWidget.configJson,
      sortOrder: customDashboardWidget.sortOrder,
      definition: {
        id: widgetDefinition.id,
        key: widgetDefinition.key,
        nameDe: widgetDefinition.nameDe,
        nameEn: widgetDefinition.nameEn,
        descriptionDe: widgetDefinition.descriptionDe,
        descriptionEn: widgetDefinition.descriptionEn,
        type: widgetDefinition.type,
        defaultConfig: widgetDefinition.defaultConfig,
        minWidth: widgetDefinition.minWidth,
        minHeight: widgetDefinition.minHeight,
        maxWidth: widgetDefinition.maxWidth,
        maxHeight: widgetDefinition.maxHeight,
        requiredPermissions: widgetDefinition.requiredPermissions,
        previewImageUrl: widgetDefinition.previewImageUrl,
        isActive: widgetDefinition.isActive,
      },
    })
    .from(customDashboardWidget)
    .innerJoin(
      widgetDefinition,
      eq(customDashboardWidget.widgetDefinitionId, widgetDefinition.id),
    )
    .where(eq(customDashboardWidget.dashboardId, id))
    .orderBy(customDashboardWidget.sortOrder);

  return Response.json({
    data: {
      ...dashboard,
      widgets,
    },
  });
}

// PUT /api/v1/dashboards/:id — Update dashboard
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateDashboardSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Only admin can set isDefault
  if (data.isDefault !== undefined) {
    const roleCtx = await withAuth("admin");
    if (roleCtx instanceof Response) return roleCtx;
  }

  const existing = await db.query.customDashboard.findFirst({
    where: and(
      eq(customDashboard.id, id),
      eq(customDashboard.orgId, ctx.orgId),
      isNull(customDashboard.deletedAt),
    ),
  });

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Only owner or admin can edit personal dashboards
  if (
    existing.visibility === "personal" &&
    existing.userId !== ctx.userId
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.visibility !== undefined) updateFields.visibility = data.visibility;
    if (data.layoutJson !== undefined) updateFields.layoutJson = data.layoutJson;
    if (data.isDefault !== undefined) updateFields.isDefault = data.isDefault;
    if (data.isFavorite !== undefined) updateFields.isFavorite = data.isFavorite;

    const [updated] = await tx
      .update(customDashboard)
      .set(updateFields)
      .where(eq(customDashboard.id, id))
      .returning();

    return updated;
  });

  return Response.json({ data: result });
}

// DELETE /api/v1/dashboards/:id — Soft delete dashboard
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const existing = await db.query.customDashboard.findFirst({
    where: and(
      eq(customDashboard.id, id),
      eq(customDashboard.orgId, ctx.orgId),
      isNull(customDashboard.deletedAt),
    ),
  });

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Only owner or admin can delete
  if (
    existing.visibility === "personal" &&
    existing.userId !== ctx.userId
  ) {
    const roleCtx = await withAuth("admin");
    if (roleCtx instanceof Response) return roleCtx;
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(customDashboard)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(customDashboard.id, id));
  });

  return Response.json({ success: true });
}
