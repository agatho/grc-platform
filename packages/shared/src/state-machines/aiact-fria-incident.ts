// AI-Act FRIA (Art. 27) + Post-Market Incident Reporting (Art. 73)
//
// Referenz: docs/assessment-plans/04-aiact-assessment-plan.md §6.1-6.2.

// ─── Art. 27 FRIA Determination ───────────────────────────────
//
// Fundamental-Rights-Impact-Assessment ist PFLICHT fuer:
// - Public-Sector-Deployers von High-Risk-Systemen
// - High-Risk-Systeme nach Annex III Punkte 5(b), 5(c): Credit, Lebens-/Krankenversicherung
// - Annex III Punkte 8: Law-Enforcement
// Fuer andere High-Risk: strongly recommended aber nicht Pflicht.

export type DeployerType = "public_sector" | "private_sector";

export interface FriaDetermination {
  riskClassification: "high" | "limited" | "minimal" | "unacceptable";
  deployerType: DeployerType;
  annexIIICategory: string | null;
  isCreditScoring: boolean;
  isLifeHealthInsurance: boolean;
  isLawEnforcement: boolean;
}

export interface FriaRequirementResult {
  isFriaRequired: boolean;
  reason: string;
  recommendationLevel: "mandatory" | "recommended" | "not_required";
}

export function determineFriaRequirement(
  ctx: FriaDetermination,
): FriaRequirementResult {
  if (ctx.riskClassification !== "high") {
    return {
      isFriaRequired: false,
      reason: "FRIA nur fuer High-Risk-Systeme noetig.",
      recommendationLevel: "not_required",
    };
  }

  if (ctx.deployerType === "public_sector") {
    return {
      isFriaRequired: true,
      reason:
        "Public-Sector-Deployer + High-Risk = FRIA Pflicht (Art. 27 (1) (a)).",
      recommendationLevel: "mandatory",
    };
  }

  if (ctx.isCreditScoring || ctx.isLifeHealthInsurance) {
    return {
      isFriaRequired: true,
      reason: "Annex III Punkt 5(b)/5(c) (Credit, Insurance) = FRIA Pflicht.",
      recommendationLevel: "mandatory",
    };
  }

  if (ctx.isLawEnforcement) {
    return {
      isFriaRequired: true,
      reason: "Annex III Punkt 8 Law-Enforcement = FRIA Pflicht.",
      recommendationLevel: "mandatory",
    };
  }

  return {
    isFriaRequired: false,
    reason:
      "High-Risk aber ausserhalb mandatory-Scope. FRIA empfohlen aber nicht Pflicht.",
    recommendationLevel: "recommended",
  };
}

// ─── FRIA Quality Assessment ──────────────────────────────────

export type FundamentalRight =
  | "dignity"
  | "equality_non_discrimination"
  | "privacy_data_protection"
  | "freedom_expression"
  | "freedom_assembly"
  | "freedom_movement"
  | "access_to_justice"
  | "workers_rights"
  | "consumer_protection"
  | "child_protection";

export interface FriaRightAssessment {
  right: FundamentalRight;
  impact: "high" | "medium" | "low" | "negligible";
  mitigation: string;
  residualRisk: "high" | "medium" | "low" | "negligible";
}

export interface FriaQualityInput {
  rightsAssessed: FriaRightAssessment[];
  hasDiscriminationAnalysis: boolean;
  hasDataProtectionImpact: boolean;
  hasAccessToJusticeAnalysis: boolean;
  hasAffectedPersonsConsultation: boolean;
  hasOverallImpactStatement: boolean;
  hasMitigationMeasuresDocumented: boolean;
}

export interface FriaQualityResult {
  rightsCoverage: number; // % aus 10 core rights
  qualityChecksPercent: number;
  hasHighResidualRisk: boolean;
  highResidualRights: FundamentalRight[];
  missing: string[];
  isApprovable: boolean;
}

const CORE_RIGHTS: FundamentalRight[] = [
  "dignity",
  "equality_non_discrimination",
  "privacy_data_protection",
  "freedom_expression",
  "freedom_assembly",
  "freedom_movement",
  "access_to_justice",
  "workers_rights",
  "consumer_protection",
  "child_protection",
];

export function assessFriaQuality(input: FriaQualityInput): FriaQualityResult {
  const assessedRights = new Set(input.rightsAssessed.map((r) => r.right));
  const rightsCoverage = Math.round(
    (assessedRights.size / CORE_RIGHTS.length) * 100,
  );

  const qualityChecks: Array<[boolean, string]> = [
    [input.hasDiscriminationAnalysis, "discrimination_analysis"],
    [input.hasDataProtectionImpact, "data_protection_impact"],
    [input.hasAccessToJusticeAnalysis, "access_to_justice_analysis"],
    [input.hasAffectedPersonsConsultation, "affected_persons_consultation"],
    [input.hasOverallImpactStatement, "overall_impact_statement"],
    [input.hasMitigationMeasuresDocumented, "mitigation_measures"],
  ];
  const passed = qualityChecks.filter(([v]) => v).length;
  const missing = qualityChecks.filter(([v]) => !v).map(([, k]) => k);
  const qualityChecksPercent = Math.round(
    (passed / qualityChecks.length) * 100,
  );

  const highResidualRights = input.rightsAssessed
    .filter((r) => r.residualRisk === "high")
    .map((r) => r.right);

  const hasHighResidualRisk = highResidualRights.length > 0;

  // Approvable = >=5 rights covered, all 6 quality-checks, no high residual risk
  const isApprovable =
    assessedRights.size >= 5 &&
    passed === qualityChecks.length &&
    !hasHighResidualRisk;

  return {
    rightsCoverage,
    qualityChecksPercent,
    hasHighResidualRisk,
    highResidualRights,
    missing,
    isApprovable,
  };
}

