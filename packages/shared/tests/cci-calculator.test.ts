import { describe, it, expect } from "vitest";
import {
  calculateWeightedCCI,
  normalizeFactors,
  normalizeFactor,
  detectTrend,
  validateWeights,
  calcPercentageScore,
  calcIncidentResponseScore,
  buildCCIResult,
  getPeriodString,
  getPreviousPeriod,
  getPeriodRange,
  getTopImprovementAreas,
  DEFAULT_CCI_WEIGHTS,
  CCI_FACTOR_KEYS,
} from "../src/cci/calculator";
import type {
  CCIFactorScores,
  CCIFactorWeights,
  CCIRawMetrics,
} from "../src/types/compliance-culture";

describe("CCICalculator", () => {
  const defaultFactors: CCIFactorScores = {
    task_compliance: 80,
    policy_ack_rate: 70,
    training_completion: 90,
    incident_response_time: 60,
    audit_finding_closure: 75,
    self_assessment_participation: 85,
  };

  const defaultWeights: CCIFactorWeights = {
    task_compliance: 0.2,
    policy_ack_rate: 0.15,
    training_completion: 0.15,
    incident_response_time: 0.2,
    audit_finding_closure: 0.15,
    self_assessment_participation: 0.15,
  };

  it("should calculate weighted CCI from 6 factors", () => {
    const result = calculateWeightedCCI(defaultFactors, defaultWeights);
    // 80*0.20 + 70*0.15 + 90*0.15 + 60*0.20 + 75*0.15 + 85*0.15 = 76.0
    expect(result).toBeCloseTo(76.0, 1);
  });

  it("should return 0 when all factors are 0", () => {
    const zeroFactors: CCIFactorScores = {
      task_compliance: 0,
      policy_ack_rate: 0,
      training_completion: 0,
      incident_response_time: 0,
      audit_finding_closure: 0,
      self_assessment_participation: 0,
    };
    expect(calculateWeightedCCI(zeroFactors, defaultWeights)).toBe(0);
  });

  it("should return 100 when all factors are 100", () => {
    const perfectFactors: CCIFactorScores = {
      task_compliance: 100,
      policy_ack_rate: 100,
      training_completion: 100,
      incident_response_time: 100,
      audit_finding_closure: 100,
      self_assessment_participation: 100,
    };
    expect(calculateWeightedCCI(perfectFactors, defaultWeights)).toBe(100);
  });

  it("should normalize factors to 0-100 range", () => {
    const outOfRange: Partial<CCIFactorScores> = {
      task_compliance: 150,
      policy_ack_rate: -10,
      training_completion: 50,
    };
    const normalized = normalizeFactors(outOfRange);
    expect(normalized.task_compliance).toBe(100);
    expect(normalized.policy_ack_rate).toBe(0);
    expect(normalized.training_completion).toBe(50);
  });

  it("should normalize individual factor", () => {
    expect(normalizeFactor(150)).toBe(100);
    expect(normalizeFactor(-20)).toBe(0);
    expect(normalizeFactor(50)).toBe(50);
  });
});

describe("detectTrend", () => {
  it("should detect upward trend", () => {
    expect(detectTrend(76.0, 72.5)).toBe("up");
  });

  it("should detect downward trend", () => {
    expect(detectTrend(70.0, 73.0)).toBe("down");
  });

  it("should detect stable when delta < 1", () => {
    expect(detectTrend(75.0, 75.2)).toBe("stable");
    expect(detectTrend(75.0, 74.5)).toBe("stable");
  });

  it("should return stable when previous is null", () => {
    expect(detectTrend(76.0, null)).toBe("stable");
    expect(detectTrend(76.0, undefined)).toBe("stable");
  });
});

describe("validateWeights", () => {
  it("should validate weights that sum to 1.0", () => {
    expect(validateWeights(DEFAULT_CCI_WEIGHTS)).toBe(true);
  });

  it("should reject weights that do not sum to 1.0", () => {
    const invalid: Partial<CCIFactorWeights> = {
      task_compliance: 0.5,
      policy_ack_rate: 0.5,
      training_completion: 0.15,
      incident_response_time: 0.2,
      audit_finding_closure: 0.15,
      self_assessment_participation: 0.15,
    };
    expect(validateWeights(invalid)).toBe(false);
  });

  it("should reject negative weights", () => {
    const negative: Partial<CCIFactorWeights> = {
      task_compliance: -0.1,
      policy_ack_rate: 1.1,
      training_completion: 0,
      incident_response_time: 0,
      audit_finding_closure: 0,
      self_assessment_participation: 0,
    };
    expect(validateWeights(negative)).toBe(false);
  });

  it("should reject incomplete weights", () => {
    const incomplete: Partial<CCIFactorWeights> = {
      task_compliance: 0.5,
      policy_ack_rate: 0.5,
    };
    expect(validateWeights(incomplete)).toBe(false);
  });
});

