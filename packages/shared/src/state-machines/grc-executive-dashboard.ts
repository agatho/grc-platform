// GRC Executive Dashboard Composite (Epic 6.3)
//
// Aggregiert Health-Scores aus allen 4 Modulen (ISMS, BCMS, DPMS, AI-Act) in einen
// Single-Pane-Report fuer das Executive-Dashboard + Board-Briefing.

export interface IsmsDashboardInput {
  assessmentsTotal: number;
  assessmentsCompleted: number;
  soaCoveragePercent: number;
  openFindingsCount: number;
  criticalFindingsCount: number;
  maturityAverage: number; // 0-100
  capOpenCount: number;
  capOverdueCount: number;
}

export interface BcmsDashboardInput {
  biaCompletedCount: number;
  biaTotalCount: number;
  bcpPublishedCount: number;
  bcpTotalCount: number;
  exercisesCompletedYtd: number;
  activeCrisisCount: number;
  rtoCoveragePercent: number; // % processes mit definiertem RTO
}

export interface DpmsDashboardInput {
  ropaActiveCount: number;
  dpiaApprovedCount: number;
  dpiaPendingCount: number;
  dsrOpenCount: number;
  dsrOverdueCount: number;
  breachesYtd: number;
  breachesOverdueNotifications: number;
  tiaReviewedCount: number;
  consentValidPercent: number;
}

export interface AiActDashboardInput {
  systemsTotal: number;
  systemsHighRisk: number;
  systemsUnacceptable: number;
  systemsCompliant: number;
  qmsAverageMaturity: number;
  friaRequired: number;
  friaCompleted: number;
  incidentsOverdueCount: number;
  gpaiSystemicCount: number;
}

export interface ExecutiveDashboardInput {
  isms: IsmsDashboardInput;
  bcms: BcmsDashboardInput;
  dpms: DpmsDashboardInput;
  aiAct: AiActDashboardInput;
  asOfDate: string; // ISO
  organizationName: string;
}

export type HealthStatus = "green" | "amber" | "red";

export interface ModuleHealth {
  module: "isms" | "bcms" | "dpms" | "ai_act";
  score: number; // 0-100
  status: HealthStatus;
  driverMetrics: Record<string, number>;
  topConcerns: string[];
}

export interface ExecutiveDashboardResult {
  asOfDate: string;
  organizationName: string;
  overallScore: number;
  overallStatus: HealthStatus;
  modules: ModuleHealth[];
  criticalCount: number; // across all modules
  amberCount: number;
  boardBriefingTalkingPoints: string[];
  /** TOP-3 Risks across modules fuer sofortige Aufmerksamkeit */
  topExecutiveActions: string[];
}

// ─── Module Health Computations ──────────────────────────────

