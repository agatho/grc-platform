import { db, assetTypeRiskRecommendation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/assets/:id/recommended-risks — Get recommended risks for asset type
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: assetId } = await params;

  // Get asset tier (used as proxy for asset type)
  const assetResult = await db.execute(
    sql`SELECT id, asset_tier, code_group FROM asset
        WHERE id = ${assetId} AND org_id = ${ctx.orgId} AND deleted_at IS NULL LIMIT 1`,
  );

  const targetAsset = assetResult[0];
  if (!targetAsset) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  const assetType = String(
    targetAsset.asset_tier ?? targetAsset.code_group ?? "",
  );
  if (!assetType) {
    return Response.json({ data: [] });
  }

  // Get recommended risks for this asset type
  const recommendations = await db
    .select({
      id: assetTypeRiskRecommendation.id,
      assetType: assetTypeRiskRecommendation.assetType,
      riskCatalogEntryId: assetTypeRiskRecommendation.riskCatalogEntryId,
      isDefaultSelected: assetTypeRiskRecommendation.isDefaultSelected,
    })
    .from(assetTypeRiskRecommendation)
    .where(eq(assetTypeRiskRecommendation.assetType, assetType));

  return Response.json({ data: recommendations });
});
