// AI-Act Logging + Human-Oversight + Transparency (Art. 12, 14, 26, 50)
//
// Referenz: docs/assessment-plans/04-aiact-assessment-plan.md §4.1-4.3.

// ─── Art. 12 Auto-Logging Capabilities ────────────────────────

export type LogCategory =
  | "input_data"
  | "output_decision"
  | "user_interaction"
  | "performance_metric"
  | "incident"
  | "model_version_change";

export interface LoggingCapabilityContext {
  /** System hat automatische Log-Erzeugung */
  hasAutomaticLogging: boolean;
  /** Kategorien die geloggt werden */
  loggedCategories: LogCategory[];
  /** Retention-Periode fuer Logs in Tagen */
  logRetentionDays: number;
  /** Logs sind tamper-evident (Hash-Chain / WORM) */
  tamperEvidentStorage: boolean;
  /** Logs sind exportierbar fuer Authorities */
  logsExportable: boolean;
}

export interface LoggingCapabilityResult {
  coveragePercent: number;
  meetsMinimumRequirement: boolean;
  missingCategories: LogCategory[];
  issues: string[];
}

const REQUIRED_LOG_CATEGORIES: LogCategory[] = [
  "input_data",
  "output_decision",
  "user_interaction",
  "performance_metric",
  "incident",
  "model_version_change",
];

const MIN_LOG_RETENTION_DAYS = 180; // 6 Monate Minimum fuer High-Risk

export function assessLoggingCapability(ctx: LoggingCapabilityContext): LoggingCapabilityResult {
  const missing = REQUIRED_LOG_CATEGORIES.filter((c) => !ctx.loggedCategories.includes(c));
  const coveragePercent = Math.round(
    ((REQUIRED_LOG_CATEGORIES.length - missing.length) / REQUIRED_LOG_CATEGORIES.length) * 100,
  );

  const issues: string[] = [];
  if (!ctx.hasAutomaticLogging) issues.push("Automatic logging disabled -- Art. 12 violation.");
  if (ctx.logRetentionDays < MIN_LOG_RETENTION_DAYS) {
    issues.push(`Retention ${ctx.logRetentionDays}d < ${MIN_LOG_RETENTION_DAYS}d minimum.`);
  }
  if (!ctx.tamperEvidentStorage) issues.push("Logs not tamper-evident.");
  if (!ctx.logsExportable) issues.push("Logs not exportable for authorities.");
  if (missing.length > 0) issues.push(`Missing log categories: ${missing.join(", ")}.`);

  const meetsMinimumRequirement =
    ctx.hasAutomaticLogging &&
    ctx.logRetentionDays >= MIN_LOG_RETENTION_DAYS &&
    ctx.tamperEvidentStorage &&
    ctx.logsExportable &&
    missing.length === 0;

  return { coveragePercent, meetsMinimumRequirement, missingCategories: missing, issues };
}

// ─── Art. 14 Human-Oversight Design ───────────────────────────
//
// Art. 14 verlangt:
// - Verstaendliche Output-Interpretation
// - Moeglichkeit zum Override
// - Stop-Funktion
// - Nicht-Automation-Bias-Training fuer Oversight-Personal
// - Klare Rollen

export interface HumanOversightDesign {
  hasUnderstandableOutputs: boolean;
  hasOverrideCapability: boolean;
  hasStopFunction: boolean;
  hasAutomationBiasTraining: boolean;
  hasDefinedRoles: boolean;
  assignedOversightPersonnel: number; // Wie viele Personen sind qualifiziert
  oversightFrequency: "continuous" | "periodic" | "on_demand" | "none";
}

export interface OversightAssessment {
  designCompleteness: number; // 0-100
  isAdequate: boolean;
  gaps: string[];
  warnings: string[];
}

export function assessHumanOversight(design: HumanOversightDesign): OversightAssessment {
  const checks: Array<[boolean, string]> = [
    [design.hasUnderstandableOutputs, "understandable_outputs"],
    [design.hasOverrideCapability, "override_capability"],
    [design.hasStopFunction, "stop_function"],
    [design.hasAutomationBiasTraining, "automation_bias_training"],
    [design.hasDefinedRoles, "defined_roles"],
  ];
  const passed = checks.filter(([v]) => v).length;
  const gaps = checks.filter(([v]) => !v).map(([, k]) => k);
  const designCompleteness = Math.round((passed / checks.length) * 100);

  const warnings: string[] = [];
  if (design.assignedOversightPersonnel < 1) {
    warnings.push("Mindestens 1 qualifizierte Oversight-Person erforderlich.");
  }
  if (design.assignedOversightPersonnel === 1) {
    warnings.push("Single-Person-Oversight: bei Ausfall keine Abdeckung. Mind. 2 empfohlen.");
  }
  if (design.oversightFrequency === "none") {
    warnings.push("oversightFrequency = none -- Art. 14 violation fuer High-Risk.");
  }

  const isAdequate =
    passed === checks.length &&
    design.assignedOversightPersonnel >= 1 &&
    design.oversightFrequency !== "none";

  return { designCompleteness, isAdequate, gaps, warnings };
}

// ─── Art. 14 Oversight-Log-Quality ────────────────────────────

export interface OversightLogStats {
  totalLogs: number;
  overrideCount: number;
  interventionCount: number;
  monitoringCheckCount: number;
  highRiskLogsCount: number;
  daysSinceLastLog: number | null;
}