function classifyStatus(score: number): HealthStatus {
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

export function computeIsmsHealth(input: IsmsDashboardInput): ModuleHealth {
  const assessmentCoverage =
    input.assessmentsTotal > 0
      ? (input.assessmentsCompleted / input.assessmentsTotal) * 100
      : 100;

  // Weighted:
  // 30% maturity, 25% SoA coverage, 20% assessment coverage,
  // 15% findings health (inverted), 10% CAP hygiene (inverted).
  const findingsHealth =
    input.openFindingsCount === 0
      ? 100
      : Math.max(
          0,
          100 - input.criticalFindingsCount * 20 - input.openFindingsCount * 2,
        );

  const capHealth =
    input.capOpenCount === 0
      ? 100
      : Math.max(0, 100 - input.capOverdueCount * 15);

  const score = Math.round(
    input.maturityAverage * 0.3 +
      input.soaCoveragePercent * 0.25 +
      assessmentCoverage * 0.2 +
      findingsHealth * 0.15 +
      capHealth * 0.1,
  );

  const concerns: string[] = [];
  if (input.criticalFindingsCount > 0) {
    concerns.push(`${input.criticalFindingsCount} critical finding(s) offen.`);
  }
  if (input.capOverdueCount > 0) {
    concerns.push(`${input.capOverdueCount} Corrective-Actions ueberfaellig.`);
  }
  if (input.soaCoveragePercent < 80) {
    concerns.push(`SoA-Coverage ${input.soaCoveragePercent}% unter Ziel 80%.`);
  }
  if (input.maturityAverage < 60) {
    concerns.push(
      `Durchschnittliche Maturity ${input.maturityAverage}% unter ERM-Minimum.`,
    );
  }

  return {
    module: "isms",
    score,
    status: classifyStatus(score),
    driverMetrics: {
      maturity: input.maturityAverage,
      soaCoverage: input.soaCoveragePercent,
      assessmentCoverage: Math.round(assessmentCoverage),
      findingsHealth: Math.round(findingsHealth),
      capHealth: Math.round(capHealth),
    },
    topConcerns: concerns.slice(0, 3),
  };
}

export function computeBcmsHealth(input: BcmsDashboardInput): ModuleHealth {
  const biaCoverage =
    input.biaTotalCount > 0
      ? (input.biaCompletedCount / input.biaTotalCount) * 100
      : 0;
  const bcpCoverage =
    input.bcpTotalCount > 0
      ? (input.bcpPublishedCount / input.bcpTotalCount) * 100
      : 0;
  const exerciseHealth = input.exercisesCompletedYtd > 0 ? 100 : 40;
  const crisisPenalty = input.activeCrisisCount > 0 ? 50 : 100;

  const score = Math.round(
    biaCoverage * 0.25 +
      bcpCoverage * 0.3 +
      input.rtoCoveragePercent * 0.2 +
      exerciseHealth * 0.15 +
      crisisPenalty * 0.1,
  );

  const concerns: string[] = [];
  if (input.activeCrisisCount > 0) {
    concerns.push(
      `${input.activeCrisisCount} aktive(r) Krisenfall/Krise -- volle Aufmerksamkeit.`,
    );
  }
  if (bcpCoverage < 80) {
    concerns.push(`Nur ${Math.round(bcpCoverage)}% BCPs published.`);
  }
  if (input.exercisesCompletedYtd === 0) {
    concerns.push("Keine Uebungen YTD -- ISO 22301 Kap. 8.5 Verstoss.");
  }
  if (input.rtoCoveragePercent < 70) {
    concerns.push(`RTO-Coverage ${input.rtoCoveragePercent}% unzureichend.`);
  }

  return {
    module: "bcms",
    score,
    status: classifyStatus(score),
    driverMetrics: {
      biaCoverage: Math.round(biaCoverage),
      bcpCoverage: Math.round(bcpCoverage),
      rtoCoverage: input.rtoCoveragePercent,
      exerciseHealth,
      activeCrises: input.activeCrisisCount,
    },
    topConcerns: concerns.slice(0, 3),
  };
}

export function computeDpmsHealth(input: DpmsDashboardInput): ModuleHealth {
  const ropaCoverage = input.ropaActiveCount > 0 ? 90 : 20;
  const dpiaHealth =
    input.dpiaPendingCount === 0
      ? 100
      : Math.max(0, 100 - input.dpiaPendingCount * 10);
  const dsrHealth =
    input.dsrOverdueCount === 0
      ? 100
      : Math.max(0, 100 - input.dsrOverdueCount * 20);
  const breachHealth =
    input.breachesOverdueNotifications === 0
      ? 100
      : Math.max(0, 100 - input.breachesOverdueNotifications * 30);
  const tiaHealth = input.tiaReviewedCount > 0 ? 100 : 50;
  const consentHealth = input.consentValidPercent;

  const score = Math.round(
    ropaCoverage * 0.15 +
      dpiaHealth * 0.2 +
      dsrHealth * 0.2 +
      breachHealth * 0.15 +
      tiaHealth * 0.1 +
      consentHealth * 0.2,
  );

  const concerns: string[] = [];
  if (input.breachesOverdueNotifications > 0) {
    concerns.push(
      `${input.breachesOverdueNotifications} Breach-Notifications ueber 72h Frist (Art. 33 GDPR).`,
    );
  }
  if (input.dsrOverdueCount > 0) {
    concerns.push(
      `${input.dsrOverdueCount} DSR ueberfaellig (Art. 12 (3) 1-Monat-Frist).`,
    );
  }
  if (input.dpiaPendingCount > 5) {
    concerns.push(`${input.dpiaPendingCount} DPIAs noch nicht approved.`);
  }
  if (input.consentValidPercent < 90) {
    concerns.push(`Consent-Validity ${input.consentValidPercent}% unter 90%.`);
  }

  return {
    module: "dpms",
    score,
    status: classifyStatus(score),
    driverMetrics: {
      ropaCoverage,
      dpiaHealth: Math.round(dpiaHealth),
      dsrHealth: Math.round(dsrHealth),
      breachHealth: Math.round(breachHealth),
      tiaHealth,
      consentHealth: Math.round(consentHealth),
    },
    topConcerns: concerns.slice(0, 3),
  };
}

export function computeAiActHealth(input: AiActDashboardInput): ModuleHealth {
  // Unacceptable-Practices = automatic red if > 0
  if (input.systemsUnacceptable > 0) {
    return {
      module: "ai_act",
      score: 0,
      status: "red",
      driverMetrics: {
        systemsUnacceptable: input.systemsUnacceptable,
        qmsAverageMaturity: input.qmsAverageMaturity,
        friaCoverage:
          input.friaRequired > 0
            ? Math.round((input.friaCompleted / input.friaRequired) * 100)
            : 100,
      },
      topConcerns: [
        `HARD-STOP: ${input.systemsUnacceptable} AI-System(e) mit unacceptable-risk.`,
      ],
    };
  }

  const complianceRate =
    input.systemsTotal > 0
      ? (input.systemsCompliant / input.systemsTotal) * 100
      : 100;
  const friaCoverage =
    input.friaRequired > 0
      ? (input.friaCompleted / input.friaRequired) * 100
      : 100;
  const incidentHealth = input.incidentsOverdueCount === 0 ? 100 : 30;
  const gpaiPenalty = input.gpaiSystemicCount > 0 ? 85 : 100; // More scrutiny

  const score = Math.round(
    complianceRate * 0.25 +
      input.qmsAverageMaturity * 0.25 +
      friaCoverage * 0.2 +
      incidentHealth * 0.15 +
      gpaiPenalty * 0.15,
  );

  const concerns: string[] = [];
  if (input.incidentsOverdueCount > 0) {
    concerns.push(
      `${input.incidentsOverdueCount} AI-Incident-Notifications ueberfaellig (Art. 73).`,
    );
  }
  if (friaCoverage < 100 && input.friaRequired > 0) {
    concerns.push(`FRIA-Coverage ${Math.round(friaCoverage)}% unter 100%.`);
  }
  if (input.qmsAverageMaturity < 70) {
    concerns.push(`QMS-Maturity ${input.qmsAverageMaturity}% unter CE-Reife.`);
  }
  if (input.systemsHighRisk > 0 && complianceRate < 80) {
    concerns.push(
      `${input.systemsHighRisk} high-risk-Systeme, nur ${Math.round(complianceRate)}% compliant.`,
    );
  }

  return {
    module: "ai_act",
    score,
    status: classifyStatus(score),
    driverMetrics: {
      complianceRate: Math.round(complianceRate),
      qmsMaturity: input.qmsAverageMaturity,
      friaCoverage: Math.round(friaCoverage),
      incidentHealth,
      gpaiSystemicCount: input.gpaiSystemicCount,
    },
    topConcerns: concerns.slice(0, 3),
  };
}

// ─── Composite Report ────────────────────────────────────────

export function computeExecutiveDashboard(
  input: ExecutiveDashboardInput,
): ExecutiveDashboardResult {
  const modules: ModuleHealth[] = [
    computeIsmsHealth(input.isms),
    computeBcmsHealth(input.bcms),
    computeDpmsHealth(input.dpms),
    computeAiActHealth(input.aiAct),
  ];

  // Equal weighting across modules (25% each)
  const overallScore = Math.round(
    modules.reduce((s, m) => s + m.score, 0) / modules.length,
  );
  const overallStatus = classifyStatus(overallScore);

  const criticalCount = modules.filter((m) => m.status === "red").length;
  const amberCount = modules.filter((m) => m.status === "amber").length;

  // Top-3 Executive-Actions: priorisiere red modules, dann amber
  const actions: string[] = [];
  for (const m of modules.filter((x) => x.status === "red")) {
    for (const c of m.topConcerns) {
      actions.push(`[${m.module.toUpperCase()}] ${c}`);
      if (actions.length >= 3) break;
    }
    if (actions.length >= 3) break;
  }
  if (actions.length < 3) {
    for (const m of modules.filter((x) => x.status === "amber")) {
      for (const c of m.topConcerns) {
        if (actions.length < 3)
          actions.push(`[${m.module.toUpperCase()}] ${c}`);
      }
      if (actions.length >= 3) break;
    }
  }

  const talkingPoints: string[] = [
    `Organization: ${input.organizationName}. As-of ${input.asOfDate}.`,
    `Overall GRC-Health: ${overallScore}/100 (${overallStatus.toUpperCase()}).`,
    `Module-Status: ${modules.map((m) => `${m.module}=${m.status}`).join(", ")}.`,
  ];
  if (criticalCount > 0) {
    talkingPoints.push(
      `${criticalCount} Modul(e) im RED -- unmittelbare Aufmerksamkeit.`,
    );
  }
  if (amberCount > 0 && criticalCount === 0) {
    talkingPoints.push(
      `${amberCount} Modul(e) im AMBER -- Monitoring intensivieren.`,
    );
  }

  return {
    asOfDate: input.asOfDate,
    organizationName: input.organizationName,
    overallScore,
    overallStatus,
    modules,
    criticalCount,
    amberCount,
    boardBriefingTalkingPoints: talkingPoints,
    topExecutiveActions: actions,
  };
}
