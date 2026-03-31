import { db, soaEntry, catalogEntry } from "@grc/db";
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
      catalogCode: catalogEntry.code,
      catalogTitleDe: catalogEntry.nameDe,
      catalogTitleEn: catalogEntry.name,
      applicability: soaEntry.applicability,
      applicabilityJustification: soaEntry.applicabilityJustification,
      implementation: soaEntry.implementation,
      implementationNotes: soaEntry.implementationNotes,
      lastReviewed: soaEntry.lastReviewed,
    })
    .from(soaEntry)
    .leftJoin(catalogEntry, eq(soaEntry.catalogEntryId, catalogEntry.id))
    .where(eq(soaEntry.orgId, ctx.orgId))
    .orderBy(catalogEntry.sortOrder);

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
