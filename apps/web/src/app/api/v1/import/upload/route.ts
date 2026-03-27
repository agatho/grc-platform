import { db, importJob } from "@grc/db";
import { importUploadSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
import { parseFile } from "@/lib/import-export/file-parser";
import { autoDetectMapping } from "@/lib/import-export/column-mapper";
import { getSupportedEntityTypes } from "@/lib/import-export/entity-registry";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// POST /api/v1/import/upload — Upload CSV/Excel, create import_job
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!entityType) {
      return Response.json(
        { error: "entityType is required" },
        { status: 400 },
      );
    }

    // Validate entity type
    if (!getSupportedEntityTypes().includes(entityType)) {
      return Response.json(
        {
          error: `Unsupported entity type: ${entityType}. Supported: ${getSupportedEntityTypes().join(", ")}`,
        },
        { status: 400 },
      );
    }

    // File size check
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "File too large. Maximum 10MB allowed." },
        { status: 413 },
      );
    }

    // Validate file type
    const validTypes = [
      "text/csv",
      "application/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const hasValidType =
      validTypes.includes(file.type) ||
      validExtensions.some((ext) => file.name.endsWith(ext));

    if (!hasValidType) {
      return Response.json(
        { error: "Invalid file type. Accepted: CSV, Excel (.xlsx, .xls)" },
        { status: 400 },
      );
    }

    // Parse the file
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFile(buffer, file.type, file.name);

    if (parsed.rows.length === 0) {
      return Response.json(
        { error: "File contains no data rows" },
        { status: 400 },
      );
    }

    // Auto-detect column mapping
    const mappingResult = autoDetectMapping(parsed.headers, entityType);

    // Create import job
    const [job] = await withAuditContext(ctx, async (tx) => {
      return tx
        .insert(importJob)
        .values({
          orgId: ctx.orgId,
          entityType,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "text/csv",
          status: "mapping",
          totalRows: parsed.rows.length,
          columnMapping: mappingResult.mapping,
          rawHeaders: parsed.headers,
          rawPreviewRows: parsed.previewRows,
          createdBy: ctx.userId,
        })
        .returning();
    });

    return Response.json(
      {
        jobId: job.id,
        fileName: file.name,
        totalRows: parsed.rows.length,
        headers: parsed.headers,
        autoMapping: mappingResult.mapping,
        unmappedHeaders: mappingResult.unmappedHeaders,
        unmappedRequired: mappingResult.unmappedRequired,
        isValid: mappingResult.isValid,
        previewRows: parsed.previewRows.slice(0, 3),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error(
      "[import/upload] Error:",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json(
      {
        error: "Failed to process upload",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
