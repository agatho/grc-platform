import { db, importJob } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { escapeCsvField } from "@/lib/import-export/csv-sanitizer";
import type { ImportLogEntry } from "@grc/shared";

// GET /api/v1/import/:jobId/log — Row-level import log (JSON or CSV download)
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

  const log = (job.logJson ?? []) as ImportLogEntry[];
  const validationErrors = (job.validationErrors ?? []) as Array<{
    row: number;
    field?: string;
    error: string;
  }>;

  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  // CSV download of error rows
  if (format === "csv") {
    const errorEntries = [
      ...log.filter((entry) => entry.status === "error"),
      ...validationErrors.map((e) => ({
        rowNumber: e.row,
        status: "error" as const,
        error: e.field ? `${e.field}: ${e.error}` : e.error,
      })),
    ];

    const csvHeader = "Row,Status,Entity ID,Error";
    const csvRows = errorEntries.map(
      (entry) =>
        `${entry.rowNumber},${entry.status},${escapeCsvField(("entityId" in entry ? entry.entityId : "") ?? "")},${escapeCsvField(entry.error ?? "")}`,
    );

    const csv = [csvHeader, ...csvRows].join("\n");
    const fileName = `import-errors-${jobId.slice(0, 8)}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }

  // JSON response
  return Response.json({
    jobId: job.id,
    entityType: job.entityType,
    fileName: job.fileName,
    status: job.status,
    totalRows: job.totalRows,
    importedRows: job.importedRows,
    errorRows: job.errorRows,
    log,
    validationErrors,
  });
}
