import { db, reportGenerationLog, reportTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { reportHistoryQuerySchema } from "@grc/shared";

// GET /api/v1/reports/history — Generation history
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = reportHistoryQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  const conditions = [eq(reportGenerationLog.orgId, ctx.orgId)];

  if (query.templateId) {
    conditions.push(eq(reportGenerationLog.templateId, query.templateId));
  }
  if (query.status) {
    conditions.push(eq(reportGenerationLog.status, query.status));
  }

  const offset = (query.page - 1) * query.limit;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: reportGenerationLog.id,
        templateId: reportGenerationLog.templateId,
        templateName: reportTemplate.name,
        status: reportGenerationLog.status,
        outputFormat: reportGenerationLog.outputFormat,
        fileSize: reportGenerationLog.fileSize,
        generationTimeMs: reportGenerationLog.generationTimeMs,
        error: reportGenerationLog.error,
        generatedBy: reportGenerationLog.generatedBy,
        createdAt: reportGenerationLog.createdAt,
        completedAt: reportGenerationLog.completedAt,
      })
      .from(reportGenerationLog)
      .leftJoin(
        reportTemplate,
        eq(reportGenerationLog.templateId, reportTemplate.id),
      )
      .where(and(...conditions))
      .orderBy(desc(reportGenerationLog.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(reportGenerationLog)
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
