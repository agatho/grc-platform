import { db, biReportWidget, biReport } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createBiReportWidgetSchema } from "@grc/shared";

// GET /api/v1/bi-reports/widgets?reportId=...
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const reportId = url.searchParams.get("reportId");

  const conditions = [eq(biReportWidget.orgId, ctx.orgId)];
  if (reportId) conditions.push(eq(biReportWidget.reportId, reportId));

  const rows = await db.select().from(biReportWidget)
    .where(and(...conditions)).orderBy(biReportWidget.sortOrder);

  return Response.json({ data: rows });
}

// POST /api/v1/bi-reports/widgets
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createBiReportWidgetSchema.parse(await req.json());

  // Verify report belongs to org
  const [report] = await db.select({ id: biReport.id }).from(biReport)
    .where(and(eq(biReport.id, body.reportId), eq(biReport.orgId, ctx.orgId)));
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(biReportWidget).values({
      orgId: ctx.orgId,
      reportId: body.reportId,
      widgetType: body.widgetType,
      title: body.title,
      dataSourceType: body.dataSourceType,
      queryId: body.queryId,
      configJson: body.configJson,
      positionJson: body.positionJson ?? {},
      sortOrder: body.sortOrder,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
