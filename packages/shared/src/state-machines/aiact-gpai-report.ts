// AI-Act GPAI (Art. 51-55) + Annual-Report-Aggregation
//
// Referenz: docs/assessment-plans/04-aiact-assessment-plan.md §7.1-7.2.

// ─── Art. 51 GPAI Systemic-Risk Classification ───────────────
//
// GPAI-Model gilt als systemic-risk wenn:
// - Training-Compute > 10^25 FLOPs (Art. 51 (2))
// - Kommission designiert es
// - High-impact capabilities (benchmarks)

export interface GpaiSystemicRiskContext {
  trainingComputeFlops: number | null; // 10^25 Schwelle
  commissionDesignated: boolean;
  hasHighImpactCapabilities: boolean;
  parametersCount: number | null;
  hasAdvancedReasoning: boolean;
  hasMultimodalCapabilities: boolean;
}

export interface GpaiSystemicRiskResult {
  isSystemic: boolean;
  reasoning: string;
  tierLevel: "systemic" | "high_capability" | "standard";
  triggers: string[];
}

const SYSTEMIC_FLOPS_THRESHOLD = 1e25;
const HIGH_CAPABILITY_FLOPS = 1e24;

export function classifyGpaiSystemicRisk(
  ctx: GpaiSystemicRiskContext,
): GpaiSystemicRiskResult {
  const triggers: string[] = [];

  if (ctx.commissionDesignated) {
    triggers.push("commission_designation");
  }
  if (
    ctx.trainingComputeFlops !== null &&
    ctx.trainingComputeFlops >= SYSTEMIC_FLOPS_THRESHOLD
  ) {
    triggers.push(
      `training_compute_gte_${SYSTEMIC_FLOPS_THRESHOLD.toExponential()}_flops`,
    );
  }
  if (ctx.hasHighImpactCapabilities) {
    triggers.push("high_impact_capabilities");
  }

  if (triggers.length > 0) {
    return {
      isSystemic: true,
      tierLevel: "systemic",
      reasoning: `Systemic-Risk durch: ${triggers.join(", ")}. Art. 55 gilt.`,
      triggers,
    };
  }

  // Near-systemic: compute > 10^24 FLOPs oder advanced reasoning + multimodal
  const nearSystemic =
    (ctx.trainingComputeFlops !== null &&
      ctx.trainingComputeFlops >= HIGH_CAPABILITY_FLOPS) ||
    (ctx.hasAdvancedReasoning && ctx.hasMultimodalCapabilities);

  if (nearSystemic) {
    return {
      isSystemic: false,
      tierLevel: "high_capability",
      reasoning:
        "High-Capability aber keine Systemic-Risk-Kriterien erfuellt. Monitoring empfohlen.",
      triggers,
    };
  }

  return {
    isSystemic: false,
    tierLevel: "standard",
    reasoning: "Standard-GPAI ohne Systemic-Risk-Indikatoren.",
    triggers,
  };
}

// ─── Art. 53 GPAI Provider Obligations ────────────────────────

export interface GpaiObligationContext {
  hasTechnicalDocumentation: boolean;
  hasTrainingDataSummary: boolean; // Art. 53 (1) (d)
  respectsCopyrightDirective: boolean; // Art. 53 (1) (c)
  downstreamProviderInfoShared: boolean;
  hasEuRepresentative: boolean; // Art. 54 fuer non-EU providers
  isNonEuProvider: boolean;
  /** Systemic-Risk specific: */
  isSystemic: boolean;
  hasModelEvaluations: boolean; // Art. 55 (1) (a)
  hasAdversarialTesting: boolean; // Art. 55 (1) (a)
  hasSystemicRiskAssessment: boolean; // Art. 55 (1) (b)
  hasIncidentReporting: boolean; // Art. 55 (1) (c)
  hasCybersecurityMeasures: boolean; // Art. 55 (1) (d)
}

export interface GpaiObligationResult {
  standardObligationsMet: number; // of 4 standard Art. 53 items
  systemicObligationsMet: number; // of 5 Art. 55 items (0 if not systemic)
  standardPercent: number;
  systemicPercent: number | null;
  missing: string[];
  isFullyCompliant: boolean;
}

