import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { exportEntities } from "@/lib/import-export/export-engine";
import {
  clientIpForAudit,
  logExportOrThrow,
  ExportNotLoggedError,
} from "@/lib/export-audit";

// GET /api/v1/dpms/ropa/export?format=csv|xlsx
//
// #WAVE12-EXPORT-01: this route file did not exist. Requests to
// `/dpms/ropa/export` were being routed to `/dpms/ropa/[id]` with
// `id="export"`, which tried to cast "export" to UUID and crashed
// with a 22P02 BEFORE the wrapper had a chance — empty 500 body.
// Wrapping with withErrorHandler from the start so future regressions
// surface as RFC 7807 problem+json with a requestId.

export const GET = withErrorHandler(async function GET(req: Request) {
  // #WP8-S07-14 — vorher `withAuth()` ohne Rollenliste: das vollständige
  // Verarbeitungsverzeichnis nach Art. 30 war für jeden angemeldeten
  // Nutzer exportierbar, einschliesslich der Verantwortlichen-Kontakte.
  const ctx = await withAuth(
    "admin",
    "dpo",
    "compliance_officer",
    "auditor",
    "external_auditor",
  );
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

  // #WP8-S07-14 — der Nachweis steht vor der Auslieferung. Vorher wurde
  // ein Fehlschlag nur auf die Konsole geschrieben und der Export
  // trotzdem geliefert: ADR-018 §3.2 verlangt einen Eintrag je Aufruf,
  // und ein Eintrag, der ausbleiben darf, ist keiner.
  try {
    await logExportOrThrow({
      orgId: ctx.orgId,
      userId: ctx.userId,
      exportType: format === "xlsx" ? "excel_export" : "csv_export",
      entityType: "ropa_entry",
      description: `RoPA export (${format.toUpperCase()}, ${result.rowCount} records)`,
      recordCount: result.rowCount,
      containsPersonalData: true,
      fileName: result.fileName,
      ipAddress: clientIpForAudit(req),
    });
  } catch (err) {
    if (err instanceof ExportNotLoggedError) {
      return Response.json(
        {
          type: "https://arctos.charliehund.de/errors/export-not-recorded",
          title: "Export not recorded",
          status: 503,
          detail:
            "The export could not be recorded in the tamper-evident export log and was therefore not delivered.",
        },
        {
          status: 503,
          headers: { "Content-Type": "application/problem+json" },
        },
      );
    }
    throw err;
  }

  return new Response(new Uint8Array(result.data), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
    },
  });
});
