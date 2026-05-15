// GET /api/v1/compliance/frameworks
//
// #WAVE21-B3: Wave-21 QA found that the 46 seeded compliance
// frameworks (ISO 27001, NIST CSF, NIS2, DORA, GDPR, ...) had no
// public discovery endpoint. The data lived in the generic `catalog`
// table but every consumer (UI, integrators) had to know which
// `source` keys to filter by — making the framework deduplication
// claim invisible to anyone without DB access.
//
// This endpoint surfaces the catalog data shaped for the
// "compliance overview" use-case: one row per framework with its
// canonical code, name, version, target_modules, and the count of
// catalog_entry children (= the number of controls / requirements
// in that framework).
//
// Optional ?targetModule=isms filter narrows to frameworks that
// apply to a specific ARCTOS module (uses catalog.target_modules).

import { db, catalog, catalogEntry } from "@grc/db";
import { count, eq, sql, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const targetModule = url.searchParams.get("targetModule");
  const catalogType = url.searchParams.get("type"); // 'risk' | 'control' | 'reference'

  // Pull the catalog rows + count per catalog. catalog has no org_id —
  // it's platform-wide reference data — so no RLS gating is needed.
  const rows = await db
    .select({
      id: catalog.id,
      source: catalog.source,
      name: catalog.name,
      catalogType: catalog.catalogType,
      version: catalog.version,
      language: catalog.language,
      targetModules: catalog.targetModules,
      controlCount: count(catalogEntry.id),
    })
    .from(catalog)
    .leftJoin(catalogEntry, eq(catalogEntry.catalogId, catalog.id))
    .where(eq(catalog.isActive, true))
    .groupBy(
      catalog.id,
      catalog.source,
      catalog.name,
      catalog.catalogType,
      catalog.version,
      catalog.language,
      catalog.targetModules,
    )
    .orderBy(catalog.name);

  let filtered = rows;
  if (targetModule) {
    filtered = filtered.filter((r) =>
      Array.isArray(r.targetModules)
        ? r.targetModules.includes(targetModule)
        : false,
    );
  }
  if (catalogType) {
    filtered = filtered.filter((r) => r.catalogType === catalogType);
  }

  return Response.json({
    data: {
      total: filtered.length,
      items: filtered.map((r) => ({
        id: r.id,
        code: r.source,
        name: r.name,
        type: r.catalogType,
        version: r.version,
        language: r.language,
        targetModules: r.targetModules ?? [],
        controlCount: r.controlCount,
      })),
    },
  });
});
