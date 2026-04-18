import { describe, it, expect } from "vitest";
import {
  determineFriaRequirement,
  assessFriaQuality,
  classifyIncidentDeadline,
  checkIncidentOverdue,
  type FriaDetermination,
  type FriaQualityInput,
  type IncidentClassification,
  type IncidentStatus,
} from "../src/state-machines/aiact-fria-incident";

describe("determineFriaRequirement", () => {
  const baseline: FriaDetermination = {
    riskClassification: "high",
    deployerType: "private_sector",
    annexIIICategory: null,
    isCreditScoring: false,
    isLifeHealthInsurance: false,
    isLawEnforcement: false,
  };

  it("public sector + high risk => mandatory", () => {
    const r = determineFriaRequirement({ ...baseline, deployerType: "public_sector" });
    expect(r.isFriaRequired).toBe(true);
    expect(r.recommendationLevel).toBe("mandatory");
  });

  it("credit scoring => mandatory", () => {
    const r = determineFriaRequirement({ ...baseline, isCreditScoring: true });
    expect(r.isFriaRequired).toBe(true);
  });

  it("law enforcement => mandatory", () => {
    const r = determineFriaRequirement({ ...baseline, isLawEnforcement: true });
    expect(r.isFriaRequired).toBe(true);
  });

  it("high-risk private sector, generic => recommended", () => {
    const r = determineFriaRequirement(baseline);
    expect(r.isFriaRequired).toBe(false);
    expect(r.recommendationLevel).toBe("recommended");
  });

  it("limited risk => not required", () => {
    const r = determineFriaRequirement({ ...baseline, riskClassification: "limited" });
    expect(r.isFriaRequired).toBe(false);
    expect(r.recommendationLevel).toBe("not_required");
  });
});

describe("assessFriaQuality", () => {
  const fullRights: FriaQualityInput = {
    rightsAssessed: [
      { right: "dignity", impact: "low", mitigation: "m", residualRisk: "low" },
      { right: "equality_non_discrimination", impact: "medium", mitigation: "m", residualRisk: "low" },
      { right: "privacy_data_protection", impact: "low", mitigation: "m", residualRisk: "low" },
      { right: "access_to_justice", impact: "low", mitigation: "m", residualRisk: "low" },
      { right: "workers_rights", impact: "low", mitigation: "m", residualRisk: "low" },
    ],
    hasDiscriminationAnalysis: true,
    hasDataProtectionImpact: true,
    hasAccessToJusticeAnalysis: true,
    hasAffectedPersonsConsultation: true,
    hasOverallImpactStatement: true,
    hasMitigationMeasuresDocumented: true,
  };

  it("approvable with 5 rights + all checks + no high residual", () => {
    const r = assessFriaQuality(fullRights);
    expect(r.isApprovable).toBe(true);
    expect(r.qualityChecksPercent).toBe(100);
    expect(r.rightsCoverage).toBe(50);
  });

  it("high residual risk blocks approval", () => {
    const r = assessFriaQuality({
      ...fullRights,
      rightsAssessed: [
        { right: "dignity", impact: "high", mitigation: "m", residualRisk: "high" },
        ...fullRights.rightsAssessed.slice(1),
      ],
    });
    expect(r.hasHighResidualRisk).toBe(true);
    expect(r.highResidualRights).toContain("dignity");
    expect(r.isApprovable).toBe(false);
  });

  it("< 5 rights blocks approval", () => {
    const r = assessFriaQuality({
      ...fullRights,
      rightsAssessed: fullRights.rightsAssessed.slice(0, 3),
    });
    expect(r.isApprovable).toBe(false);
  });

  it("missing quality check blocks approval", () => {
    const r = assessFriaQuality({ ...fullRights, hasDiscriminationAnalysis: false });
    expect(r.missing).toContain("discrimination_analysis");
    expect(r.isApprovable).toBe(false);
  });
});

