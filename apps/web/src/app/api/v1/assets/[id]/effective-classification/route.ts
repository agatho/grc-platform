// GET /api/v1/assets/[id]/effective-classification
//
// #WAVE21-MAR-P2-03: the read-side resolver. Returns the effective
// classification per field — override wins where one is active or
// approved, otherwise the BIA-derived value (asset_classification
// row) wins. Surfaces the full provenance so the UI can show
// "BIA-derived (high)" vs "Manually overridden by Alice (very_high)".
//
// Existing readers of asset_classification keep working unchanged
// — this is an additive endpoint. UI consumers that want the
// override-aware view migrate to this path.

import {
  db,
  asset,
  assetClassification,
  assetClassificationOverride,
  user,
} from "@grc/db";
import { and, eq, inArray, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type RouteParams = { params: Promise<{ id: string }> };

const FIELDS = [
  "confidentialityLevel",
  "integrityLevel",
  "availabilityLevel",
  "overallProtection",
] as const;
type Field = (typeof FIELDS)[number];

interface EffectiveField {
  field: Field;
  effective: string;
  source: "override" | "bia_derived" | "default";
  overrideId?: string;
  overrideStatus?: string;
  overriddenBy?: string;
  overriddenByName?: string;
  overriddenAt?: string;
  reason?: string;
}

export const GET = withErrorHandler<RouteParams>(async function GET(
  _req: Request,
  { params },
) {
  const { id } = await params;
  requireUuidParam(id);
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const [assetRow] = await db
    .select({ id: asset.id, name: asset.name })
    .from(asset)
    .where(
      and(
        eq(asset.id, id),
        eq(asset.orgId, ctx.orgId),
        isNull(asset.deletedAt),
      ),
    );

  if (!assetRow) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  const [classification] = await db
    .select()
    .from(assetClassification)
    .where(
      and(
        eq(assetClassification.assetId, id),
        eq(assetClassification.orgId, ctx.orgId),
      ),
    );

  // Active overrides per field. The partial unique index in migration
  // 0325 guarantees ≤1 active row per (asset, field), so the latest-wins
  // ordering is just defence-in-depth.
  const overrides = await db
    .select({
      id: assetClassificationOverride.id,
      fieldName: assetClassificationOverride.fieldName,
      overrideValue: assetClassificationOverride.overrideValue,
      derivedValue: assetClassificationOverride.derivedValue,
      reason: assetClassificationOverride.reason,
      status: assetClassificationOverride.status,
      createdBy: assetClassificationOverride.createdBy,
      createdByName: user.name,
      createdAt: assetClassificationOverride.createdAt,
    })
    .from(assetClassificationOverride)
    .leftJoin(user, eq(assetClassificationOverride.createdBy, user.id))
    .where(
      and(
        eq(assetClassificationOverride.assetId, id),
        eq(assetClassificationOverride.orgId, ctx.orgId),
        inArray(assetClassificationOverride.status, ["active", "approved"]),
      ),
    )
    .orderBy(desc(assetClassificationOverride.createdAt));

  const overrideByField = new Map(overrides.map((o) => [o.fieldName, o]));

  const effective: EffectiveField[] = FIELDS.map((f) => {
    const ov = overrideByField.get(f);
    if (ov) {
      return {
        field: f,
        effective: String(ov.overrideValue),
        source: "override" as const,
        overrideId: ov.id,
        overrideStatus: ov.status,
        overriddenBy: ov.createdBy,
        overriddenByName: ov.createdByName ?? undefined,
        overriddenAt: ov.createdAt.toISOString(),
        reason: ov.reason,
      };
    }
    if (classification) {
      // Cast through unknown — the row's literal types include Date
      // columns that don't fit a flat Record<string,string>; the
      // field-name keys we look up are the C/I/A enums, all strings.
      const value = (classification as unknown as Record<string, string>)[f];
      return {
        field: f,
        effective: value ?? "normal",
        source: "bia_derived" as const,
      };
    }
    return {
      field: f,
      effective: "normal",
      source: "default" as const,
    };
  });

  // Pending overrides surfaced separately so the UI can render
  // "approval pending" badges without affecting the live values.
  const pending = await db
    .select({
      id: assetClassificationOverride.id,
      fieldName: assetClassificationOverride.fieldName,
      overrideValue: assetClassificationOverride.overrideValue,
      reason: assetClassificationOverride.reason,
      createdBy: assetClassificationOverride.createdBy,
      createdAt: assetClassificationOverride.createdAt,
    })
    .from(assetClassificationOverride)
    .where(
      and(
        eq(assetClassificationOverride.assetId, id),
        eq(assetClassificationOverride.orgId, ctx.orgId),
        eq(assetClassificationOverride.status, "pending_approval"),
      ),
    );

  return Response.json({
    data: {
      assetId: id,
      assetName: assetRow.name,
      asOf: new Date().toISOString(),
      effective,
      pendingApprovals: pending,
      hasBiaDerivedClassification: !!classification,
    },
  });
});
