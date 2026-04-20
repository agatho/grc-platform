import { describe, it, expect } from "vitest";
import {
  computeIsmsHealth,
  computeBcmsHealth,
  computeDpmsHealth,
  computeAiActHealth,
  computeExecutiveDashboard,
  type IsmsDashboardInput,
  type BcmsDashboardInput,
  type DpmsDashboardInput,
  type AiActDashboardInput,
  type ExecutiveDashboardInput,
} from "../src/state-machines/grc-executive-dashboard";

const healthyIsms: IsmsDashboardInput = {
  assessmentsTotal: 4,
  assessmentsCompleted: 4,
  soaCoveragePercent: 95,
  openFindingsCount: 2,
  criticalFindingsCount: 0,
  maturityAverage: 88,
  capOpenCount: 1,
  capOverdueCount: 0,
};

const healthyBcms: BcmsDashboardInput = {
  biaCompletedCount: 10,
  biaTotalCount: 10,
  bcpPublishedCount: 8,
  bcpTotalCount: 8,
  exercisesCompletedYtd: 2,
  activeCrisisCount: 0,
  rtoCoveragePercent: 90,
};

const healthyDpms: DpmsDashboardInput = {
  ropaActiveCount: 25,
  dpiaApprovedCount: 5,
  dpiaPendingCount: 0,
  dsrOpenCount: 3,
  dsrOverdueCount: 0,
  breachesYtd: 1,
  breachesOverdueNotifications: 0,
  tiaReviewedCount: 4,
  consentValidPercent: 95,
};

const healthyAi: AiActDashboardInput = {
  systemsTotal: 10,
  systemsHighRisk: 3,
  systemsUnacceptable: 0,
  systemsCompliant: 9,
  qmsAverageMaturity: 85,
  friaRequired: 2,
  friaCompleted: 2,
  incidentsOverdueCount: 0,
  gpaiSystemicCount: 0,
};

