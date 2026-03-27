import { db, importJob } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { importValidateSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
import { parseFile } from "@/lib/import-export/file-parser";
import { validateRows } from "@/lib/import-export/validation-engine";

// POST /api/v1/import/:jobId/validate — Validate all rows with mapping
export async function POST(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { jobId } = await params;

  const body = importValidateSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [job] = await db
    .select()
    .from(importJob)
    .where(and(eq(importJob.id, jobId), eq(importJob.orgId, ctx.orgId)));

  if (!job) {
    return Response.json({ error: "Import job not found" }, { status: 404 });
  }

  if (!["mapping", "validated"].includes(job.status)) {
    return Response.json(
      {
        error: `Cannot validate in status '${job.status}'. Must be 'mapping' or 'validated'.`,
      },
      { status: 409 },
    );
  }

  // Use provided mapping or fall back to stored mapping
  const mapping = body.data.mapping ??
    (job.columnMapping as Record<string, string | null>);

  if (!mapping) {
    return Response.json(
      { error: "No column mapping available. Map columns first." },
      { status: 400 },
    );
  }

  try {
    // Update status to validating
    await withAuditContext(ctx, async (tx) => {
      await tx
        .update(importJob)
        .set({ status: "validating", columnMapping: mapping })
        .where(eq(importJob.id, jobId));
    });

    // Get the raw preview rows stored during upload as the data source
    // In production, you'd re-parse the file. For now, use stored preview
    // or re-parse from stored data.
    const rawRows = (job.rawPreviewRows as Record<string, string>[]) ?? [];

    // If we have totalRows but limited preview, we need the full dataset
    // For the validation, we use whatever rows we have stored
    // In a real system, the file would be stored in object storage
    const result = await validateRows(
      rawRows,
      mapping as Record<string, string | null>,
      job.entityType,
      ctx.orgId,
    );

    // Update job with validation results
    await withAuditContext(ctx, async (tx) => {
      await tx
        .update(importJob)
        .set({
          status: "validated",
          validRows: result.validRows,
          errorRows: result.errorRows,
          validationErrors: result.errors,
          columnMapping: mapping,
        })
        .where(eq(importJob.id, jobId));
    });

    return Response.json({
      totalRows: result.totalRows,
      validRows: result.validRows,
      errorRows: result.errorRows,
      errors: result.errors,
      previewRows: result.previewRows?.slice(0, 10),
      dryRun: body.data.dryRun,
    });
  } catch (err) {
    // Update status to failed
    await withAuditContext(ctx, async (tx) => {
      await tx
        .update(importJob)
        .set({ status: "failed" })
        .where(eq(importJob.id, jobId));
    });

    return Response.json(
      {
        error: "Validation failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
