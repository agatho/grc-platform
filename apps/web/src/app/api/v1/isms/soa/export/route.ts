import { db, soaEntry, controlCatalogEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/soa/export — CSV export
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const rows = await db
    .select({
      catalogCode: controlCatalogEntry.code,
      catalogTitleDe: controlCatalogEntry.titleDe,
      catalogTitleEn: controlCatalogEntry.titleEn,
      applicability: soaEntry.applicability,
      applicabilityJustification: soaEntry.applicabilityJustification,
      implementation: soaEntry.implementation,
      implementationNotes: soaEntry.implementationNotes,
      lastReviewed: soaEntry.lastReviewed,
    })
    .from(soaEntry)
    .leftJoin(controlCatalogEntry, eq(soaEntry.catalogEntryId, controlCatalogEntry.id))
    .where(eq(soaEntry.orgId, ctx.orgId))
    .orderBy(controlCatalogEntry.sortOrder);

  // Build CSV
  const headers = [
    "Reference",
    "Control (DE)",
    "Control (EN)",
    "Applicability",
    "Justification",
    "Implementation",
    "Notes",
    "Last Reviewed",
  ];

  const csvRows = [
    headers.join(";"),
    ...rows.map((r) =>
      [
        r.catalogCode ?? "",
        csvEscape(r.catalogTitleDe ?? ""),
        csvEscape(r.catalogTitleEn ?? ""),
        r.applicability,
        csvEscape(r.applicabilityJustification ?? ""),
        r.implementation,
        csvEscape(r.implementationNotes ?? ""),
        r.lastReviewed ?? "",
      ].join(";"),
    ),
  ];

  const csv = csvRows.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="soa_export_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