export interface OversightLogQuality {
  activityLevel: "dormant" | "low" | "regular" | "high";
  overrideRate: number; // overrides / total
  hasRecentActivity: boolean;
  warnings: string[];
}

export function assessOversightLogQuality(stats: OversightLogStats): OversightLogQuality {
  const warnings: string[] = [];

  let activityLevel: OversightLogQuality["activityLevel"] = "dormant";
  if (stats.totalLogs === 0) {
    activityLevel = "dormant";
    warnings.push("Keine Oversight-Logs -- Art. 14 Nachweis fehlt.");
  } else if (stats.totalLogs < 5) {
    activityLevel = "low";
  } else if (stats.totalLogs < 30) {
    activityLevel = "regular";
  } else {
    activityLevel = "high";
  }

  const overrideRate = stats.totalLogs > 0 ? stats.overrideCount / stats.totalLogs : 0;
  if (overrideRate > 0.5) {
    warnings.push(
      "Override-Rate > 50 %: System-Outputs werden haeufig korrigiert. Modell-Review erforderlich.",
    );
  }

  const hasRecentActivity = stats.daysSinceLastLog !== null && stats.daysSinceLastLog <= 90;
  if (!hasRecentActivity && stats.totalLogs > 0) {
    warnings.push("Letzter Oversight-Log > 90 Tage alt -- Monitoring inaktiv?");
  }

  return { activityLevel, overrideRate, hasRecentActivity, warnings };
}

// ─── Art. 26 Deployer-Duties ──────────────────────────────────
//
// Art. 26 verlangt von Deployern:
// - Art. 14 Human-Oversight sicherstellen
// - System gemaess Instruktionen nutzen
// - Input-Data-Qualitaet (soweit kontrollierbar)
// - Monitoring + Risiko-Meldung an Provider
// - Affected-Persons-Information
// - DPIA (falls relevant)
// - Log-Retention

export interface DeployerDutyContext {
  implementsHumanOversight: boolean;
  followsProviderInstructions: boolean;
  monitorsInputDataQuality: boolean;
  hasMonitoringProcess: boolean;
  hasReportingChannelToProvider: boolean;
  informsAffectedPersons: boolean;
  dpiaCompletedIfRequired: boolean;
  retainsLogs: boolean;
  dpiaRequired: boolean; // ctx-driven
}

export interface DeployerComplianceResult {
  compliancePercent: number;
  isCompliant: boolean;
  gaps: string[];
  criticalGaps: string[];
}

export function assessDeployerCompliance(ctx: DeployerDutyContext): DeployerComplianceResult {
  const checks: Array<[boolean, string, boolean]> = [
    [ctx.implementsHumanOversight, "human_oversight", true],
    [ctx.followsProviderInstructions, "follows_instructions", true],
    [ctx.monitorsInputDataQuality, "input_data_quality", false],
    [ctx.hasMonitoringProcess, "monitoring_process", true],
    [ctx.hasReportingChannelToProvider, "reporting_to_provider", false],
    [ctx.informsAffectedPersons, "affected_persons_info", false],
    [ctx.dpiaRequired ? ctx.dpiaCompletedIfRequired : true, "dpia_if_required", true],
    [ctx.retainsLogs, "retains_logs", true],
  ];

  const passed = checks.filter(([v]) => v).length;
  const gaps = checks.filter(([v]) => !v).map(([, k]) => k);
  const criticalGaps = checks
    .filter(([v, , critical]) => !v && critical)
    .map(([, k]) => k);

  return {
    compliancePercent: Math.round((passed / checks.length) * 100),
    isCompliant: gaps.length === 0,
    gaps,
    criticalGaps,
  };
}

// ─── Art. 50 Transparency-Disclosure (Chatbots, Deepfakes) ────

export type TransparencyObligationType =
  | "ai_interaction_disclosure" // Nutzer muss wissen dass mit AI interagiert wird
  | "emotion_recognition_disclosure"
  | "biometric_categorization_disclosure"
  | "deepfake_marking"
  | "ai_generated_content_marking";

export interface TransparencyContext {
  applicableObligations: TransparencyObligationType[];
  implementedDisclosures: TransparencyObligationType[];
  disclosureMethod: "pre_interaction" | "during_interaction" | "post_interaction" | null;
  userCanAcknowledge: boolean;
}

export interface TransparencyResult {
  covered: TransparencyObligationType[];
  missing: TransparencyObligationType[];
  coveragePercent: number;
  methodAppropriate: boolean;
  isCompliant: boolean;
}

export function assessTransparencyCoverage(ctx: TransparencyContext): TransparencyResult {
  const missing = ctx.applicableObligations.filter(
    (o) => !ctx.implementedDisclosures.includes(o),
  );
  const covered = ctx.applicableObligations.filter((o) =>
    ctx.implementedDisclosures.includes(o),
  );

  const coveragePercent =
    ctx.applicableObligations.length === 0
      ? 100
      : Math.round((covered.length / ctx.applicableObligations.length) * 100);

  // "pre_interaction" ist der bevorzugte Zeitpunkt; post_interaction greift zu spaet
  const methodAppropriate =
    ctx.disclosureMethod === "pre_interaction" ||
    ctx.disclosureMethod === "during_interaction" ||
    ctx.applicableObligations.length === 0;

  const isCompliant = missing.length === 0 && methodAppropriate;

  return { covered, missing, coveragePercent, methodAppropriate, isCompliant };
}
