import { db, soaEntry, controlCatalogEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/isms/soa
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const applicabilityFilter = searchParams.get("applicability");
  const implementationFilter = searchParams.get("implementation");
  const search = searchParams.get("search");

  const conditions: ReturnType<typeof eq>[] = [
    eq(soaEntry.orgId, ctx.orgId),
  ];
  if (applicabilityFilter) {
    conditions.push(eq(soaEntry.applicability, applicabilityFilter as "applicable" | "not_applicable" | "partially_applicable"));
  }
  if (implementationFilter) {
    conditions.push(eq(soaEntry.implementation, implementationFilter as "implemented" | "partially_implemented" | "planned" | "not_implemented"));
  }

  // Join with catalog entries for search and display
  const baseQuery = db
    .select({
      id: soaEntry.id,
      orgId: soaEntry.orgId,
      catalogEntryId: soaEntry.catalogEntryId,
      controlId: soaEntry.controlId,
      applicability: soaEntry.applicability,
      applicabilityJustification: soaEntry.applicabilityJustification,
      implementation: soaEntry.implementation,
      implementationNotes: soaEntry.implementationNotes,
      responsibleId: soaEntry.responsibleId,
      lastReviewed: soaEntry.lastReviewed,
      createdAt: soaEntry.createdAt,
      updatedAt: soaEntry.updatedAt,
      catalogCode: controlCatalogEntry.code,
      catalogTitleDe: controlCatalogEntry.titleDe,
      catalogTitleEn: controlCatalogEntry.titleEn,
    })
    .from(soaEntry)
    .leftJoin(controlCatalogEntry, eq(soaEntry.catalogEntryId, controlCatalogEntry.id));

  if (search) {
    conditions.push(
      sql`(${controlCatalogEntry.titleDe} ilike ${'%' + search + '%'} or ${controlCatalogEntry.titleEn} ilike ${'%' + search + '%'} or ${controlCatalogEntry.code} ilike ${'%' + search + '%'})`,
    );
  }

  const rows = await baseQuery
    .where(and(...conditions))
    .orderBy(controlCatalogEntry.sortOrder)
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(soaEntry)
    .leftJoin(controlCatalogEntry, eq(soaEntry.catalogEntryId, controlCatalogEntry.id))
    .where(and(...conditions));

  // Stats
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      applicable: sql<number>`count(*) filter (where ${soaEntry.applicability} = 'applicable')::int`,
      notApplicable: sql<number>`count(*) filter (where ${soaEntry.applicability} = 'not_applicable')::int`,
      partiallyApplicable: sql<number>`count(*) filter (where ${soaEntry.applicability} = 'partially_applicable')::int`,
      implemented: sql<number>`count(*) filter (where ${soaEntry.implementation} = 'implemented')::int`,
      partiallyImplemented: sql<number>`count(*) filter (where ${soaEntry.implementation} = 'partially_implemented')::int`,
      planned: sql<number>`count(*) filter (where ${soaEntry.implementation} = 'planned')::int`,
      notImplemented: sql<number>`count(*) filter (where ${soaEntry.implementation} = 'not_implemented')::int`,
    })
    .from(soaEntry)
    .where(eq(soaEntry.orgId, ctx.orgId));

  const applicableCount = stats.applicable + stats.partiallyApplicable;
  const implementationPct = applicableCount > 0
    ? Math.round((stats.implemented / applicableCount) * 100)
    : 0;

  return Response.json({
    data: rows,
    stats: { ...stats, implementationPercentage: implementationPct },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/v1/isms/soa — generate SoA from ISO 27002 catalog (idempotent)
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await withAuditContext(ctx, async (tx) => {
    // Get all control catalog entries from ISO 27002 catalogs
    const catalogEntries = await tx
      .select({ id: controlCatalogEntry.id })
      .from(controlCatalogEntry)
      .where(eq(controlCatalogEntry.isActive, true));

    let created = 0;
    let skipped = 0;

    for (const entry of catalogEntries) {
      // Check if SoA entry already exists for this org + catalog entry
      const [existing] = await tx
        .select({ id: soaEntry.id })
        .from(soaEntry)
        .where(
          and(
            eq(soaEntry.orgId, ctx.orgId),
            eq(soaEntry.catalogEntryId, entry.id),
          ),
        )
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await tx.insert(soaEntry).values({
        orgId: ctx.orgId,
        catalogEntryId: entry.id,
        applicability: "applicable",
        implementation: "not_implemented",
      });
      created++;
    }

    return { created, skipped, total: catalogEntries.length };
  });

  return Response.json({ data: result }, { status: 201 });
}
