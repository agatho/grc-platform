// Unit tests for Sprint 11 Control Effectiveness Score (CES) Engine
// Tests computeCES, computeResidualScore, computeTrend, isWithinSla

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeCES,
  computeResidualScore,
  computeTrend,
  isWithinSla,
} from "../src/ces";

// ---------------------------------------------------------------------------
// computeCES — test score average
// ---------------------------------------------------------------------------

describe("computeCES — test score average", () => {
  it("returns 100 when all tests are effective (no penalties, manual)", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [
        { result: "effective", executedDate: now.toISOString() },
        { result: "effective", executedDate: now.toISOString() },
      ],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.testScoreAvg).toBe(100);
    expect(result.overduePenalty).toBe(0);
    expect(result.findingPenalty).toBe(0);
    expect(result.automationBonus).toBe(0);
    expect(result.score).toBe(100);
  });

  it("returns 50 when no tests exist", () => {
    const result = computeCES({
      testResults: [],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: null,
    });
    expect(result.testScoreAvg).toBe(50);
  });

  it("returns 50 for partially_effective tests", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [
        { result: "partially_effective", executedDate: now.toISOString() },
        { result: "partially_effective", executedDate: now.toISOString() },
      ],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.testScoreAvg).toBe(50);
  });

  it("returns 0 for all ineffective tests", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [
        { result: "ineffective", executedDate: now.toISOString() },
        { result: "ineffective", executedDate: now.toISOString() },
      ],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.testScoreAvg).toBe(0);
  });

  it("computes average with mix of results", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [
        { result: "effective", executedDate: now.toISOString() }, // 100
        { result: "partially_effective", executedDate: now.toISOString() }, // 50
        { result: "ineffective", executedDate: now.toISOString() }, // 0
      ],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.testScoreAvg).toBe(50); // (100+50+0)/3
  });

  it("only considers last 4 test results", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [
        { result: "effective", executedDate: now.toISOString() },
        { result: "effective", executedDate: now.toISOString() },
        { result: "effective", executedDate: now.toISOString() },
        { result: "effective", executedDate: now.toISOString() },
        { result: "ineffective", executedDate: now.toISOString() }, // should be ignored (5th)
      ],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.testScoreAvg).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeCES — overdue penalty
// ---------------------------------------------------------------------------

describe("computeCES — overdue penalty", () => {
  it("applies 50 penalty when lastTestDate is null (no test ever)", () => {
    const result = computeCES({
      testResults: [],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: null,
    });
    expect(result.overduePenalty).toBe(50);
  });

  it("applies 0 penalty when tested this month", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [{ result: "effective", executedDate: now.toISOString() }],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.overduePenalty).toBe(0);
  });

  it("applies 10 penalty per month overdue", () => {
    // Day-1 anchor verhindert month-end-rollover: an Tagen 29-31 würde
    // setMonth(getMonth() - 2) sonst durch Feb (28 Tage) rollen — z.B. am
    // 29.04. ergibt setMonth(1) ein Datum vom 01.03., monthsDiff=1 statt 2.
    const now = new Date();
    const twoMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 2,
      1,
      12,
      0,
      0,
    );
    const result = computeCES({
      testResults: [
        { result: "effective", executedDate: twoMonthsAgo.toISOString() },
      ],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: twoMonthsAgo.toISOString(),
    });
    expect(result.overduePenalty).toBe(20);
  });

  it("caps overdue penalty at 50", () => {
    const now = new Date();
    const tenMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 10,
      1,
      12,
      0,
      0,
    );
    const result = computeCES({
      testResults: [
        { result: "effective", executedDate: tenMonthsAgo.toISOString() },
      ],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: tenMonthsAgo.toISOString(),
    });
    expect(result.overduePenalty).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// computeCES — finding penalty
// ---------------------------------------------------------------------------

describe("computeCES — finding penalty", () => {
  it("applies 30 for significant_nonconformity", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [{ result: "effective", executedDate: now.toISOString() }],
      openFindings: [{ severity: "significant_nonconformity" }],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.findingPenalty).toBe(30);
  });

  it("applies 15 for insignificant_nonconformity", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [{ result: "effective", executedDate: now.toISOString() }],
      openFindings: [{ severity: "insignificant_nonconformity" }],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.findingPenalty).toBe(15);
  });

  it("applies 5 for improvement_requirement", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [{ result: "effective", executedDate: now.toISOString() }],
      openFindings: [{ severity: "improvement_requirement" }],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.findingPenalty).toBe(5);
  });

  it("sums penalties from multiple findings", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [{ result: "effective", executedDate: now.toISOString() }],
      openFindings: [
        { severity: "significant_nonconformity" },
        { severity: "insignificant_nonconformity" },
        { severity: "improvement_requirement" },
      ],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.findingPenalty).toBe(50); // 30 + 15 + 5
  });

  it("applies 0 for unknown severity", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [{ result: "effective", executedDate: now.toISOString() }],
      openFindings: [{ severity: "observation" }],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.findingPenalty).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeCES — automation bonus
// ---------------------------------------------------------------------------

describe("computeCES — automation bonus", () => {
  it("gives +10 for fully_automated", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [{ result: "effective", executedDate: now.toISOString() }],
      openFindings: [],
      automationLevel: "fully_automated",
      lastTestDate: now.toISOString(),
    });
    expect(result.automationBonus).toBe(10);
  });

  it("gives +5 for semi_automated", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [{ result: "effective", executedDate: now.toISOString() }],
      openFindings: [],
      automationLevel: "semi_automated",
      lastTestDate: now.toISOString(),
    });
    expect(result.automationBonus).toBe(5);
  });

  it("gives 0 for manual", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [{ result: "effective", executedDate: now.toISOString() }],
      openFindings: [],
      automationLevel: "manual",
      lastTestDate: now.toISOString(),
    });
    expect(result.automationBonus).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeCES — clamping
