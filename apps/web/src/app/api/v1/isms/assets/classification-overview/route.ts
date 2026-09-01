import { db, asset, assetClassification } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { z } from "zod";
import { parseQueryParams } from "@/lib/query-schema";

// GET /api/v1/isms/assets/classification-overview
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
  // against a schema instead of being read as `string | null` and cast
  // with `as <enum>`. An unknown filter value used to reach Postgres and
  // surface as a 500 (`invalid input value for enum …`); it is a 422 now,
  // and free-text search terms are length-bounded.
  const classificationOverviewQuerySchema = z.object({
    protection: z.string().trim().min(1).max(40).optional(),
    tier: z.string().trim().min(1).max(40).optional(),
  });

  const { searchParams } = paginate(req);
  const q = parseQueryParams(classificationOverviewQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const protectionFilter = q.data.protection ?? null;
  const tierFilter = q.data.tier ?? null;

  // Left join assets with classifications
  const rows = await db
    .select({
      id: asset.id,
      name: asset.name,
      assetTier: asset.assetTier,
      description: asset.description,
      classificationId: assetClassification.id,
      confidentialityLevel: assetClassification.confidentialityLevel,
      integrityLevel: assetClassification.integrityLevel,
      availabilityLevel: assetClassification.availabilityLevel,
      overallProtection: assetClassification.overallProtection,
      classifiedAt: assetClassification.classifiedAt,
      reviewDate: assetClassification.reviewDate,
    })
    .from(asset)
    .leftJoin(
      assetClassification,
      and(
        eq(asset.id, assetClassification.assetId),
        eq(assetClassification.orgId, ctx.orgId),
      ),
    )
    .where(and(eq(asset.orgId, ctx.orgId), isNull(asset.deletedAt)));

  let filtered = rows;

  if (protectionFilter && protectionFilter !== "__all__") {
    if (protectionFilter === "unclassified") {
      filtered = filtered.filter((r) => !r.classificationId);
    } else {
      filtered = filtered.filter(
        (r) => r.overallProtection === protectionFilter,
      );
    }
  }

  if (tierFilter && tierFilter !== "__all__") {
    filtered = filtered.filter((r) => r.assetTier === tierFilter);
  }

  return Response.json({ data: filtered, total: filtered.length });
}
