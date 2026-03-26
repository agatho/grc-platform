import { db, asset, assetClassification } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/isms/assets/classification-overview
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { searchParams } = paginate(req);
  const protectionFilter = searchParams.get("protection");
  const tierFilter = searchParams.get("tier");

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
    .where(
      and(
        eq(asset.orgId, ctx.orgId),
        isNull(asset.deletedAt),
      ),
    );

  let filtered = rows;

  if (protectionFilter && protectionFilter !== "__all__") {
    if (protectionFilter === "unclassified") {
      filtered = filtered.filter((r) => !r.classificationId);
    } else {
      filtered = filtered.filter((r) => r.overallProtection === protectionFilter);
    }
  }

  if (tierFilter && tierFilter !== "__all__") {
    filtered = filtered.filter((r) => r.assetTier === tierFilter);
  }

  return Response.json({ data: filtered, total: filtered.length });
}
