import { db, dataExportLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { exportEntities } from "@/lib/import-export/export-engine";

// GET /api/v1/bcms/bia/export?format=csv|xlsx
//
// #WAVE12-EXPORT-01: see /dpms/ropa/export/route.ts for the same
// "missing route → /[id] catch-all → empty 500" pattern. This route
// delegates to the bia entity registry entry added in PR #144.

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "csv";
  if (!["csv", "xlsx"].includes(format)) {
    return Response.json(
      { error: "Invalid format. Supported: csv, xlsx" },
      { status: 422 },
    );
  }

  const filters: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    if (!["format", "page", "limit"].includes(key)) {
      filters[key] = value;
    }
  });

  const result = await exportEntities("bia", format, filters, ctx.orgId);

  try {
    await db.insert(dataExportLog).values({
      orgId: ctx.orgId,
      userId: ctx.userId,
      exportType: format === "xlsx" ? "excel_export" : "csv_export",
      entityType: "bia",
      description: `BIA export (${format.toUpperCase()}, ${result.rowCount} records)`,
      recordCount: result.rowCount,
      containsPersonalData: false,
      fileName: result.fileName,
    });
  } catch (logErr) {
    console.error(
      "[bia-export] Failed to log:",
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
});
