// GET /api/v1/assets/[id]/transitions
//
// #WAVE11-ASSET-TRANSITIONS: deferred from Wave 11 with the
// "stateless by design" tag. Asset has no `status` column — only
// `asset_tier` (business_structure | primary_asset | supporting_asset)
// which is a classification, not a lifecycle state. Asset removal is
// modelled via the `deletedAt` soft-delete timestamp; no "decommissioned"
// or "retired" mid-state exists.
//
// Returning an explicit stateless discovery payload (rather than a
// 404) gives every UI consumer a uniform shape: every entity has a
// /transitions endpoint, the entities that genuinely have no
// lifecycle just say so. Less special-case logic in the front-end.

import { db, asset } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<RouteParams>(async function GET(
  _req: Request,
  { params },
) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  requireUuidParam(id);

  const [row] = await db
    .select({ id: asset.id, assetTier: asset.assetTier })
    .from(asset)
    .where(
      and(
        eq(asset.id, id),
        eq(asset.orgId, ctx.orgId),
        isNull(asset.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      current: null,
      allowedNext: [],
      stateless: true,
      classification: row.assetTier,
      knownClassifications: [
        "business_structure",
        "primary_asset",
        "supporting_asset",
      ],
      reclassifyEndpoint: `/api/v1/assets/${id}`,
      reclassifyMethod: "PUT",
      note: "Asset is stateless by design — `asset_tier` is a classification, not a lifecycle. Use the PUT endpoint to reclassify; soft-delete via DELETE for retirement.",
    },
  });
});
