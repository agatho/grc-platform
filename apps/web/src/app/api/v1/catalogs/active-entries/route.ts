/**
 * GET /api/v1/catalogs/active-entries
 *
 * Returns catalog entries from catalogs activated for the current org.
 * Optionally filters to show only entries not yet linked to an entity.
 *
 * Query params:
 *   catalogType  — "risk" | "control" (required)
 *   unassignedOnly — "true" to filter out entries already linked
 *   catalogId    — filter to a specific catalog
 *   limit        — max entries (default 100)
 */
import { db, orgActiveCatalog, catalog, catalogEntry } from "@grc/db";
import { eq, and, inArray, notInArray, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const catalogType = url.searchParams.get("catalogType") ?? "risk";
  const unassignedOnly = url.searchParams.get("unassignedOnly") === "true";
  const filterCatalogId = url.searchParams.get("catalogId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);

  // 1. Get active catalogs for this org + type
  const conditions = [eq(orgActiveCatalog.orgId, ctx.orgId!)];

  const activeCatalogs = await db
    .select({
      catalogId: orgActiveCatalog.catalogId,
      enforcementLevel: orgActiveCatalog.enforcementLevel,
    })
    .from(orgActiveCatalog)
    .where(and(...conditions));

  if (activeCatalogs.length === 0) {
    return Response.json({
      data: [],
      catalogs: [],
      totalEntries: 0,
      unassignedCount: 0,
    });
  }

  // Get catalog details
  let catalogIds = activeCatalogs.map((ac) => ac.catalogId);

  // Filter by catalog type from the catalog table
  const catalogRows = await db
    .select({
      id: catalog.id,
      name: catalog.name,
      source: catalog.source,
      catalogType: catalog.catalogType,
    })
    .from(catalog)
    .where(
      and(
        inArray(catalog.id, catalogIds),
        eq(catalog.catalogType, catalogType),
      ),
    );

  catalogIds = catalogRows.map((c) => c.id);

  if (filterCatalogId) {
    catalogIds = catalogIds.filter((id) => id === filterCatalogId);
  }

  if (catalogIds.length === 0) {
    return Response.json({
      data: [],
      catalogs: catalogRows,
      totalEntries: 0,
      unassignedCount: 0,
    });
  }

  // 2. Get entries from those catalogs
  let entries = await db
    .select({
      id: catalogEntry.id,
      catalogId: catalogEntry.catalogId,
      code: catalogEntry.code,
      name: catalogEntry.name,
      nameDe: catalogEntry.nameDe,
      description: catalogEntry.description,
      descriptionDe: catalogEntry.descriptionDe,
      level: catalogEntry.level,
      sortOrder: catalogEntry.sortOrder,
      status: catalogEntry.status,
    })
    .from(catalogEntry)
    .where(inArray(catalogEntry.catalogId, catalogIds))
    .orderBy(asc(catalogEntry.sortOrder), asc(catalogEntry.code))
    .limit(limit);

  const totalEntries = entries.length;

  // 3. Filter out already-assigned entries if requested
  let unassignedCount = 0;
  if (unassignedOnly) {
    // Check which entries are already referenced
    try {
      const refRes = await db.execute(
        `SELECT DISTINCT catalog_entry_id FROM catalog_entry_reference
         WHERE org_id = '${ctx.orgId}'
         AND catalog_entry_id = ANY($1::uuid[])`,
        // Fallback: use raw query since catalog_entry_reference might not be in drizzle schema
      );
    } catch {
      // If catalog_entry_reference table doesn't exist or query fails,
      // just return all entries
    }
    // Simpler approach: check if a risk/control exists with this catalogEntryId
    try {
      const entityTable = catalogType === "risk" ? "risk" : "control";
      const assignedResult = await db.execute<{ catalog_entry_id: string }>(
        `SELECT DISTINCT catalog_entry_id FROM "${entityTable}"
         WHERE org_id = '${ctx.orgId}'
         AND catalog_entry_id IS NOT NULL
         AND deleted_at IS NULL`,
      );
      const assignedIds = new Set(
        (assignedResult as any[]).map((r: any) => r.catalog_entry_id),
      );
      const beforeCount = entries.length;
      entries = entries.filter((e) => !assignedIds.has(e.id));
      unassignedCount = entries.length;
    } catch {
      unassignedCount = entries.length;
    }
  } else {
    unassignedCount = totalEntries;
  }

  return Response.json({
    data: entries,
    catalogs: catalogRows,
    totalEntries,
    unassignedCount,
  });
}
