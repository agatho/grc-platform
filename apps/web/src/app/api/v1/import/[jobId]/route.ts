import { db, importJob } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/import/:jobId — Job status + mapping details
export const GET = withErrorHandler(async function GET(
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
});
