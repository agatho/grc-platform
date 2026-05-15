// Server-side cascade runner for the BIA → Asset-Classification
// derivation. Wraps the pure-function cascade
// (packages/shared/src/cascades/bia-asset-criticality.ts) with the
// Drizzle queries the route handlers need.
//
// #WAVE21-MAR-P2-03: factored out so /start and /finalize don't
// duplicate the snapshot-load + upsert logic.

import {
  db,
  asset,
  assetClassification,
  biaProcessImpact,
  processAsset,
} from "@grc/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { deriveAssetClassifications, type ProtectionLevel } from "@grc/shared";

export interface CascadeResult {
  assetsTouched: number;
  assetsUpserted: number;
  reason: string;
}

/**
 * Run the BIA → Asset-Classification cascade for a single BIA. Loads
 * the BIA's process_impact rows + each linked asset, derives the per-
 * asset protection level, and upserts asset_classification.
 *
 * The override system sits at READ time in
 * /assets/[id]/effective-classification, NOT at write time — the
 * cascade always writes the BIA-derived value. This keeps the BIA
 * snapshot authoritative; operator overrides remain the documented,
 * auditable correction layer on top.
 */
export async function runBiaToAssetCascade(opts: {
  tx: typeof db;
  orgId: string;
  biaAssessmentId: string;
  userId: string;
  trigger: "start" | "finalize";
}): Promise<CascadeResult> {
  const { tx, orgId, biaAssessmentId, userId, trigger } = opts;

  // 1. Load this BIA's process impacts.
  const impacts = await tx
    .select({
      processId: biaProcessImpact.processId,
      priorityRanking: biaProcessImpact.priorityRanking,
      isEssential: biaProcessImpact.isEssential,
    })
    .from(biaProcessImpact)
    .where(
      and(
        eq(biaProcessImpact.biaAssessmentId, biaAssessmentId),
        eq(biaProcessImpact.orgId, orgId),
      ),
    );

  if (impacts.length === 0) {
    return {
      assetsTouched: 0,
      assetsUpserted: 0,
      reason: `BIA has no process impacts — nothing to cascade (trigger: ${trigger}).`,
    };
  }

  // 2. Resolve linked assets via process_asset.
  const processIds = impacts.map((i) => i.processId);
  const links = await tx
    .select({
      processId: processAsset.processId,
      assetId: processAsset.assetId,
    })
    .from(processAsset)
    .where(
      and(
        eq(processAsset.orgId, orgId),
        inArray(processAsset.processId, processIds),
      ),
    );

  if (links.length === 0) {
    return {
      assetsTouched: 0,
      assetsUpserted: 0,
      reason: `BIA's processes have no asset links — nothing to cascade.`,
    };
  }

  // 3. Pure derivation.
  const derived = deriveAssetClassifications(impacts, links);

  // 4. Filter out assets that are soft-deleted or belong to another org.
  const assetIds = derived.map((d) => d.assetId);
  const validAssets = await tx
    .select({ id: asset.id })
    .from(asset)
    .where(
      and(
        eq(asset.orgId, orgId),
        isNull(asset.deletedAt),
        inArray(asset.id, assetIds),
      ),
    );
  const validIds = new Set(validAssets.map((a) => a.id));
  const upsertable = derived.filter((d) => validIds.has(d.assetId));

  // 5. Upsert per asset. Drizzle doesn't expose a one-shot `ON CONFLICT
  //    DO UPDATE` for our column-per-field layout in a single statement,
  //    so we loop. Asset counts per org are typically O(100s); the
  //    round-trips are fine.
  let upserted = 0;
  for (const d of upsertable) {
    const protectionLevel: ProtectionLevel = d.protectionLevel;
    const [existing] = await tx
      .select({ id: assetClassification.id })
      .from(assetClassification)
      .where(
        and(
          eq(assetClassification.assetId, d.assetId),
          eq(assetClassification.orgId, orgId),
        ),
      );

    if (existing) {
      await tx
        .update(assetClassification)
        .set({
          // The BIA cascade conservatively raises every CIA dimension
          // to the same protection level — operators can refine via
          // overrides for the specific dimension that needs to differ.
          confidentialityLevel: protectionLevel,
          integrityLevel: protectionLevel,
          availabilityLevel: protectionLevel,
          overallProtection: protectionLevel,
          confidentialityReason: d.reason,
          integrityReason: d.reason,
          availabilityReason: d.reason,
          updatedAt: new Date(),
        })
        .where(eq(assetClassification.id, existing.id));
    } else {
      await tx.insert(assetClassification).values({
        orgId,
        assetId: d.assetId,
        confidentialityLevel: protectionLevel,
        integrityLevel: protectionLevel,
        availabilityLevel: protectionLevel,
        overallProtection: protectionLevel,
        confidentialityReason: d.reason,
        integrityReason: d.reason,
        availabilityReason: d.reason,
        classifiedBy: userId,
      });
    }
    upserted += 1;
  }

  return {
    assetsTouched: upsertable.length,
    assetsUpserted: upserted,
    reason: `BIA ${biaAssessmentId} ${trigger} → cascade upserted ${upserted} asset_classification row(s).`,
  };
}