export function assessGpaiObligations(
  ctx: GpaiObligationContext,
): GpaiObligationResult {
  const standardChecks: Array<[boolean, string]> = [
    [ctx.hasTechnicalDocumentation, "technical_documentation"],
    [ctx.hasTrainingDataSummary, "training_data_summary"],
    [ctx.respectsCopyrightDirective, "copyright_compliance"],
    [ctx.downstreamProviderInfoShared, "downstream_provider_info"],
  ];

  // EU-Representative nur wenn non-EU Provider
  if (ctx.isNonEuProvider) {
    standardChecks.push([ctx.hasEuRepresentative, "eu_representative"]);
  }

  const systemicChecks: Array<[boolean, string]> = ctx.isSystemic
    ? [
        [ctx.hasModelEvaluations, "model_evaluations"],
        [ctx.hasAdversarialTesting, "adversarial_testing"],
        [ctx.hasSystemicRiskAssessment, "systemic_risk_assessment"],
        [ctx.hasIncidentReporting, "incident_reporting"],
        [ctx.hasCybersecurityMeasures, "cybersecurity_measures"],
      ]
    : [];

  const standardPassed = standardChecks.filter(([v]) => v).length;
  const systemicPassed = systemicChecks.filter(([v]) => v).length;
  const missing = [
    ...standardChecks.filter(([v]) => !v).map(([, k]) => k),
    ...systemicChecks.filter(([v]) => !v).map(([, k]) => k),
  ];

  const standardPercent = Math.round(
    (standardPassed / standardChecks.length) * 100,
  );
  const systemicPercent =
    systemicChecks.length > 0
      ? Math.round((systemicPassed / systemicChecks.length) * 100)
      : null;

  const isFullyCompliant = missing.length === 0;

  return {
    standardObligationsMet: standardPassed,
    systemicObligationsMet: systemicPassed,
    standardPercent,
    systemicPercent,
    missing,
    isFullyCompliant,
  };
}

// ─── Annual AI-Act Compliance Report Aggregate ────────────────

export interface AnnualReportInput {
  year: number;
  systems: {
    total: number;
    byRisk: {
      unacceptable: number;
      high: number;
      limited: number;
      minimal: number;
    };
    compliant: number;
    nonCompliant: number;
    inAssessment: number;
  };
  conformityAssessments: {
    completed: number;
    passed: number;
    failed: number;
    pending: number;
  };
  incidents: {
    totalReported: number;
    seriousIncidents: number;
    overdueNotifications: number;
    averageTimeToNotifyHours: number | null;
  };
  fria: {
    required: number;
    completed: number;
    approved: number;
  };
  qms: {
    avgMaturity: number;
    readyForCe: number;
    notReadyForCe: number;
  };
  gpai: {
    total: number;
    systemic: number;
  };
  correctiveActions: {
    open: number;
    closed: number;
    overdue: number;
  };
}

export interface AnnualReportResult {
  year: number;
  overallComplianceScore: number; // 0-100 aggregated
  criticalFindings: string[];
  highlights: string[];
  readyForSubmission: boolean;
  sections: {
    systems: { healthScore: number; narrative: string };
    conformity: { healthScore: number; narrative: string };
    incidents: { healthScore: number; narrative: string };
    fria: { healthScore: number; narrative: string };
    qms: { healthScore: number; narrative: string };
    gpai: { healthScore: number; narrative: string };
  };
}

