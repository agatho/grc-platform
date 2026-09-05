import {
  db,
  soaEntry,
  catalogEntry,
  controlCatalogEntry,
  soaApplicabilityEnum,
  soaImplementationEnum,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext, paginate } from "@/lib/api";
import { syncSoaEntryToProgramme } from "@grc/db";
import { z } from "zod";
import { parseQueryParams, searchQueryParam } from "@/lib/query-schema";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { log } from "@/lib/logger";

// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const soaListQuerySchema = z.object({
  applicability: z.enum(soaApplicabilityEnum.enumValues).optional(),
  implementation: z.enum(soaImplementationEnum.enumValues).optional(),
  search: searchQueryParam,
});

// GET /api/v1/isms/soa
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(soaListQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const applicabilityFilter = q.data.applicability ?? null;
  const implementationFilter = q.data.implementation ?? null;
  const search = q.data.search ?? null;

  const conditions: ReturnType<typeof eq>[] = [eq(soaEntry.orgId, ctx.orgId)];
  if (applicabilityFilter) {
    conditions.push(
      eq(
        soaEntry.applicability,
        applicabilityFilter as
          "applicable" | "not_applicable" | "partially_applicable",
      ),
    );
  }
  if (implementationFilter) {
    conditions.push(
      eq(
        soaEntry.implementation,
        implementationFilter as
          | "implemented"
          | "partially_implemented"
          | "planned"
          | "not_implemented",
      ),
    );
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
    .leftJoin(
      controlCatalogEntry,
      eq(soaEntry.catalogEntryId, controlCatalogEntry.id),
    );

  if (search) {
    conditions.push(
      sql`(${controlCatalogEntry.titleDe} ilike ${"%" + search + "%"} or ${controlCatalogEntry.titleEn} ilike ${"%" + search + "%"} or ${controlCatalogEntry.code} ilike ${"%" + search + "%"})`,
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
    .leftJoin(
      controlCatalogEntry,
      eq(soaEntry.catalogEntryId, controlCatalogEntry.id),
    )
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
  const implementationPct =
    applicableCount > 0
      ? Math.round((stats.implemented / applicableCount) * 100)
      : 0;

  return Response.json({
    data: rows,
    stats: { ...stats, implementationPercentage: implementationPct },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
// POST /api/v1/isms/soa — generate SoA from ISO 27002 catalog (idempotent)
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await withAuditContext(ctx, async (tx) => {
    // Get all control catalog entries from ISO 27002 catalogs
    const catalogEntries = await tx
      .select({ id: catalogEntry.id })
      .from(catalogEntry)
      .where(eq(catalogEntry.status, "active"));

    let created = 0;
    let skipped = 0;
    const insertedIds: string[] = [];

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

      const [row] = await tx
        .insert(soaEntry)
        .values({
          orgId: ctx.orgId,
          catalogEntryId: entry.id,
          applicability: "applicable",
          implementation: "not_implemented",
        })
        .returning({ id: soaEntry.id });
      insertedIds.push(row.id);
      created++;
    }

    return {
      created,
      skipped,
      total: catalogEntries.length,
      insertedIds,
    };
  });

  // Project newly-created SoA entries into the active ISO 27001 journey.
  // Runs outside the audit-context tx so a missing journey or sync failure
  // never aborts the SoA inserts themselves.
  let synced = 0;
  for (const id of result.insertedIds) {
    try {
      const r = await syncSoaEntryToProgramme(db, ctx.orgId, id, ctx.userId);
      if (r.subtaskAction === "created" || r.subtaskAction === "updated") {
        synced++;
      }
    } catch (err) {
      log.error("[soa POST] programme sync failed", { soaEntryId: id, err });
    }
  }

  return Response.json(
    {
      data: {
        created: result.created,
        skipped: result.skipped,
        total: result.total,
        programmeSubtasksCreated: synced,
      },
    },
    { status: 201 },
  );
});
