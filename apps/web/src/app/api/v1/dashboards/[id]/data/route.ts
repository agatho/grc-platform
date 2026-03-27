import {
  db,
  customDashboard,
  customDashboardWidget,
  widgetDefinition,
} from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { resolveWidgetUrl } from "@grc/shared";

// GET /api/v1/dashboards/:id/data — Batch-fetch all widget data (Promise.allSettled)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Verify dashboard exists and user has access
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

  if (
    dashboard.visibility === "personal" &&
    dashboard.userId !== ctx.userId
  ) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch all widgets
  const widgets = await db
    .select({
      id: customDashboardWidget.id,
      configJson: customDashboardWidget.configJson,
      definitionKey: widgetDefinition.key,
    })
    .from(customDashboardWidget)
    .innerJoin(
      widgetDefinition,
      eq(customDashboardWidget.widgetDefinitionId, widgetDefinition.id),
    )
    .where(eq(customDashboardWidget.dashboardId, id));

  // Extract cookie/authorization from the original request for forwarding
  const cookieHeader = req.headers.get("cookie") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const origin = new URL(req.url).origin;

  // Batch-fetch all widget data sources in parallel
  const results = await Promise.allSettled(
    widgets.map(async (widget) => {
      const config = widget.configJson as {
        dataSource?: string;
        filters?: Record<string, string | number | boolean>;
      };

      if (!config?.dataSource) {
        return { widgetId: widget.id, status: "rejected" as const, error: "No data source configured" };
      }

      const urlPath = resolveWidgetUrl({
        dataSource: config.dataSource,
        filters: config.filters,
      });

      try {
        const response = await fetch(`${origin}${urlPath}`, {
          headers: {
            Cookie: cookieHeader,
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000), // 10s timeout per widget
        });

        if (!response.ok) {
          return {
            widgetId: widget.id,
            status: "rejected" as const,
            error: response.status === 404
              ? "Module not activated"
              : `API error: ${response.status}`,
          };
        }

        const data = await response.json();
        return { widgetId: widget.id, status: "fulfilled" as const, data };
      } catch (err) {
        return {
          widgetId: widget.id,
          status: "rejected" as const,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }),
  );

  // Build response map
  const widgetData: Record<string, { status: string; data?: unknown; error?: string }> = {};

  for (const result of results) {
    if (result.status === "fulfilled") {
      const val = result.value;
      widgetData[val.widgetId] = {
        status: val.status,
        data: val.status === "fulfilled" ? val.data : undefined,
        error: val.status === "rejected" ? val.error : undefined,
      };
    } else {
      // Promise itself was rejected (should be rare)
      widgetData["unknown"] = { status: "rejected", error: result.reason };
    }
  }

  return Response.json({ widgetData });
}