export function computeAnnualReport(
  input: AnnualReportInput,
): AnnualReportResult {
  const critical: string[] = [];
  const highlights: string[] = [];

  // Systems health
  const systemsTotal = input.systems.total || 1;
  const systemsHealth = Math.round(
    (input.systems.compliant / systemsTotal) * 100,
  );
  if (input.systems.byRisk.unacceptable > 0) {
    critical.push(
      `${input.systems.byRisk.unacceptable} AI-System(e) mit unacceptable risk im Portfolio.`,
    );
  }
  const systemsNarrative = `${input.systems.total} Systeme (${input.systems.byRisk.high} high-risk, ${input.systems.byRisk.limited} limited, ${input.systems.byRisk.minimal} minimal). ${input.systems.compliant} compliant, ${input.systems.nonCompliant} non-compliant.`;

  // Conformity health
  const conformityTotal = input.conformityAssessments.completed || 1;
  const conformityHealth = Math.round(
    (input.conformityAssessments.passed / conformityTotal) * 100,
  );
  const conformityNarrative = `${input.conformityAssessments.completed} Assessments abgeschlossen (${input.conformityAssessments.passed} pass, ${input.conformityAssessments.failed} fail, ${input.conformityAssessments.pending} pending).`;
  if (input.conformityAssessments.failed > 0) {
    critical.push(
      `${input.conformityAssessments.failed} Conformity-Assessment(s) gescheitert.`,
    );
  }

  // Incidents health
  const incidentsHealth = input.incidents.overdueNotifications > 0 ? 30 : 100;
  const incidentsNarrative = `${input.incidents.totalReported} Incidents gesamt (${input.incidents.seriousIncidents} serious). ${input.incidents.overdueNotifications} Notifications ueberfaellig.`;
  if (input.incidents.overdueNotifications > 0) {
    critical.push(
      `${input.incidents.overdueNotifications} ueberfaellige Authority-Notifications (Art. 73 Verstoss).`,
    );
  }

  // FRIA health
  const friaHealth =
    input.fria.required > 0
      ? Math.round((input.fria.completed / input.fria.required) * 100)
      : 100;
  const friaNarrative = `${input.fria.required} FRIAs erforderlich, ${input.fria.completed} completed, ${input.fria.approved} approved.`;
  if (friaHealth < 100 && input.fria.required > 0) {
    critical.push(
      `FRIA-Coverage ${friaHealth}% -- nicht alle mandatory FRIAs abgeschlossen.`,
    );
  }

  // QMS health
  const qmsHealth = input.qms.avgMaturity;
  const qmsNarrative = `Durchschnittliche QMS-Maturity: ${input.qms.avgMaturity}%. ${input.qms.readyForCe} von ${input.qms.readyForCe + input.qms.notReadyForCe} QMS CE-ready.`;
  if (input.qms.avgMaturity >= 80) {
    highlights.push(
      `QMS-Maturity durchschnittlich ${input.qms.avgMaturity}% -- robuste QMS-Basis.`,
    );
  }

  // GPAI health
  const gpaiHealth = input.gpai.total > 0 ? 90 : 100;
  const gpaiNarrative = `${input.gpai.total} GPAI-Models registriert (${input.gpai.systemic} mit systemic risk).`;

  // Overall compliance score = weighted average
  const weights = {
    systems: 0.25,
    conformity: 0.2,
    incidents: 0.15,
    fria: 0.15,
    qms: 0.15,
    gpai: 0.1,
  };
  const overallComplianceScore = Math.round(
    systemsHealth * weights.systems +
      conformityHealth * weights.conformity +
      incidentsHealth * weights.incidents +
      friaHealth * weights.fria +
      qmsHealth * weights.qms +
      gpaiHealth * weights.gpai,
  );

  if (input.correctiveActions.overdue > 0) {
    critical.push(
      `${input.correctiveActions.overdue} Corrective Actions ueberfaellig.`,
    );
  }
  if (input.correctiveActions.closed > input.correctiveActions.open * 2) {
    highlights.push(
      "Corrective-Action-Closure-Rate hoch: remediation effektiv.",
    );
  }

  const readyForSubmission =
    critical.length === 0 && overallComplianceScore >= 70;

  return {
    year: input.year,
    overallComplianceScore,
    criticalFindings: critical,
    highlights,
    readyForSubmission,
    sections: {
      systems: { healthScore: systemsHealth, narrative: systemsNarrative },
      conformity: {
        healthScore: conformityHealth,
        narrative: conformityNarrative,
      },
      incidents: {
        healthScore: incidentsHealth,
        narrative: incidentsNarrative,
      },
      fria: { healthScore: friaHealth, narrative: friaNarrative },
      qms: { healthScore: qmsHealth, narrative: qmsNarrative },
      gpai: { healthScore: gpaiHealth, narrative: gpaiNarrative },
    },
  };
}