// ---------------------------------------------------------------------------

describe("computeCES — clamping", () => {
  it("clamps score to minimum of 0", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [{ result: "ineffective", executedDate: now.toISOString() }],
      openFindings: [
        { severity: "significant_nonconformity" },
        { severity: "significant_nonconformity" },
      ],
      automationLevel: "manual",
      lastTestDate: null,
    });
    expect(result.score).toBe(0);
  });

  it("clamps score to maximum of 100", () => {
    const now = new Date();
    const result = computeCES({
      testResults: [
        { result: "effective", executedDate: now.toISOString() },
        { result: "effective", executedDate: now.toISOString() },
      ],
      openFindings: [],
      automationLevel: "fully_automated",
      lastTestDate: now.toISOString(),
    });
    // testAvg=100, overdue=0, finding=0, auto=+10 => 110 => clamped to 100
    expect(result.score).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeResidualScore
// ---------------------------------------------------------------------------

describe("computeResidualScore", () => {
  it("returns inherent score when no linked controls", () => {
    const result = computeResidualScore(80, []);
    expect(result).toBe(80);
  });

  it("returns 0 when avgCES is 100", () => {
    const result = computeResidualScore(80, [100]);
    expect(result).toBe(0);
  });

  it("returns inherent score when avgCES is 0", () => {
    const result = computeResidualScore(80, [0]);
    expect(result).toBe(80);
  });

  it("computes correctly with multiple CES values", () => {
    // avgCES = (80+60)/2 = 70, residual = 80 * (1 - 70/100) = 80 * 0.3 = 24
    const result = computeResidualScore(80, [80, 60]);
    expect(result).toBe(24);
  });

  it("rounds the result", () => {
    // avgCES = 33, residual = 100 * (1 - 33/100) = 100 * 0.67 = 67
    const result = computeResidualScore(100, [33]);
    expect(result).toBe(67);
  });

  it("handles single CES value of 50", () => {
    // residual = 100 * (1 - 50/100) = 100 * 0.5 = 50
    const result = computeResidualScore(100, [50]);
    expect(result).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// computeTrend
// ---------------------------------------------------------------------------

describe("computeTrend", () => {
  it("returns stable when previous is null", () => {
    expect(computeTrend(80, null)).toBe("stable");
  });

  it("returns improving when delta >= 5", () => {
    expect(computeTrend(80, 75)).toBe("improving");
  });

  it("returns improving when delta is exactly 5", () => {
    expect(computeTrend(75, 70)).toBe("improving");
  });

  it("returns declining when delta <= -5", () => {
    expect(computeTrend(70, 75)).toBe("declining");
  });

  it("returns declining when delta is exactly -5", () => {
    expect(computeTrend(70, 75)).toBe("declining");
  });

  it("returns stable when delta is 4", () => {
    expect(computeTrend(74, 70)).toBe("stable");
  });

  it("returns stable when delta is -4", () => {
    expect(computeTrend(70, 74)).toBe("stable");
  });

  it("returns stable when delta is 0", () => {
    expect(computeTrend(80, 80)).toBe("stable");
  });

  it("returns improving for large positive delta", () => {
    expect(computeTrend(100, 0)).toBe("improving");
  });

  it("returns declining for large negative delta", () => {
    expect(computeTrend(0, 100)).toBe("declining");
  });
});

// ---------------------------------------------------------------------------
// isWithinSla
// ---------------------------------------------------------------------------

describe("isWithinSla", () => {
  it("returns true when resolved within SLA", () => {
    const created = "2026-03-01T00:00:00Z";
    const resolved = "2026-03-10T00:00:00Z";
    expect(isWithinSla(created, resolved, 30)).toBe(true);
  });

  it("returns false when resolved outside SLA", () => {
    const created = "2026-01-01T00:00:00Z";
    const resolved = "2026-06-01T00:00:00Z";
    expect(isWithinSla(created, resolved, 30)).toBe(false);
  });

  it("returns true when resolved exactly at SLA boundary minus 1ms", () => {
    const created = "2026-03-01T00:00:00Z";
    // 29 days, 23 hours, 59 minutes, 59 seconds < 30 days
    const resolved = "2026-03-30T23:59:59Z";
    expect(isWithinSla(created, resolved, 30)).toBe(true);
  });

  it("returns true for unresolved finding still within SLA", () => {
    const now = new Date();
    const created = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    expect(isWithinSla(created.toISOString(), null, 30)).toBe(true);
  });

  it("returns false for unresolved finding outside SLA", () => {
    const now = new Date();
    const created = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    expect(isWithinSla(created.toISOString(), null, 30)).toBe(false);
  });

  it("returns true for 1 day SLA resolved same day", () => {
    const created = "2026-03-15T08:00:00Z";
    const resolved = "2026-03-15T20:00:00Z";
    expect(isWithinSla(created, resolved, 1)).toBe(true);
  });

  it("returns false for 1 day SLA resolved after 2 days", () => {
    const created = "2026-03-15T08:00:00Z";
    const resolved = "2026-03-17T08:00:00Z";
    expect(isWithinSla(created, resolved, 1)).toBe(false);
  });
});
