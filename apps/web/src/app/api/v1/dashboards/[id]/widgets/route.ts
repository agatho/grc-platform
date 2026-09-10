import {
  db,
  customDashboard,
  customDashboardWidget,
  widgetDefinition,
} from "@grc/db";
import { addWidgetSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/dashboards/:id/widgets — Add widget to dashboard
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = await req.json();
  const parsed = addWidgetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Verify dashboard exists and user has access
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

  if (dashboard.visibility === "personal" && dashboard.userId !== ctx.userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify widget definition exists
  const definition = await db.query.widgetDefinition.findFirst({
    where: eq(widgetDefinition.id, data.widgetDefinitionId),
  });

  if (!definition) {
    return Response.json(
      { error: "Widget definition not found" },
      { status: 404 },
    );
  }

  // Use default config from definition if not provided
  const configJson = data.configJson ?? definition.defaultConfig;

  const result = await withAuditContext(ctx, async (tx) => {
    const [widget] = await tx
      .insert(customDashboardWidget)
      .values({
        dashboardId: id,
        widgetDefinitionId: data.widgetDefinitionId,
        positionJson: data.positionJson,
        configJson,
        sortOrder: data.sortOrder,
      })
      .returning();

    return widget;
  });

  return Response.json({ data: result }, { status: 201 });
});
