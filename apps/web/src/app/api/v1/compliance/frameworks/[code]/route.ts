// GET /api/v1/compliance/frameworks/[code]
//
// #WAVE21-B3: framework detail — looks up by `catalog.source` (the
// canonical short-code: 'iso27002_2022', 'nist_csf_2', 'eu_nis2', ...)
// and returns the framework metadata + a paginated list of
// catalog_entry children.

import { db, catalog, catalogEntry } from "@grc/db";
import { eq, asc, count, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

type IdCtx = { params: Promise<{ code: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { code } = await params;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const [cat] = await db
    .select()
    .from(catalog)
    .where(and(eq(catalog.source, code), eq(catalog.isActive, true)));

  if (!cat) {
    return Response.json(
      { error: `Framework '${code}' not found` },
      { status: 404 },
    );
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(catalogEntry)
    .where(eq(catalogEntry.catalogId, cat.id));

  const entries = await db
    .select({
      id: catalogEntry.id,
      code: catalogEntry.code,
      name: catalogEntry.name,
      nameDe: catalogEntry.nameDe,
      level: catalogEntry.level,
      sortOrder: catalogEntry.sortOrder,
      parentEntryId: catalogEntry.parentEntryId,
    })
    .from(catalogEntry)
    .where(eq(catalogEntry.catalogId, cat.id))
    .orderBy(asc(catalogEntry.sortOrder), asc(catalogEntry.code))
    .limit(limit)
    .offset(offset);

  return Response.json({
    data: {
      framework: {
        id: cat.id,
        code: cat.source,
        name: cat.name,
        description: cat.description,
        type: cat.catalogType,
        version: cat.version,
        language: cat.language,
        targetModules: cat.targetModules ?? [],
      },
      controls: {
        total,
        offset,
        limit,
        items: entries,
      },
    },
  });
});
