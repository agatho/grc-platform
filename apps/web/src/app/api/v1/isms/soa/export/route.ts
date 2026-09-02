import { db, soaEntry, catalogEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { toCsvRow } from "@/lib/import-export/csv-sanitizer";
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/soa/export — CSV export
export const GET = withErrorHandler(async function GET(req: Request) {
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

  // #S04-05: every cell goes through the central helper — the local
  // `csvEscape` only quoted `; " \n` and left `=`/`+`/`-`/`@` untouched,
  // so a control title or justification could carry a live Excel formula
  // into an auditor's spreadsheet. Note that even the previously
  // "harmless" columns (catalogCode, applicability, …) are neutralized
  // now; they are DB-backed strings, not constants.
  const csvRows = [
    toCsvRow(headers, ";"),
    ...rows.map((r) =>
      toCsvRow(
        [
          r.catalogCode ?? "",
          r.catalogTitleDe ?? "",
          r.catalogTitleEn ?? "",
          r.applicability,
          r.applicabilityJustification ?? "",
          r.implementation,
          r.implementationNotes ?? "",
          r.lastReviewed ?? "",
        ],
        ";",
      ),
    ),
  ];

  const csv = csvRows.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="soa_export_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
});
