import { db, biReportExecution, biReport } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  triggerBiReportExecutionSchema,
  listBiExecutionsQuerySchema,
} from "@grc/shared";

// GET /api/v1/bi-reports/executions
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listBiExecutionsQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions = [eq(biReportExecution.orgId, ctx.orgId)];
  if (query.reportId)
    conditions.push(eq(biReportExecution.reportId, query.reportId));
  if (query.status) conditions.push(eq(biReportExecution.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(biReportExecution)
      .where(and(...conditions))
      .orderBy(desc(biReportExecution.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(biReportExecution)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
}

// POST /api/v1/bi-reports/executions — Trigger report generation
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = triggerBiReportExecutionSchema.parse(await req.json());

  const [report] = await db
    .select({ id: biReport.id })
    .from(biReport)
    .where(and(eq(biReport.id, body.reportId), eq(biReport.orgId, ctx.orgId)));
  if (!report)
    return Response.json({ error: "Report not found" }, { status: 404 });

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(biReportExecution)
      .values({
        orgId: ctx.orgId,
        reportId: body.reportId,
        outputFormat: body.outputFormat,
        parametersJson: body.parametersJson,
        triggeredBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
