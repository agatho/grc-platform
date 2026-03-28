import { db, reportGenerationLog, reportTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/reports/jobs/[id] — Job status
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const rows = await db
    .select({
      id: reportGenerationLog.id,
      status: reportGenerationLog.status,
      outputFormat: reportGenerationLog.outputFormat,
      fileSize: reportGenerationLog.fileSize,
      generationTimeMs: reportGenerationLog.generationTimeMs,
      error: reportGenerationLog.error,
      createdAt: reportGenerationLog.createdAt,
      completedAt: reportGenerationLog.completedAt,
      templateName: reportTemplate.name,
    })
    .from(reportGenerationLog)
    .leftJoin(
      reportTemplate,
      eq(reportGenerationLog.templateId, reportTemplate.id),
    )
    .where(
      and(
        eq(reportGenerationLog.id, id),
        eq(reportGenerationLog.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
}
