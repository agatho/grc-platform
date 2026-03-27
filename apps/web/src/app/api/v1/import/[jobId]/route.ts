import { db, importJob } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/import/:jobId — Job status + mapping details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { jobId } = await params;

  const [job] = await db
    .select()
    .from(importJob)
    .where(and(eq(importJob.id, jobId), eq(importJob.orgId, ctx.orgId)));

  if (!job) {
    return Response.json({ error: "Import job not found" }, { status: 404 });
  }

  return Response.json({
    id: job.id,
    entityType: job.entityType,
    fileName: job.fileName,
    fileSize: job.fileSize,
    status: job.status,
    totalRows: job.totalRows,
    validRows: job.validRows,
    errorRows: job.errorRows,
    importedRows: job.importedRows,
    columnMapping: job.columnMapping,
    validationErrors: job.validationErrors,
    rawHeaders: job.rawHeaders,
    rawPreviewRows: job.rawPreviewRows,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
}
