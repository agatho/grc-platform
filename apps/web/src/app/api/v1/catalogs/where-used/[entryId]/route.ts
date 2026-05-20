import { db, catalogEntryReference } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/catalogs/where-used/[entryId] — Where-used references for a catalog entry
//
// Triage finding F#20 (overnight 2026-05-18): this used to SELECT * with no
// LIMIT. A popular catalog entry (e.g. an ISO 27002 control referenced by
// hundreds of risk-mappings) could return tens of thousands of rows in
// a single response. Now paginated; default 50, cap 500.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { entryId } = await params;
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const whereClause = and(
    eq(catalogEntryReference.catalogEntryId, entryId),
    eq(catalogEntryReference.orgId, ctx.orgId),
  );

  const [references, totalRow] = await Promise.all([
    db
      .select()
      .from(catalogEntryReference)
      .where(whereClause)
      .orderBy(desc(catalogEntryReference.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(catalogEntryReference)
      .where(whereClause),
  ]);

  return Response.json({
    data: references,
    pagination: {
      limit,
      offset,
      total: totalRow[0]?.count ?? 0,
      hasMore: (totalRow[0]?.count ?? 0) > offset + references.length,
    },
  });
}
