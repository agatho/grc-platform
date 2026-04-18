import { describe, it, expect } from "vitest";
import {
  assessLoggingCapability,
  assessHumanOversight,
  assessOversightLogQuality,
  assessDeployerCompliance,
  assessTransparencyCoverage,
  type LoggingCapabilityContext,
  type HumanOversightDesign,
  type OversightLogStats,
  type DeployerDutyContext,
  type TransparencyContext,
} from "../src/state-machines/aiact-oversight";

describe("assessLoggingCapability", () => {
  const full: LoggingCapabilityContext = {
    hasAutomaticLogging: true,
    loggedCategories: [
      "input_data",
      "output_decision",
      "user_interaction",
      "performance_metric",
      "incident",
      "model_version_change",
    ],
    logRetentionDays: 365,
    tamperEvidentStorage: true,
    logsExportable: true,
  };

  it("meets all requirements", () => {
    const r = assessLoggingCapability(full);
    expect(r.meetsMinimumRequirement).toBe(true);
    expect(r.coveragePercent).toBe(100);
    expect(r.issues).toHaveLength(0);
  });

  it("fails if automatic logging disabled", () => {
    const r = assessLoggingCapability({ ...full, hasAutomaticLogging: false });
    expect(r.meetsMinimumRequirement).toBe(false);
    expect(r.issues.some((i) => i.includes("Automatic logging disabled"))).toBe(true);
  });

  it("flags retention < 180d", () => {
    const r = assessLoggingCapability({ ...full, logRetentionDays: 90 });
    expect(r.meetsMinimumRequirement).toBe(false);
    expect(r.issues.some((i) => i.includes("90d"))).toBe(true);
  });

  it("flags missing categories", () => {
    const r = assessLoggingCapability({
      ...full,
      loggedCategories: ["input_data", "output_decision"],
    });
    expect(r.missingCategories).toContain("user_interaction");
    expect(r.missingCategories).toContain("incident");
    expect(r.coveragePercent).toBe(33);
  });

  it("flags non-tamper-evident", () => {
    const r = assessLoggingCapability({ ...full, tamperEvidentStorage: false });
    expect(r.meetsMinimumRequirement).toBe(false);
  });
});

describe("assessHumanOversight", () => {
  const full: HumanOversightDesign = {
    hasUnderstandableOutputs: true,
    hasOverrideCapability: true,
    hasStopFunction: true,
    hasAutomationBiasTraining: true,
    hasDefinedRoles: true,
    assignedOversightPersonnel: 3,
    oversightFrequency: "continuous",
  };

  it("adequate full design", () => {
    const r = assessHumanOversight(full);
    expect(r.isAdequate).toBe(true);
    expect(r.designCompleteness).toBe(100);
    expect(r.gaps).toHaveLength(0);
  });

  it("flags single-person-oversight warning", () => {
    const r = assessHumanOversight({ ...full, assignedOversightPersonnel: 1 });
    expect(r.warnings.some((w) => w.includes("Single-Person"))).toBe(true);
    expect(r.isAdequate).toBe(true); // noch adequate aber mit warning
  });

  it("zero personnel => not adequate", () => {
    const r = assessHumanOversight({ ...full, assignedOversightPersonnel: 0 });
    expect(r.isAdequate).toBe(false);
  });

  it("oversightFrequency=none violates Art. 14", () => {
    const r = assessHumanOversight({ ...full, oversightFrequency: "none" });
    expect(r.isAdequate).toBe(false);
    expect(r.warnings.some((w) => w.includes("Art. 14"))).toBe(true);
  });

  it("missing stop-function", () => {
    const r = assessHumanOversight({ ...full, hasStopFunction: false });
    expect(r.gaps).toContain("stop_function");
    expect(r.isAdequate).toBe(false);
  });
});

