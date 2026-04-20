// Sprint 23: Board KPIs — Pure computation functions (no DB dependencies)

import type {
  ModuleAssuranceData,
  AssuranceFactors,
  AssuranceRecommendation,
  PostureData,
  PostureFactors,
} from "./types/board-kpi";

// ──────────────────────────────────────────────────────────────
// Risk Appetite helpers
// ──────────────────────────────────────────────────────────────

export function isAppetiteBreach(params: {
  residualScore: number;
  maxResidualScore: number;
}): boolean {
  return params.residualScore > params.maxResidualScore;
}

export function computeBreachDelta(
  residualScore: number,
  maxResidualScore: number,
): number {
  return Math.max(0, residualScore - maxResidualScore);
}

// ──────────────────────────────────────────────────────────────
// Assurance Confidence Score
// ──────────────────────────────────────────────────────────────

const DEFAULT_ASSURANCE_WEIGHTS: Record<keyof AssuranceFactors, number> = {
  evidenceAge: 0.25,
  testCoverage: 0.25,
  dataQuality: 0.2,
  assessmentSource: 0.15,
  automationLevel: 0.15,
};

export function computeAssuranceScore(
  _module: string,
  data: ModuleAssuranceData,
  weights: Record<keyof AssuranceFactors, number> = DEFAULT_ASSURANCE_WEIGHTS,
): {
  score: number;
  factors: AssuranceFactors;
  recommendations: AssuranceRecommendation[];
} {
  // Evidence age: 100 at 0 days, 0 at 365+ days
  const evidenceAge = Math.max(0, 100 - data.avgEvidenceAgeDays / 3.65);

  // Test coverage: % of controls tested
  const testCoverage =
    data.totalControls > 0
      ? (data.testedControls / data.totalControls) * 100
      : 0;

  // Data quality: ratio of measured vs estimated
  const totalMeasurable = data.measuredCount + data.estimatedCount;
  const dataQuality =
    totalMeasurable > 0 ? (data.measuredCount / totalMeasurable) * 100 : 0;

  // Assessment source: 3rd line weighted highest
  const assessmentSource =
    data.thirdLinePercent * 1.0 +
    data.secondLinePercent * 0.7 +
    data.firstLinePercent * 0.4;

  // Automation level: % of auto-collected evidence
  const automationLevel =
    data.totalEvidence > 0
      ? (data.autoCollectedEvidence / data.totalEvidence) * 100
      : 0;

  const factors: AssuranceFactors = {
    evidenceAge,
    testCoverage,
    dataQuality,
    assessmentSource,
    automationLevel,
  };

  const score = Math.round(
    Object.entries(factors).reduce(
      (sum, [k, v]) => sum + v * (weights[k as keyof AssuranceFactors] ?? 0),
      0,
    ),
  );

  // Generate recommendations for weak factors
  const recommendations: AssuranceRecommendation[] = [];
  if (evidenceAge < 60) {
    recommendations.push({
      action: "Evidenz aktualisieren",
      impactPercent: Math.round((60 - evidenceAge) * weights.evidenceAge),
    });
  }
  if (testCoverage < 80) {
    recommendations.push({
      action: "Offene Control-Tests durchführen",
      impactPercent: Math.round((80 - testCoverage) * weights.testCoverage),
    });
  }
  if (dataQuality < 70) {
    recommendations.push({
      action: "Schätzwerte durch Messungen ersetzen",
      impactPercent: Math.round((70 - dataQuality) * weights.dataQuality),
    });
  }
  if (assessmentSource < 50) {
    recommendations.push({
      action: "Bewertungen durch 2nd/3rd Line durchführen",
      impactPercent: Math.round(
        (50 - assessmentSource) * weights.assessmentSource,
      ),
    });
  }
  if (automationLevel < 60) {
    recommendations.push({
      action: "Automatisierte Evidenzerhebung einrichten",
      impactPercent: Math.round(
        (60 - automationLevel) * weights.automationLevel,
      ),
    });
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    factors,
    recommendations,
  };
}

// ──────────────────────────────────────────────────────────────
// Security Posture Score
// ──────────────────────────────────────────────────────────────

const DEFAULT_POSTURE_WEIGHTS: Record<keyof PostureFactors, number> = {
  assetCoverage: 0.15,
  maturity: 0.2,
  ces: 0.2,
  vulnExposure: 0.15,
  incidentTTR: 0.1,
  freshness: 0.1,
  soaCompleteness: 0.1,
};

export function computeSecurityPosture(
  data: PostureData,
  weights: Record<keyof PostureFactors, number> = DEFAULT_POSTURE_WEIGHTS,
): {
  score: number;
  factors: PostureFactors;
} {
  const assetCoverage =
    data.totalAssets > 0 ? (data.assetsWithPRQ / data.totalAssets) * 100 : 0;

  const maturity = (data.avgMaturity / 5) * 100;

  const ces = data.avgCES;

  const vulnExposure = Math.max(
    0,
    100 - data.criticalVulns * 20 - data.highVulns * 10,
  );

  const incidentTTR = Math.max(0, 100 - data.avgTTRDays * 2);

  const freshness = Math.max(0, 100 - data.avgAssessmentAgeDays / 3.65);

  const soaCompleteness =
    data.totalAnnexAControls > 0
      ? (data.assessedControls / data.totalAnnexAControls) * 100
      : 0;

  const factors: PostureFactors = {
    assetCoverage,
    maturity,
    ces,
    vulnExposure,
    incidentTTR,
    freshness,
    soaCompleteness,
  };

  const score = Math.round(
    Object.entries(factors).reduce(
      (sum, [k, v]) => sum + v * (weights[k as keyof PostureFactors] ?? 0),
      0,
    ),
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    factors,
  };
}

// ──────────────────────────────────────────────────────────────
// Trend helper
// ──────────────────────────────────────────────────────────────

export function computeScoreTrend(
  current: number,
  previous: number | null,
): "improving" | "stable" | "declining" {
  if (previous === null) return "stable";
  const delta = current - previous;
  if (delta > 3) return "improving";
  if (delta < -3) return "declining";
  return "stable";
}
