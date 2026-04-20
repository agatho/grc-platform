import { db, dataExportLog } from "@grc/db";
import { bulkExportSchema } from "@grc/shared";
import { withAuth } from "@/lib/api";
import { exportEntities } from "@/lib/import-export/export-engine";

// POST /api/v1/export/bulk — Multi-entity export
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = bulkExportSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const results: { entityType: string; data: string; rowCount: number }[] =
      [];

    for (const entityType of body.data.entityTypes) {
      const result = await exportEntities(entityType, "csv", {}, ctx.orgId);
      results.push({
        entityType,
        data: result.data.toString("utf-8"),
        rowCount: result.rowCount,
      });
    }

    // For multi-entity, return as JSON with CSV data per entity
    // A full ZIP implementation would use archiver library
    const totalRecords = results.reduce((sum, r) => sum + r.rowCount, 0);

    // Log the bulk export
    try {
      await db.insert(dataExportLog).values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        exportType: "bulk_export",
        entityType: body.data.entityTypes.join(","),
        description: `Bulk export (${body.data.entityTypes.length} types, ${totalRecords} total records)`,
        recordCount: totalRecords,
        containsPersonalData: body.data.entityTypes.some((t) =>
          ["ropa_entry", "incident"].includes(t),
        ),
        fileName: `bulk-export-${new Date().toISOString().slice(0, 10)}.zip`,
      });
    } catch (logErr) {
      console.error(
        "[export/bulk] Failed to log:",
        logErr instanceof Error ? logErr.message : String(logErr),
      );
    }

    return Response.json({
      exports: results.map((r) => ({
        entityType: r.entityType,
        rowCount: r.rowCount,
        csvData: r.data,
      })),
      totalRecords,
    });
  } catch (err) {
    return Response.json(
      {
        error: "Bulk export failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