describe("assessOversightLogQuality", () => {
  it("dormant when no logs", () => {
    const stats: OversightLogStats = {
      totalLogs: 0,
      overrideCount: 0,
      interventionCount: 0,
      monitoringCheckCount: 0,
      highRiskLogsCount: 0,
      daysSinceLastLog: null,
    };
    const r = assessOversightLogQuality(stats);
    expect(r.activityLevel).toBe("dormant");
    expect(r.warnings.some((w) => w.includes("Nachweis fehlt"))).toBe(true);
  });

  it("high activity", () => {
    const r = assessOversightLogQuality({
      totalLogs: 50,
      overrideCount: 5,
      interventionCount: 10,
      monitoringCheckCount: 30,
      highRiskLogsCount: 5,
      daysSinceLastLog: 2,
    });
    expect(r.activityLevel).toBe("high");
    expect(r.hasRecentActivity).toBe(true);
    expect(r.overrideRate).toBe(0.1);
  });

  it("flags override-rate > 50%", () => {
    const r = assessOversightLogQuality({
      totalLogs: 10,
      overrideCount: 6,
      interventionCount: 2,
      monitoringCheckCount: 2,
      highRiskLogsCount: 0,
      daysSinceLastLog: 5,
    });
    expect(r.overrideRate).toBe(0.6);
    expect(r.warnings.some((w) => w.includes("Modell-Review"))).toBe(true);
  });

  it("flags old activity", () => {
    const r = assessOversightLogQuality({
      totalLogs: 10,
      overrideCount: 0,
      interventionCount: 0,
      monitoringCheckCount: 10,
      highRiskLogsCount: 0,
      daysSinceLastLog: 120,
    });
    expect(r.hasRecentActivity).toBe(false);
    expect(r.warnings.some((w) => w.includes("90 Tage"))).toBe(true);
  });
});

describe("assessDeployerCompliance", () => {
  const full: DeployerDutyContext = {
    implementsHumanOversight: true,
    followsProviderInstructions: true,
    monitorsInputDataQuality: true,
    hasMonitoringProcess: true,
    hasReportingChannelToProvider: true,
    informsAffectedPersons: true,
    dpiaCompletedIfRequired: true,
    retainsLogs: true,
    dpiaRequired: true,
  };

  it("fully compliant", () => {
    const r = assessDeployerCompliance(full);
    expect(r.isCompliant).toBe(true);
    expect(r.compliancePercent).toBe(100);
    expect(r.criticalGaps).toHaveLength(0);
  });

  it("missing human oversight = critical", () => {
    const r = assessDeployerCompliance({ ...full, implementsHumanOversight: false });
    expect(r.isCompliant).toBe(false);
    expect(r.criticalGaps).toContain("human_oversight");
  });

  it("dpia required but not done = critical", () => {
    const r = assessDeployerCompliance({
      ...full,
      dpiaRequired: true,
      dpiaCompletedIfRequired: false,
    });
    expect(r.criticalGaps).toContain("dpia_if_required");
  });

  it("dpia NOT required => no dpia gap", () => {
    const r = assessDeployerCompliance({
      ...full,
      dpiaRequired: false,
      dpiaCompletedIfRequired: false,
    });
    expect(r.gaps).not.toContain("dpia_if_required");
  });

  it("missing affected-persons info = non-critical gap", () => {
    const r = assessDeployerCompliance({ ...full, informsAffectedPersons: false });
    expect(r.gaps).toContain("affected_persons_info");
    expect(r.criticalGaps).not.toContain("affected_persons_info");
  });
});

describe("assessTransparencyCoverage", () => {
  it("fully covered", () => {
    const ctx: TransparencyContext = {
      applicableObligations: ["ai_interaction_disclosure", "deepfake_marking"],
      implementedDisclosures: ["ai_interaction_disclosure", "deepfake_marking"],
      disclosureMethod: "pre_interaction",
      userCanAcknowledge: true,
    };
    const r = assessTransparencyCoverage(ctx);
    expect(r.isCompliant).toBe(true);
    expect(r.coveragePercent).toBe(100);
    expect(r.missing).toHaveLength(0);
  });

  it("no applicable obligations => compliant", () => {
    const r = assessTransparencyCoverage({
      applicableObligations: [],
      implementedDisclosures: [],
      disclosureMethod: null,
      userCanAcknowledge: false,
    });
    expect(r.coveragePercent).toBe(100);
    expect(r.isCompliant).toBe(true);
  });

  it("missing obligation", () => {
    const r = assessTransparencyCoverage({
      applicableObligations: ["ai_interaction_disclosure", "deepfake_marking"],
      implementedDisclosures: ["ai_interaction_disclosure"],
      disclosureMethod: "pre_interaction",
      userCanAcknowledge: true,
    });
    expect(r.missing).toContain("deepfake_marking");
    expect(r.coveragePercent).toBe(50);
    expect(r.isCompliant).toBe(false);
  });

  it("post_interaction method inadequate", () => {
    const r = assessTransparencyCoverage({
      applicableObligations: ["ai_interaction_disclosure"],
      implementedDisclosures: ["ai_interaction_disclosure"],
      disclosureMethod: "post_interaction",
      userCanAcknowledge: true,
    });
    expect(r.methodAppropriate).toBe(false);
    expect(r.isCompliant).toBe(false);
  });
});
