import { db, importJob } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { executeImport } from "@/lib/import-export/import-executor";

// POST /api/v1/import/:jobId/execute — Run import in single transaction
export async function POST(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { jobId } = await params;

  const [job] = await db
    .select()
    .from(importJob)
    .where(and(eq(importJob.id, jobId), eq(importJob.orgId, ctx.orgId)));

  if (!job) {
    return Response.json({ error: "Import job not found" }, { status: 404 });
  }

  if (job.status !== "validated") {
    return Response.json(
      {
        error: `Cannot execute in status '${job.status}'. Must be 'validated'. Run validation first.`,
      },
      { status: 409 },
    );
  }

  const mapping = job.columnMapping as Record<string, string | null>;
  if (!mapping) {
    return Response.json(
      { error: "No column mapping found on this job" },
      { status: 400 },
    );
  }

  // Get the stored rows from the job
  const rawRows = (job.rawPreviewRows as Record<string, string>[]) ?? [];
  if (rawRows.length === 0) {
    return Response.json(
      { error: "No rows available for import" },
      { status: 400 },
    );
  }

  try {
    // Update status to executing
    await withAuditContext(ctx, async (tx) => {
      await tx
        .update(importJob)
        .set({ status: "executing" })
        .where(eq(importJob.id, jobId));
    });

    // Execute the import in a single transaction
    const result = await executeImport(
      rawRows,
      mapping,
      job.entityType,
      ctx.orgId,
      ctx.userId,
    );

    // Update job with results
    const finalStatus = result.failed > 0 ? "failed" : "completed";
    await withAuditContext(ctx, async (tx) => {
      await tx
        .update(importJob)
        .set({
          status: finalStatus,
          importedRows: result.imported,
          errorRows: result.failed > 0 ? rawRows.length : 0,
          logJson: result.log,
          completedAt: new Date(),
        })
        .where(eq(importJob.id, jobId));
    });

    return Response.json({
      imported: result.imported,
      failed: result.failed,
      status: finalStatus,
      log: result.log,
    });
  } catch (err) {
    // Update status to failed
    await withAuditContext(ctx, async (tx) => {
      await tx
        .update(importJob)
        .set({
          status: "failed",
          logJson: [
            {
              rowNumber: 0,
              status: "error",
              error: err instanceof Error ? err.message : String(err),
            },
          ],
          completedAt: new Date(),
        })
        .where(eq(importJob.id, jobId));
    });

    return Response.json(
      {
        error: "Import execution failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
