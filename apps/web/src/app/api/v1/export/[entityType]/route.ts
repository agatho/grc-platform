import { db, dataExportLog } from "@grc/db";
import { withAuth } from "@/lib/api";
import { exportEntities } from "@/lib/import-export/export-engine";
import { getSupportedEntityTypes } from "@/lib/import-export/entity-registry";

// GET /api/v1/export/:entityType?format=csv|xlsx|pdf&filters...
export async function GET(
  req: Request,
  { params }: { params: Promise<{ entityType: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { entityType } = await params;

  if (!getSupportedEntityTypes().includes(entityType)) {
    return Response.json(
      {
        error: `Unknown entity type: ${entityType}. Supported: ${getSupportedEntityTypes().join(", ")}`,
      },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "csv";

  if (!["csv", "xlsx", "pdf"].includes(format)) {
    return Response.json(
      { error: "Invalid format. Supported: csv, xlsx, pdf" },
      { status: 400 },
    );
  }

  // Collect filter params (excluding format, page, limit)
  const filters: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    if (!["format", "page", "limit"].includes(key)) {
      filters[key] = value;
    }
  });

  try {
    const result = await exportEntities(entityType, format, filters, ctx.orgId);

    // Log the export
    try {
      await db.insert(dataExportLog).values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        exportType:
          format === "xlsx"
            ? "excel_export"
            : format === "pdf"
              ? "pdf_report"
              : "csv_export",
        entityType,
        description: `${entityType} export (${format.toUpperCase()}, ${result.rowCount} records)`,
        recordCount: result.rowCount,
        containsPersonalData: ["ropa_entry", "incident"].includes(entityType),
        fileName: result.fileName,
      });
    } catch (logErr) {
      console.error(
        "[export] Failed to log export:",
        logErr instanceof Error ? logErr.message : String(logErr),
      );
    }

    return new Response(new Uint8Array(result.data), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (err) {
    return Response.json(
      {
        error: "Export failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
