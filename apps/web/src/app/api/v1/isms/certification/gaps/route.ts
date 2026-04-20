import { db, soaEntry, catalogEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, or } from "drizzle-orm";
import { withAuth, paginate } from "@/lib/api";

// GET /api/v1/isms/certification/gaps — Open gaps sorted by priority
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  // Gaps = SoA entries that are applicable but not fully implemented
  const gaps = await db
    .select({
      id: soaEntry.id,
      catalogEntryId: soaEntry.catalogEntryId,
      controlId: soaEntry.controlId,
      applicability: soaEntry.applicability,
      implementation: soaEntry.implementation,
      implementationNotes: soaEntry.implementationNotes,
      responsibleId: soaEntry.responsibleId,
      catalogCode: catalogEntry.code,
      catalogTitleDe: catalogEntry.nameDe,
      catalogTitleEn: catalogEntry.name,
      catalogLevel: catalogEntry.level,
    })
    .from(soaEntry)
    .leftJoin(catalogEntry, eq(soaEntry.catalogEntryId, catalogEntry.id))
    .where(
      and(
        eq(soaEntry.orgId, ctx.orgId),
        or(
          eq(soaEntry.applicability, "applicable"),
          eq(soaEntry.applicability, "partially_applicable"),
        ),
        or(
          eq(soaEntry.implementation, "not_implemented"),
          eq(soaEntry.implementation, "planned"),
          eq(soaEntry.implementation, "partially_implemented"),
        ),
      ),
    )
    .orderBy(
      // Priority: not_implemented first, then planned, then partially_implemented
      sql`CASE ${soaEntry.implementation} WHEN 'not_implemented' THEN 1 WHEN 'planned' THEN 2 WHEN 'partially_implemented' THEN 3 ELSE 4 END`,
      catalogEntry.sortOrder,
    )
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(soaEntry)
    .where(
      and(
        eq(soaEntry.orgId, ctx.orgId),
        or(
          eq(soaEntry.applicability, "applicable"),
          eq(soaEntry.applicability, "partially_applicable"),
        ),
        or(
          eq(soaEntry.implementation, "not_implemented"),
          eq(soaEntry.implementation, "planned"),
          eq(soaEntry.implementation, "partially_implemented"),
        ),
      ),
    );

  // Stats breakdown
  const [stats] = await db
    .select({
      notImplemented: sql<number>`count(*) filter (where ${soaEntry.implementation} = 'not_implemented')::int`,
      planned: sql<number>`count(*) filter (where ${soaEntry.implementation} = 'planned')::int`,
      partiallyImplemented: sql<number>`count(*) filter (where ${soaEntry.implementation} = 'partially_implemented')::int`,
    })
    .from(soaEntry)
    .where(
      and(
        eq(soaEntry.orgId, ctx.orgId),
        or(
          eq(soaEntry.applicability, "applicable"),
          eq(soaEntry.applicability, "partially_applicable"),
        ),
      ),
    );

  return Response.json({
    data: gaps,
    stats: {
      total,
      notImplemented: stats.notImplemented,
      planned: stats.planned,
      partiallyImplemented: stats.partiallyImplemented,
    },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
