// Sprint 24: NIS2 Compliance Computation Utilities
// Pure functions for computing NIS2 requirement status and readiness scores

import {
  NIS2_ART21_REQUIREMENTS,
  type NIS2RequirementStatus,
  type NIS2RequirementDef,
} from "./schemas/nis2-certification";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ControlWithCES {
  annexARef: string;
  ces: number;
  hasEvidence: boolean;
}

export interface NIS2RequirementResult {
  id: string;
  article: string;
  chapter: string;
  nameDE: string;
  nameEN: string;
  descriptionDE: string;
  descriptionEN: string;
  status: NIS2RequirementStatus;
  avgCES: number;
  controlCount: number;
  missingControls: string[];
  evidenceComplete: boolean;
  weight: number;
  isoMapping: string[];
}

export interface NIS2OverallScore {
  score: number;
  compliantCount: number;
  partiallyCompliantCount: number;
  nonCompliantCount: number;
  totalRequirements: number;
  requirements: NIS2RequirementResult[];
}

export interface CertReadinessCheckResult {
  id: string;
  labelDE: string;
  labelEN: string;
  category: string;
  passed: boolean;
  details?: string;
}

export interface CertReadinessResult {
  score: number;
  checks: CertReadinessCheckResult[];
  passedCount: number;
  totalChecks: number;
}

// ──────────────────────────────────────────────────────────────
// NIS2 Requirement Status Computation (pure function)
// ──────────────────────────────────────────────────────────────

export function computeRequirementStatus(
  controls: ControlWithCES[],
): NIS2RequirementStatus {
  if (controls.length === 0) return "non_compliant";
  const avgCES =
    controls.reduce((sum, c) => sum + c.ces, 0) / controls.length;
  const evidenceComplete = controls.every((c) => c.hasEvidence);
  if (avgCES >= 80 && evidenceComplete) return "compliant";
  if (avgCES >= 50) return "partially_compliant";
  return "non_compliant";
}

export function findMissingControls(
  isoMapping: string[],
  existingControls: { annexARef: string }[],
): string[] {
  const existingRefs = new Set(existingControls.map((c) => c.annexARef));
  return isoMapping.filter((ref) => !existingRefs.has(ref));
}

// ──────────────────────────────────────────────────────────────
// Compute status for a single NIS2 requirement
// ──────────────────────────────────────────────────────────────

export function computeSingleRequirement(
  req: NIS2RequirementDef,
  controls: ControlWithCES[],
): NIS2RequirementResult {
  const avgCES =
    controls.length > 0
      ? Math.round(
          controls.reduce((sum, c) => sum + c.ces, 0) / controls.length,
        )
      : 0;
  const evidenceComplete =
    controls.length > 0 && controls.every((c) => c.hasEvidence);
  const status = computeRequirementStatus(controls);
  const missingControls = findMissingControls(
    req.isoMapping,
    controls,
  );

  return {
    id: req.id,
    article: req.article,
    chapter: req.chapter,
    nameDE: req.nameDE,
    nameEN: req.nameEN,
    descriptionDE: req.descriptionDE,
    descriptionEN: req.descriptionEN,
    status,
    avgCES,
    controlCount: controls.length,
    missingControls,
    evidenceComplete,
    weight: req.weight,
    isoMapping: req.isoMapping,
  };
}

// ──────────────────────────────────────────────────────────────
// Compute overall NIS2 readiness score (weighted)
// ──────────────────────────────────────────────────────────────

export function computeNIS2OverallScore(
  requirements: NIS2RequirementResult[],
): number {
  const totalWeight = requirements.reduce((sum, r) => sum + r.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedScore = requirements.reduce((sum, r) => {
    const statusScore =
      r.status === "compliant" ? 100 : r.status === "partially_compliant" ? 50 : 0;
    return sum + (statusScore * r.weight) / totalWeight;
  }, 0);

  return Math.round(weightedScore);
}

// ──────────────────────────────────────────────────────────────
// Compute certification readiness score
// ──────────────────────────────────────────────────────────────

export function computeCertReadinessScore(
  checks: CertReadinessCheckResult[],
): CertReadinessResult {
  const passedCount = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;
  const score = totalChecks > 0 ? Math.round((passedCount / totalChecks) * 100) : 0;

  return { score, checks, passedCount, totalChecks };
}

// ──────────────────────────────────────────────────────────────
// Estimate weeks to readiness based on historical closure rate
// ──────────────────────────────────────────────────────────────

export function estimateWeeksToReadiness(
  openGaps: number,
  closedLastMonth: number,
): number | null {
  if (openGaps === 0) return 0;
  if (closedLastMonth <= 0) return null; // Cannot estimate
  const weeksPerGap = 4 / closedLastMonth; // 4 weeks in a month
  return Math.ceil(openGaps * weeksPerGap);
}

// Re-export requirement definitions
export { NIS2_ART21_REQUIREMENTS };