// ─── Art. 73 Post-Market Incident Reporting ───────────────────
//
// Art. 73 deadlines:
// - Serious incident: 15 days nach Bekanntwerden an Market-Surveillance-Authority
// - Widespread infringement: 2 days
// - Serious + widespread: 2 days
// - Tod / schwere Gesundheitsschaeden: IMMEDIATELY but <=2 days

export interface IncidentClassification {
  resultedInDeath: boolean;
  resultedInSeriousHealthDamage: boolean;
  isWidespreadInfringement: boolean; // betrifft mehrere Personen
  violatesUnionLaw: boolean;
  affectsCriticalInfrastructure: boolean;
  affectedPersonsCount: number;
}

export interface IncidentDeadlineResult {
  isSerious: boolean;
  notificationDeadlineDays: number;
  notificationDeadlineHours: number;
  deadlineCategory:
    | "immediate_2d"
    | "widespread_2d"
    | "serious_15d"
    | "not_reportable";
  reasoning: string;
}

export function classifyIncidentDeadline(
  incident: IncidentClassification,
  detectedAt: Date,
): IncidentDeadlineResult & { deadlineAt: Date } {
  // Immediate 2-day fuer Tod / schwere Schaeden
  if (incident.resultedInDeath || incident.resultedInSeriousHealthDamage) {
    const deadline = new Date(detectedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
    return {
      isSerious: true,
      notificationDeadlineDays: 2,
      notificationDeadlineHours: 48,
      deadlineCategory: "immediate_2d",
      reasoning:
        "Tod oder schwere Gesundheitsschaeden -- IMMEDIATELY notification, Ziel <= 2 Tage.",
      deadlineAt: deadline,
    };
  }

  // Widespread infringement: 2 days
  if (
    incident.isWidespreadInfringement ||
    incident.affectedPersonsCount > 100
  ) {
    const deadline = new Date(detectedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
    return {
      isSerious: true,
      notificationDeadlineDays: 2,
      notificationDeadlineHours: 48,
      deadlineCategory: "widespread_2d",
      reasoning:
        "Widespread infringement oder > 100 affected persons -- 2-Tage-Deadline.",
      deadlineAt: deadline,
    };
  }

  // Serious aber nicht widespread: 15 days
  const isSerious =
    incident.violatesUnionLaw ||
    incident.affectsCriticalInfrastructure ||
    incident.affectedPersonsCount > 0;

  if (isSerious) {
    const deadline = new Date(detectedAt.getTime() + 15 * 24 * 60 * 60 * 1000);
    return {
      isSerious: true,
      notificationDeadlineDays: 15,
      notificationDeadlineHours: 360,
      deadlineCategory: "serious_15d",
      reasoning:
        "Serious incident -- 15-Tage-Deadline an Market-Surveillance-Authority.",
      deadlineAt: deadline,
    };
  }

  return {
    isSerious: false,
    notificationDeadlineDays: 0,
    notificationDeadlineHours: 0,
    deadlineCategory: "not_reportable",
    reasoning:
      "Nicht als serious oder widespread klassifiziert -- keine Meldepflicht.",
    deadlineAt: detectedAt,
  };
}

// ─── Incident Overdue-Check ───────────────────────────────────

export interface AiActIncidentSnapshot {
  detectedAt: Date;
  authorityNotifiedAt: Date | null;
  deadlineAt: Date;
  isSerious: boolean;
}

export interface IncidentOverdueResult {
  isNotified: boolean;
  isOverdue: boolean;
  hoursUntilDeadline: number | null;
  hoursOverdue: number | null;
  escalationLevel: "none" | "approaching" | "overdue" | "critical_overdue";
}

export function checkIncidentOverdue(
  status: AiActIncidentSnapshot,
  now: Date = new Date(),
): IncidentOverdueResult {
  const isNotified = status.authorityNotifiedAt !== null;

  if (isNotified) {
    return {
      isNotified: true,
      isOverdue: false,
      hoursUntilDeadline: null,
      hoursOverdue: null,
      escalationLevel: "none",
    };
  }

  const msDiff = status.deadlineAt.getTime() - now.getTime();
  const hoursDiff = msDiff / (1000 * 60 * 60);

  if (hoursDiff > 24) {
    return {
      isNotified: false,
      isOverdue: false,
      hoursUntilDeadline: Math.round(hoursDiff),
      hoursOverdue: null,
      escalationLevel: "none",
    };
  }

  if (hoursDiff > 0) {
    return {
      isNotified: false,
      isOverdue: false,
      hoursUntilDeadline: Math.round(hoursDiff),
      hoursOverdue: null,
      escalationLevel: "approaching",
    };
  }

  const overdue = Math.round(-hoursDiff);
  return {
    isNotified: false,
    isOverdue: true,
    hoursUntilDeadline: 0,
    hoursOverdue: overdue,
    escalationLevel: overdue > 48 ? "critical_overdue" : "overdue",
  };
}