describe("classifyIncidentDeadline", () => {
  const detectedAt = new Date("2026-04-18T10:00:00Z");
  const noIncident: IncidentClassification = {
    resultedInDeath: false,
    resultedInSeriousHealthDamage: false,
    isWidespreadInfringement: false,
    violatesUnionLaw: false,
    affectsCriticalInfrastructure: false,
    affectedPersonsCount: 0,
  };

  it("death => immediate_2d", () => {
    const r = classifyIncidentDeadline({ ...noIncident, resultedInDeath: true }, detectedAt);
    expect(r.deadlineCategory).toBe("immediate_2d");
    expect(r.notificationDeadlineDays).toBe(2);
  });

  it("serious health damage => immediate_2d", () => {
    const r = classifyIncidentDeadline(
      { ...noIncident, resultedInSeriousHealthDamage: true },
      detectedAt,
    );
    expect(r.deadlineCategory).toBe("immediate_2d");
  });

  it("widespread => 2d", () => {
    const r = classifyIncidentDeadline(
      { ...noIncident, isWidespreadInfringement: true, affectedPersonsCount: 5 },
      detectedAt,
    );
    expect(r.deadlineCategory).toBe("widespread_2d");
    expect(r.notificationDeadlineDays).toBe(2);
  });

  it("> 100 affected persons => 2d (widespread)", () => {
    const r = classifyIncidentDeadline(
      { ...noIncident, affectedPersonsCount: 150 },
      detectedAt,
    );
    expect(r.deadlineCategory).toBe("widespread_2d");
  });

  it("union-law violation => 15d serious", () => {
    const r = classifyIncidentDeadline(
      { ...noIncident, violatesUnionLaw: true },
      detectedAt,
    );
    expect(r.deadlineCategory).toBe("serious_15d");
    expect(r.notificationDeadlineDays).toBe(15);
  });

  it("nothing triggers => not reportable", () => {
    const r = classifyIncidentDeadline(noIncident, detectedAt);
    expect(r.deadlineCategory).toBe("not_reportable");
    expect(r.isSerious).toBe(false);
  });
});

describe("checkIncidentOverdue", () => {
  it("notified => not overdue", () => {
    const now = new Date("2026-04-18T12:00:00Z");
    const status: IncidentStatus = {
      detectedAt: new Date("2026-04-16T10:00:00Z"),
      authorityNotifiedAt: new Date("2026-04-17T15:00:00Z"),
      deadlineAt: new Date("2026-04-18T10:00:00Z"),
      isSerious: true,
    };
    const r = checkIncidentOverdue(status, now);
    expect(r.isNotified).toBe(true);
    expect(r.isOverdue).toBe(false);
    expect(r.escalationLevel).toBe("none");
  });

  it("not notified + deadline in 12h => approaching", () => {
    const now = new Date("2026-04-18T00:00:00Z");
    const status: IncidentStatus = {
      detectedAt: new Date("2026-04-16T00:00:00Z"),
      authorityNotifiedAt: null,
      deadlineAt: new Date("2026-04-18T12:00:00Z"),
      isSerious: true,
    };
    const r = checkIncidentOverdue(status, now);
    expect(r.escalationLevel).toBe("approaching");
    expect(r.hoursUntilDeadline).toBe(12);
  });

  it("not notified + 10h overdue => overdue", () => {
    const now = new Date("2026-04-18T22:00:00Z");
    const status: IncidentStatus = {
      detectedAt: new Date("2026-04-16T00:00:00Z"),
      authorityNotifiedAt: null,
      deadlineAt: new Date("2026-04-18T12:00:00Z"),
      isSerious: true,
    };
    const r = checkIncidentOverdue(status, now);
    expect(r.isOverdue).toBe(true);
    expect(r.hoursOverdue).toBe(10);
    expect(r.escalationLevel).toBe("overdue");
  });

  it("> 48h overdue => critical_overdue", () => {
    const now = new Date("2026-04-21T15:00:00Z");
    const status: IncidentStatus = {
      detectedAt: new Date("2026-04-16T00:00:00Z"),
      authorityNotifiedAt: null,
      deadlineAt: new Date("2026-04-18T12:00:00Z"),
      isSerious: true,
    };
    const r = checkIncidentOverdue(status, now);
    expect(r.escalationLevel).toBe("critical_overdue");
    expect(r.hoursOverdue).toBeGreaterThan(48);
  });

  it("deadline in 3 days => no escalation", () => {
    const now = new Date("2026-04-18T10:00:00Z");
    const status: IncidentStatus = {
      detectedAt: new Date("2026-04-18T10:00:00Z"),
      authorityNotifiedAt: null,
      deadlineAt: new Date("2026-04-21T10:00:00Z"),
      isSerious: true,
    };
    const r = checkIncidentOverdue(status, now);
    expect(r.escalationLevel).toBe("none");
    expect(r.hoursUntilDeadline).toBe(72);
  });
});
