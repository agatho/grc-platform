// BIA → Asset-Classification cascade
//
// #WAVE21-MAR-P2-03: Cowork QA's Wave-19 marathon flagged that the
// platform stored BIA process_impact rows but didn't propagate the
// derived asset criticality into asset_classification. ISO 22301 §8.2
// + ISO 27005 §6.4 expect the BIA to be the authoritative source for
// asset criticality — operators shouldn't have to manually copy
// values across.
//
// This module is the pure-function cascade: it takes a snapshot of
// (bia_process_impact rows × process_asset links) for an org and
// returns the asset_classification rows the caller should upsert.
// The caller (BIA /start + /finalize) wraps the upsert in the same
// transaction as the BIA-status transition so the cascade is
// atomic.
//
// The override system (asset_classification_override) sits in front
// of the cascade at READ time, not write time — the cascade always
// writes the BIA-derived value to asset_classification; the
// effective-classification resolver is what surfaces the override.

// Re-export the shared ISMS protection-level type so cascade
// consumers don't need to know it lives in types/isms.ts. Naming
// stays uniform with packages/db/src/schema/isms.ts.
import type { ProtectionLevel } from "../types/isms";
export type { ProtectionLevel };

export interface BiaImpactInput {
  /** bia_process_impact.processId */
  processId: string;
  /** bia_process_impact.priorityRanking (1-5+, lower = more critical) */
  priorityRanking: number | null;
  /** bia_process_impact.isEssential — true marks the process as essential. */
  isEssential: boolean;
}

export interface ProcessAssetLink {
  processId: string;
  assetId: string;
}

export interface DerivedAssetClassification {
  assetId: string;
  /** The single most-critical priority across all linked processes. */
  drivingPriority: number | null;
  drivingProcessId: string;
  isEssential: boolean;
  protectionLevel: ProtectionLevel;
  reason: string;
}

/**
 * Map a BIA priority ranking to an ISMS protection level.
 *
 * Per the design call:
 *   priorityRanking 1     → very_high  (mission-critical)
 *   priorityRanking 2-3   → high       (important)
 *   priorityRanking 4-5+  → normal     (supporting)
 *
 * isEssential=true without a priorityRanking falls through to `high`
 * as a defensive default — an essential process by definition can't
 * be `normal`.
 */
export function priorityToProtectionLevel(
  priorityRanking: number | null,
  isEssential: boolean,
): ProtectionLevel {
  if (priorityRanking !== null) {
    if (priorityRanking <= 1) return "very_high";
    if (priorityRanking <= 3) return "high";
    return "normal";
  }
  if (isEssential) return "high";
  return "normal";
}

/**
 * Compute the BIA-derived classification for every asset linked to a
 * process in the BIA. The "max wins" rule applies: if an asset is
 * touched by multiple processes, the most critical one drives its
 * classification.
 */
export function deriveAssetClassifications(
  impacts: BiaImpactInput[],
  links: ProcessAssetLink[],
): DerivedAssetClassification[] {
  // Index impacts by process for O(1) lookup.
  const impactByProcess = new Map<string, BiaImpactInput>();
  for (const impact of impacts) {
    impactByProcess.set(impact.processId, impact);
  }

  // Group links by asset. Find the most critical impact per asset.
  const byAsset = new Map<string, DerivedAssetClassification>();
  for (const link of links) {
    const impact = impactByProcess.get(link.processId);
    if (!impact) continue;

    const candidate: DerivedAssetClassification = {
      assetId: link.assetId,
      drivingPriority: impact.priorityRanking,
      drivingProcessId: link.processId,
      isEssential: impact.isEssential,
      protectionLevel: priorityToProtectionLevel(
        impact.priorityRanking,
        impact.isEssential,
      ),
      reason: `BIA-derived: process ${link.processId} priorityRanking=${impact.priorityRanking ?? "n/a"}, isEssential=${impact.isEssential}`,
    };

    const existing = byAsset.get(link.assetId);
    if (!existing) {
      byAsset.set(link.assetId, candidate);
      continue;
    }

    // "Max wins": lower priorityRanking number = more critical. Treat
    // null as the bottom rung (least critical) so a scored process
    // beats an unscored-but-essential one only on the protection-level
    // tiebreaker, not on the rank.
    const candidateScore =
      candidate.drivingPriority ?? Number.POSITIVE_INFINITY;
    const existingScore = existing.drivingPriority ?? Number.POSITIVE_INFINITY;
    if (candidateScore < existingScore) {
      byAsset.set(link.assetId, candidate);
    } else if (candidateScore === existingScore) {
      // Same priority → essential beats non-essential.
      if (candidate.isEssential && !existing.isEssential) {
        byAsset.set(link.assetId, candidate);
      }
    }
  }

  return Array.from(byAsset.values());
}
