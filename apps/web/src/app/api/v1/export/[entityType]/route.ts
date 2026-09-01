import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { exportEntities } from "@/lib/import-export/export-engine";
import { getSupportedEntityTypes } from "@/lib/import-export/entity-registry";
import {
  exportContainsPersonalData,
  mayExportPersonalData,
  PERSONAL_EXPORT_ROLES,
  clientIpForAudit,
  logExportOrThrow,
  ExportNotLoggedError,
} from "@/lib/export-audit";

// GET /api/v1/export/:entityType?format=csv|xlsx|pdf&filters...
//
// #WAVE11-EXPORT: wrapped with withErrorHandler so any future SQL or
// engine crash returns a structured RFC 7807 response (with requestId
// for log correlation) instead of the previous "Export failed" 500
// with a leaked error.message. The route's internal try/catch is
// removed in favour of the wrapper.
export const GET = withErrorHandler<{
  params: Promise<{ entityType: string }>;
}>(async function GET(req, { params }) {
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

  // #WP8-S07-14 — vorher stand hier `withAuth()` ohne Rollenliste: jede
  // authentifizierte Rolle, auch `viewer`, konnte den vollständigen
  // Bestand einer Entität samt Eigentümer-E-Mail-Adressen abziehen, und
  // das Protokoll wies den Vorgang als `contains_personal_data = false`
  // aus. Exporte OHNE Personenbezug bleiben für jede angemeldete Rolle
  // offen; sobald Personenbezug im Spiel ist, entscheidet die Rolle.
  if (
    exportContainsPersonalData(entityType) &&
    !mayExportPersonalData(ctx.roles)
  ) {
    return Response.json(
      {
        type: "https://arctos.charliehund.de/errors/role-required",
        title: "Forbidden",
        status: 403,
        detail:
          `Exporting ${entityType} discloses personal data and requires one of: ` +
          PERSONAL_EXPORT_ROLES.join(", "),
      },
      { status: 403, headers: { "Content-Type": "application/problem+json" } },
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

  const result = await exportEntities(entityType, format, filters, ctx.orgId);

  // #WP8-S07-14 — der Nachweis steht VOR der Auslieferung und ist nicht
  // optional. Vorher steckte er in einem `catch`, das den Fehler nur auf
  // die Konsole schrieb: der Export gelang auch ohne Protokoll, was der
  // klassische Insider-Exfiltrationspfad ist. `contains_personal_data`
  // wird jetzt aus den tatsächlich exportierten Spalten abgeleitet statt
  // aus einer zweielementigen Literalliste.
  try {
    await logExportOrThrow({
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
      containsPersonalData: exportContainsPersonalData(entityType),
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