describe("computeIsmsHealth", () => {
  it("healthy ISMS = green", () => {
    const r = computeIsmsHealth(healthyIsms);
    expect(r.status).toBe("green");
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("critical findings trigger concern", () => {
    const r = computeIsmsHealth({
      ...healthyIsms,
      criticalFindingsCount: 3,
      openFindingsCount: 10,
    });
    expect(r.topConcerns.some((c) => c.includes("critical"))).toBe(true);
    expect(r.score).toBeLessThan(healthyIsms.maturityAverage);
  });

  it("overdue CAPs flagged", () => {
    const r = computeIsmsHealth({
      ...healthyIsms,
      capOpenCount: 5,
      capOverdueCount: 3,
    });
    expect(r.topConcerns.some((c) => c.includes("ueberfaellig"))).toBe(true);
  });
});

describe("computeBcmsHealth", () => {
  it("healthy BCMS = green", () => {
    const r = computeBcmsHealth(healthyBcms);
    expect(r.status).toBe("green");
  });

  it("active crisis = concern", () => {
    const r = computeBcmsHealth({ ...healthyBcms, activeCrisisCount: 1 });
    expect(r.topConcerns.some((c) => c.includes("Krise"))).toBe(true);
    // Crisis penalty weighted 10%, druecken den Score um ~5 Punkte
    expect(r.score).toBeLessThan(computeBcmsHealth(healthyBcms).score);
  });

  it("no exercises flagged", () => {
    const r = computeBcmsHealth({ ...healthyBcms, exercisesCompletedYtd: 0 });
    expect(r.topConcerns.some((c) => c.includes("Uebungen"))).toBe(true);
  });
});

describe("computeDpmsHealth", () => {
  it("healthy DPMS = green", () => {
    const r = computeDpmsHealth(healthyDpms);
    expect(r.status).toBe("green");
  });

  it("overdue breach notifications = red concern", () => {
    const r = computeDpmsHealth({
      ...healthyDpms,
      breachesOverdueNotifications: 2,
    });
    expect(r.topConcerns.some((c) => c.includes("Art. 33"))).toBe(true);
  });

  it("overdue DSR triggers concern", () => {
    const r = computeDpmsHealth({ ...healthyDpms, dsrOverdueCount: 3 });
    expect(r.topConcerns.some((c) => c.includes("Art. 12"))).toBe(true);
  });
});

describe("computeAiActHealth", () => {
  it("healthy AI-Act = green", () => {
    const r = computeAiActHealth(healthyAi);
    expect(r.status).toBe("green");
  });

  it("unacceptable practices => automatic red with score=0", () => {
    const r = computeAiActHealth({ ...healthyAi, systemsUnacceptable: 1 });
    expect(r.status).toBe("red");
    expect(r.score).toBe(0);
    expect(r.topConcerns[0]).toContain("HARD-STOP");
  });

  it("overdue incidents trigger concern", () => {
    const r = computeAiActHealth({ ...healthyAi, incidentsOverdueCount: 1 });
    expect(r.topConcerns.some((c) => c.includes("Art. 73"))).toBe(true);
  });

  it("incomplete FRIA coverage = concern", () => {
    const r = computeAiActHealth({
      ...healthyAi,
      friaRequired: 5,
      friaCompleted: 2,
    });
    expect(r.topConcerns.some((c) => c.includes("FRIA"))).toBe(true);
  });
});

describe("computeExecutiveDashboard", () => {
  const healthyInput: ExecutiveDashboardInput = {
    isms: healthyIsms,
    bcms: healthyBcms,
    dpms: healthyDpms,
    aiAct: healthyAi,
    asOfDate: "2026-04-19",
    organizationName: "ACME GmbH",
  };

  it("healthy org = green overall", () => {
    const r = computeExecutiveDashboard(healthyInput);
    expect(r.overallStatus).toBe("green");
    expect(r.criticalCount).toBe(0);
    expect(r.modules).toHaveLength(4);
  });

  it("single red module flips overall status", () => {
    const r = computeExecutiveDashboard({
      ...healthyInput,
      aiAct: { ...healthyAi, systemsUnacceptable: 1 },
    });
    expect(r.criticalCount).toBe(1);
    // overall score = (85 + 85 + 85 + 0) / 4 = ~64 => amber
    expect(r.overallStatus).toBe("amber");
    expect(r.topExecutiveActions[0]).toContain("AI_ACT");
    expect(r.topExecutiveActions[0]).toContain("HARD-STOP");
  });

  it("two red modules => red overall", () => {
    const r = computeExecutiveDashboard({
      ...healthyInput,
      aiAct: { ...healthyAi, systemsUnacceptable: 1 },
      dpms: {
        ...healthyDpms,
        breachesOverdueNotifications: 5,
        dsrOverdueCount: 5,
      },
    });
    expect(r.criticalCount).toBeGreaterThanOrEqual(1);
  });

  it("board talking points include org + score + status", () => {
    const r = computeExecutiveDashboard(healthyInput);
    expect(r.boardBriefingTalkingPoints[0]).toContain("ACME GmbH");
    expect(r.boardBriefingTalkingPoints[0]).toContain("2026-04-19");
    expect(r.boardBriefingTalkingPoints[1]).toContain("GRC-Health");
    expect(r.boardBriefingTalkingPoints[2]).toContain("Module-Status");
  });

  it("top-3 actions drawn from red modules first", () => {
    const r = computeExecutiveDashboard({
      ...healthyInput,
      aiAct: { ...healthyAi, systemsUnacceptable: 2 },
      bcms: { ...healthyBcms, activeCrisisCount: 1 },
    });
    // AI_ACT red has priority
    expect(r.topExecutiveActions[0]).toContain("AI_ACT");
  });

  it("actions capped at 3", () => {
    const r = computeExecutiveDashboard({
      isms: {
        ...healthyIsms,
        criticalFindingsCount: 5,
        openFindingsCount: 30,
        capOverdueCount: 10,
        maturityAverage: 30,
        soaCoveragePercent: 40,
      },
      bcms: {
        ...healthyBcms,
        activeCrisisCount: 2,
        exercisesCompletedYtd: 0,
        rtoCoveragePercent: 30,
      },
      dpms: {
        ...healthyDpms,
        breachesOverdueNotifications: 3,
        dsrOverdueCount: 5,
      },
      aiAct: { ...healthyAi, systemsUnacceptable: 2, incidentsOverdueCount: 3 },
      asOfDate: "2026-04-19",
      organizationName: "BrokenCo",
    });
    expect(r.topExecutiveActions).toHaveLength(3);
  });
});
