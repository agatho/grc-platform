import { db, customDashboard, customDashboardWidget } from "@grc/db";
import { duplicateDashboardSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dashboards/:id/duplicate — Duplicate dashboard
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = await req.json();
  const parsed = duplicateDashboardSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Verify source dashboard exists and user has access
  const source = await db.query.customDashboard.findFirst({
    where: and(
      eq(customDashboard.id, id),
      eq(customDashboard.orgId, ctx.orgId),
      isNull(customDashboard.deletedAt),
    ),
  });

  if (!source) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (source.visibility === "personal" && source.userId !== ctx.userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch source widgets
  const sourceWidgets = await db
    .select()
    .from(customDashboardWidget)
    .where(eq(customDashboardWidget.dashboardId, id));

  const result = await withAuditContext(ctx, async (tx) => {
    // Create new dashboard as personal
    const [newDashboard] = await tx
      .insert(customDashboard)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        name: data.name,
        description: source.description,
        visibility: "personal",
        layoutJson: source.layoutJson,
        isDefault: false,
        isFavorite: false,
        createdBy: ctx.userId,
      })
      .returning();

    // Copy widgets
    for (const widget of sourceWidgets) {
      await tx.insert(customDashboardWidget).values({
        dashboardId: newDashboard.id,
        widgetDefinitionId: widget.widgetDefinitionId,
        positionJson: widget.positionJson,
        configJson: widget.configJson,
        sortOrder: widget.sortOrder,
      });
    }

    return newDashboard;
  });

  return Response.json({ data: result }, { status: 201 });
}