describe("calcPercentageScore", () => {
  it("should calculate percentage correctly", () => {
    expect(calcPercentageScore(100, 85)).toBe(85);
  });

  it("should return 100 when total is 0 (no violations)", () => {
    expect(calcPercentageScore(0, 0)).toBe(100);
  });

  it("should handle 100% completion", () => {
    expect(calcPercentageScore(50, 50)).toBe(100);
  });

  it("should handle 0% completion", () => {
    expect(calcPercentageScore(50, 0)).toBe(0);
  });
});

describe("calcIncidentResponseScore", () => {
  it("should calculate score based on response time vs target", () => {
    // 24h response, 48h target = (1 - 24/48) * 100 = 50
    expect(calcIncidentResponseScore(24, 48)).toBe(50);
  });

  it("should return 100 for 0 response hours", () => {
    expect(calcIncidentResponseScore(0, 48)).toBe(100);
  });

  it("should return 0 for very slow response", () => {
    expect(calcIncidentResponseScore(96, 48)).toBe(0);
  });

  it("should cap at 100", () => {
    expect(calcIncidentResponseScore(-10, 48)).toBe(100);
  });
});

describe("getPeriodString", () => {
  it("should format date as YYYY-MM", () => {
    expect(getPeriodString(new Date(2026, 2, 15))).toBe("2026-03");
    expect(getPeriodString(new Date(2026, 0, 1))).toBe("2026-01");
    expect(getPeriodString(new Date(2026, 11, 31))).toBe("2026-12");
  });
});

describe("getPreviousPeriod", () => {
  it("should return previous month", () => {
    expect(getPreviousPeriod("2026-03")).toBe("2026-02");
    expect(getPreviousPeriod("2026-01")).toBe("2025-12");
  });
});

describe("getPeriodRange", () => {
  it("should return start and end of month", () => {
    const { start, end } = getPeriodRange("2026-03");
    expect(start.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("should handle December correctly", () => {
    const { start, end } = getPeriodRange("2026-12");
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("getTopImprovementAreas", () => {
  it("should return top-3 lowest scoring factors", () => {
    const areas = getTopImprovementAreas({
      task_compliance: 80,
      policy_ack_rate: 70,
      training_completion: 90,
      incident_response_time: 60,
      audit_finding_closure: 75,
      self_assessment_participation: 85,
    });
    expect(areas).toHaveLength(3);
    expect(areas[0].key).toBe("incident_response_time");
    expect(areas[0].score).toBe(60);
    expect(areas[1].key).toBe("policy_ack_rate");
    expect(areas[2].key).toBe("audit_finding_closure");
  });

  it("should return fewer than 3 when requested", () => {
    const areas = getTopImprovementAreas(
      {
        task_compliance: 80,
        policy_ack_rate: 70,
        training_completion: 90,
        incident_response_time: 60,
        audit_finding_closure: 75,
        self_assessment_participation: 85,
      },
      1,
    );
    expect(areas).toHaveLength(1);
  });
});

describe("buildCCIResult", () => {
  it("should build complete result from raw metrics", () => {
    const rawMetrics: CCIRawMetrics = {
      task_compliance: { total: 100, successful: 85 },
      policy_ack_rate: { total: 50, successful: 35 },
      training_completion: { total: 80, successful: 72 },
      incident_response_time: { total: 10, successful: 8 },
      audit_finding_closure: { total: 20, successful: 15 },
      self_assessment_participation: { total: 30, successful: 27 },
    };

    const result = buildCCIResult(rawMetrics, DEFAULT_CCI_WEIGHTS, 24, 70);

    expect(result.overall).toBeGreaterThan(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.factors.task_compliance).toBe(85);
    expect(result.factors.policy_ack_rate).toBe(70);
    expect(result.factors.incident_response_time).toBe(50); // (1 - 24/48) * 100
    expect(result.trend).toBeDefined();
    expect(result.weights).toEqual(DEFAULT_CCI_WEIGHTS);
  });

  it("should handle no data period (all zeros = 100)", () => {
    const emptyMetrics: CCIRawMetrics = {
      task_compliance: { total: 0, successful: 0 },
      policy_ack_rate: { total: 0, successful: 0 },
      training_completion: { total: 0, successful: 0 },
      incident_response_time: { total: 0, successful: 0 },
      audit_finding_closure: { total: 0, successful: 0 },
      self_assessment_participation: { total: 0, successful: 0 },
    };

    const result = buildCCIResult(emptyMetrics, DEFAULT_CCI_WEIGHTS, 0, null);
    // All factors return 100 when no data, incident response 100 for 0 hours
    expect(result.overall).toBe(100);
    expect(result.trend).toBe("stable");
  });
});
