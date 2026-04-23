// Sprint 11: Control Effectiveness Score (CES) Engine
// Pure computation functions — no DB dependencies

/**
 * Compute the Control Effectiveness Score (CES) for a single control.
 *
 * Formula: CES = MAX(0, MIN(100, ROUND(testAvg - overduePenalty - findingPenalty + autoBonus)))
 */
export function computeCES(params: {
  testResults: Array<{ result: string; executedDate: string }>;
  openFindings: Array<{ severity: string }>;
  automationLevel: string;
  lastTestDate: string | null;
}): {
  score: number;
  testScoreAvg: number;
  overduePenalty: number;
  findingPenalty: number;
  automationBonus: number;
} {
  // testAvg: last 4 tests (effective=100, partial=50, ineffective=0), avg. No tests = 50.
  const recent = params.testResults.slice(0, 4);
  const testScoreAvg =
    recent.length === 0
      ? 50
      : recent.reduce((sum, t) => {
          if (t.result === "effective") return sum + 100;
          if (t.result === "partially_effective") return sum + 50;
          return sum; // ineffective = 0
        }, 0) / recent.length;

  // overduePenalty: months since lastTest * 10, max 50
  let overduePenalty = 0;
  if (params.lastTestDate) {
    const lastTest = new Date(params.lastTestDate);
    const now = new Date();
    const monthsDiff =
      (now.getFullYear() - lastTest.getFullYear()) * 12 +
      (now.getMonth() - lastTest.getMonth());
    overduePenalty = Math.min(Math.max(0, monthsDiff) * 10, 50);
  } else {
    // No test ever performed — full penalty
    overduePenalty = 50;
  }

  // findingPenalty nach ISO 19011 § 3.4 — major=-30, minor=-15, OFI=-5.
  // Legacy-Werte (significant_/insignificant_nonconformity, improvement_requirement)
  // werden als Synonym behandelt damit Bestandsdaten den gleichen Score liefern.
  const findingPenalty = params.openFindings.reduce((sum, f) => {
    if (
      f.severity === "major_nonconformity" ||
      f.severity === "significant_nonconformity"
    ) {
      return sum + 30;
    }
    if (
      f.severity === "minor_nonconformity" ||
      f.severity === "insignificant_nonconformity"
    ) {
      return sum + 15;
    }
    if (
      f.severity === "opportunity_for_improvement" ||
      f.severity === "improvement_requirement"
    ) {
      return sum + 5;
    }
    // observation / recommendation / positive / conforming: kein Penalty
    return sum;
  }, 0);

  // autoBonus: fully_automated=+10, semi_automated=+5, manual=0
  let automationBonus = 0;
  if (params.automationLevel === "fully_automated") automationBonus = 10;
  else if (params.automationLevel === "semi_automated") automationBonus = 5;

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        testScoreAvg - overduePenalty - findingPenalty + automationBonus,
      ),
    ),
  );

  return {
    score,
    testScoreAvg,
    overduePenalty,
    findingPenalty,
    automationBonus,
  };
}

/**
 * Compute residual risk score from inherent score and linked control CES values.
 *
 * Formula: residual = ROUND(inherentScore * (1 - avgCES / 100))
 */
export function computeResidualScore(
  inherentScore: number,
  linkedCES: number[],
): number {
  if (linkedCES.length === 0) return inherentScore;
  const avgCES = linkedCES.reduce((a, b) => a + b, 0) / linkedCES.length;
  return Math.round(inherentScore * (1 - avgCES / 100));
}

/**
 * Determine trend direction from current vs previous CES score.
 * Delta >= 5 = improving, delta <= -5 = declining, else stable.
 */
export function computeTrend(
  current: number,
  previous: number | null,
): "improving" | "stable" | "declining" {
  if (previous === null || previous === undefined) return "stable";
  const delta = current - previous;
  if (delta >= 5) return "improving";
  if (delta <= -5) return "declining";
  return "stable";
}

/**
 * Check whether a finding is within its SLA window.
 *
 * If not resolved: check if (now - createdAt) < slaDays
 * If resolved: check if (resolvedAt - createdAt) < slaDays
 */
export function isWithinSla(
  createdAt: string,
  resolvedAt: string | null,
  slaDays: number,
): boolean {
  const created = new Date(createdAt);
  const slaDaysMs = slaDays * 24 * 60 * 60 * 1000;

  if (resolvedAt) {
    const resolved = new Date(resolvedAt);
    return resolved.getTime() - created.getTime() < slaDaysMs;
  }

  return Date.now() - created.getTime() < slaDaysMs;
}
