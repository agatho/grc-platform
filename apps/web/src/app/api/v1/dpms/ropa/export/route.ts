import { db, dataExportLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { exportEntities } from "@/lib/import-export/export-engine";

// GET /api/v1/dpms/ropa/export?format=csv|xlsx
//
// #WAVE12-EXPORT-01: this route file did not exist. Requests to
// `/dpms/ropa/export` were being routed to `/dpms/ropa/[id]` with
// `id="export"`, which tried to cast "export" to UUID and crashed
// with a 22P02 BEFORE the wrapper had a chance — empty 500 body.
// Wrapping with withErrorHandler from the start so future regressions
// surface as RFC 7807 problem+json with a requestId.

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
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

  const result = await exportEntities("ropa_entry", format, filters, ctx.orgId);

  // Compliance audit-trail entry — RoPA exports leave the system, so
  // ADR-018 §3.2 requires a recorded entry per call. Inner try/catch
  // so a logging failure doesn't break the actual download.
  try {
    await db.insert(dataExportLog).values({
      orgId: ctx.orgId,
      userId: ctx.userId,
      exportType: format === "xlsx" ? "excel_export" : "csv_export",
      entityType: "ropa_entry",
      description: `RoPA export (${format.toUpperCase()}, ${result.rowCount} records)`,
      recordCount: result.rowCount,
      containsPersonalData: true,
      fileName: result.fileName,
    });
  } catch (logErr) {
    console.error(
      "[ropa-export] Failed to log:",
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
