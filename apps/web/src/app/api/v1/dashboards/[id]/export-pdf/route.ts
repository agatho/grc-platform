import {
  db,
  customDashboard,
  customDashboardWidget,
  widgetDefinition,
} from "@grc/db";
import { exportPdfSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/dashboards/:id/export-pdf — Export dashboard as PDF
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Parse body (format options)
  let format: "a4_landscape" | "a4_portrait" = "a4_landscape";
  try {
    const body = await req.json();
    const parsed = exportPdfSchema.safeParse(body);
    if (parsed.success) {
      format = parsed.data.format;
    }
  } catch {
    // Body may be empty, use defaults
  }

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

  // Fetch widgets for the report
  const widgets = await db
    .select({
      id: customDashboardWidget.id,
      positionJson: customDashboardWidget.positionJson,
      configJson: customDashboardWidget.configJson,
      definitionKey: widgetDefinition.key,
      definitionNameDe: widgetDefinition.nameDe,
      definitionNameEn: widgetDefinition.nameEn,
      definitionType: widgetDefinition.type,
    })
    .from(customDashboardWidget)
    .innerJoin(
      widgetDefinition,
      eq(customDashboardWidget.widgetDefinitionId, widgetDefinition.id),
    )
    .where(eq(customDashboardWidget.dashboardId, id))
    .orderBy(customDashboardWidget.sortOrder);

  // Generate a simple HTML-based PDF report
  // In production, this would use Puppeteer for server-side rendering
  const isLandscape = format === "a4_landscape";
  const now = new Date().toLocaleDateString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const htmlContent = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>${dashboard.name}</title>
  <style>
    @page { size: A4 ${isLandscape ? "landscape" : "portrait"}; margin: 20mm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3B82F6; padding-bottom: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 24px; margin: 0; }
    .header .meta { font-size: 12px; color: #666; text-align: right; }
    .widget-grid { display: grid; grid-template-columns: repeat(${isLandscape ? 3 : 2}, 1fr); gap: 16px; }
    .widget-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .widget-card h3 { margin: 0 0 8px 0; font-size: 14px; color: #374151; }
    .widget-card .type-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #EFF6FF; color: #3B82F6; }
    .widget-card .data-source { font-size: 11px; color: #9CA3AF; margin-top: 8px; }
    .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 10px; color: #9CA3AF; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${dashboard.name}</h1>
      ${dashboard.description ? `<p style="margin:4px 0 0;color:#666;font-size:13px;">${dashboard.description}</p>` : ""}
    </div>
    <div class="meta">
      <div>Erstellt: ${now}</div>
      <div>Dashboard-Export</div>
    </div>
  </div>
  <div class="widget-grid">
    ${widgets
      .map(
        (w) => `
    <div class="widget-card">
      <span class="type-badge">${w.definitionType.toUpperCase()}</span>
      <h3>${w.definitionNameDe}</h3>
      <div class="data-source">${(w.configJson as Record<string, unknown>)?.dataSource ?? "-"}</div>
    </div>`,
      )
      .join("")}
  </div>
  <div class="footer">
    ARCTOS GRC Platform &mdash; Dashboard-Export &mdash; ${now}
  </div>
</body>
</html>`;

  // Return HTML that can be printed to PDF client-side
  // In production with Puppeteer: convert to actual PDF buffer
  return new Response(htmlContent, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="dashboard-${id}.html"`,
    },
  });
}
