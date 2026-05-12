// #WAVE6-CROSS-02: which assets are exposed to this risk?
// Joins risk_asset + asset.

import { db, asset, riskAsset } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  requireUuidParam(id);

  const rows = await db
    .select({
      id: asset.id,
      name: asset.name,
      assetTier: asset.assetTier,
      protectionGoalClass: asset.protectionGoalClass,
      contactPerson: asset.contactPerson,
      linkedAt: riskAsset.createdAt,
    })
    .from(riskAsset)
    .innerJoin(asset, eq(riskAsset.assetId, asset.id))
    .where(
      and(
        eq(riskAsset.orgId, ctx.orgId),
        eq(riskAsset.riskId, id),
        isNull(asset.deletedAt),
      ),
    )
    .orderBy(desc(riskAsset.createdAt));

  return Response.json({ data: rows, total: rows.length });
});
