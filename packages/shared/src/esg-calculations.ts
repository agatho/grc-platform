// Sprint 10: ESG/CSRD Calculation Helpers

export interface MaterialityTopicInput {
  id: string;
  topicName: string;
  esrsStandard: string;
  impactScore: number;
  financialScore: number;
  isMaterial?: boolean | null;
}

export interface MaterialityTopicResult extends MaterialityTopicInput {
  quadrant: "high_impact_high_financial" | "high_impact_low_financial" | "low_impact_high_financial" | "low_impact_low_financial";
  isMaterial: boolean;
}

/**
 * Compute materiality matrix: sort topics by combined score,
 * assign quadrant labels, and determine materiality.
 * Topics with both scores >= 5.0 are considered material.
 */
export function computeMaterialityMatrix(
  topics: MaterialityTopicInput[],
): MaterialityTopicResult[] {
  const impactThreshold = 5.0;
  const financialThreshold = 5.0;

  return topics
    .map((topic) => {
      const highImpact = topic.impactScore >= impactThreshold;
      const highFinancial = topic.financialScore >= financialThreshold;

      let quadrant: MaterialityTopicResult["quadrant"];
      if (highImpact && highFinancial) {
        quadrant = "high_impact_high_financial";
      } else if (highImpact && !highFinancial) {
        quadrant = "high_impact_low_financial";
      } else if (!highImpact && highFinancial) {
        quadrant = "low_impact_high_financial";
      } else {
        quadrant = "low_impact_low_financial";
      }

      const isMaterial = highImpact || highFinancial;

      return { ...topic, quadrant, isMaterial };
    })
    .sort((a, b) => {
      const scoreA = a.impactScore + a.financialScore;
      const scoreB = b.impactScore + b.financialScore;
      return scoreB - scoreA;
    });
}

/**
 * Calculate CO2-equivalent emissions from activity data and emission factor.
 * @param activityData - Amount of activity (e.g., kWh, liters, km)
 * @param emissionFactor - CO2e per unit of activity (e.g., kgCO2e/kWh)
 * @returns CO2e in the same unit as the emission factor
 */
export function calculateEmissions(
  activityData: number,
  emissionFactor: number,
): number {
  if (activityData < 0 || emissionFactor < 0) {
    throw new Error("Activity data and emission factor must be non-negative");
  }
  return Math.round(activityData * emissionFactor * 1000) / 1000;
}

export interface TargetProgressResult {
  percentComplete: number;
  status: "on_track" | "at_risk" | "off_track" | "achieved";
  remainingReduction: number;
  currentReduction: number;
}

/**
 * Compute progress toward a reduction/improvement target.
 * Works for both reduction targets (target < baseline) and
 * increase targets (target > baseline).
 */
export function computeTargetProgress(
  baseline: number,
  current: number,
  target: number,
): TargetProgressResult {
  const totalChange = target - baseline;

  // Avoid division by zero
  if (totalChange === 0) {
    return {
      percentComplete: 100,
      status: "achieved",
      remainingReduction: 0,
      currentReduction: current - baseline,
    };
  }

  const currentChange = current - baseline;
  const percentComplete = Math.round((currentChange / totalChange) * 100 * 100) / 100;
  const clamped = Math.min(Math.max(percentComplete, 0), 100);
  const remainingReduction = target - current;

  let status: TargetProgressResult["status"];
  if (clamped >= 100) {
    status = "achieved";
  } else if (clamped >= 60) {
    status = "on_track";
  } else if (clamped >= 30) {
    status = "at_risk";
  } else {
    status = "off_track";
  }

  return {
    percentComplete: clamped,
    status,
    remainingReduction,
    currentReduction: currentChange,
  };
}
