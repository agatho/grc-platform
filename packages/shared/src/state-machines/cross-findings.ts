// Cross-Module Finding Unification (Epic 6.1)
//
// Aggregiert Findings aus allen Modulen (ICS, ISMS-CAP, AI-Act, DPMS-Breach,
// BCMS-Exercise) in eine normalisierte Form fuer das Executive-Dashboard,
// Cross-Finding-Report und Priorisierung.

export type FindingModule =
  | "ics"
  | "audit"
  | "isms_cap"
  | "ai_act_incident"
  | "ai_act_corrective"
  | "dpms_breach"
  | "bcms_exercise";

export type NormalizedSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "observation";

export type NormalizedStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "verified"
  | "closed"
  | "accepted";

export interface CrossModuleFinding {
  id: string;
  sourceId: string; // Original-ID im Modul
  module: FindingModule;
  title: string;
  severity: NormalizedSeverity;
  status: NormalizedStatus;
  identifiedAt: Date;
  dueDate: Date | null;
  ownerId: string | null;
  /** ID zum Link ins Modul-UI */
  linkPath: string;
}

// ─── Severity + Status Normalizers ────────────────────────────

export function normalizeIcsFindingSeverity(
  sev:
    | "observation"
    | "recommendation"
    | "improvement_requirement"
    | "insignificant_nonconformity"
    | "significant_nonconformity",
): NormalizedSeverity {
  switch (sev) {
    case "significant_nonconformity":
      return "high";
    case "insignificant_nonconformity":
      return "medium";
    case "improvement_requirement":
      return "medium";
    case "recommendation":
      return "low";
    case "observation":
      return "observation";
  }
}

export function normalizeIcsFindingStatus(
  s:
    | "identified"
    | "in_remediation"
    | "remediated"
    | "verified"
    | "accepted"
    | "closed",
): NormalizedStatus {
  if (s === "identified") return "open";
  if (s === "in_remediation") return "in_progress";
  if (s === "remediated") return "resolved";
  return s;
}

export function normalizeIsmsNcSeverity(sev: string): NormalizedSeverity {
  if (sev === "major") return "high";
  if (sev === "minor") return "medium";
  if (sev === "observation") return "observation";
  return "medium";
}

export function normalizeIsmsNcStatus(s: string): NormalizedStatus {
  switch (s) {
    case "open":
    case "reopened":
      return "open";
    case "analysis":
    case "action_planned":
    case "in_progress":
      return "in_progress";
    case "verification":
      return "resolved";
    case "closed":
      return "closed";
    default:
      return "open";
  }
}

export function normalizeAiIncidentSeverity(
  isSerious: boolean,
  severity: string,
): NormalizedSeverity {
  if (isSerious) return "critical";
  if (severity === "high") return "high";
  if (severity === "low") return "low";
  return "medium";
}

export function normalizeBreachSeverity(risk: string): NormalizedSeverity {
  if (risk === "high") return "critical";
  if (risk === "medium") return "high";
  if (risk === "low") return "medium";
  return "medium";
}

// ─── Aggregate Analytics ──────────────────────────────────────

export interface CrossFindingAggregate {
  total: number;
  byModule: Record<FindingModule, number>;
  bySeverity: Record<NormalizedSeverity, number>;
  byStatus: Record<NormalizedStatus, number>;
  openCount: number;
  overdueCount: number;
  criticalOpenCount: number;
  oldestOpenAgeDays: number | null;
  averageResolutionDays: number | null;
}

const SEVERITY_WEIGHT: Record<NormalizedSeverity, number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 20,
  observation: 5,
};

export function aggregateCrossFindings(
  findings: CrossModuleFinding[],
  now: Date = new Date(),
): CrossFindingAggregate {
  const byModule: Record<FindingModule, number> = {
    ics: 0,
    audit: 0,
    isms_cap: 0,
    ai_act_incident: 0,
    ai_act_corrective: 0,
    dpms_breach: 0,
    bcms_exercise: 0,
  };
  const bySeverity: Record<NormalizedSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    observation: 0,
  };
  const byStatus: Record<NormalizedStatus, number> = {
    open: 0,
    in_progress: 0,
    resolved: 0,
    verified: 0,
    closed: 0,
    accepted: 0,
  };

  let openCount = 0;
  let overdueCount = 0;
  let criticalOpenCount = 0;
  let oldestOpenAgeDays: number | null = null;
  const resolutionDurations: number[] = [];

  for (const f of findings) {
    byModule[f.module]++;
    bySeverity[f.severity]++;
    byStatus[f.status]++;

    const isOpen = f.status === "open" || f.status === "in_progress";
    if (isOpen) {
      openCount++;
      if (f.severity === "critical") criticalOpenCount++;
      const ageDays = Math.floor(
        (now.getTime() - f.identifiedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (oldestOpenAgeDays === null || ageDays > oldestOpenAgeDays) {
        oldestOpenAgeDays = ageDays;
      }
      if (f.dueDate && f.dueDate.getTime() < now.getTime()) {
        overdueCount++;
      }
    }

    if (
      f.status === "resolved" ||
      f.status === "verified" ||
      f.status === "closed"
    ) {
      // Resolution-Duration approx by dueDate - identifiedAt (Proxy; echte
      // remediatedAt wird via DB-Query im Route aggregiert)
    }
  }

  return {
    total: findings.length,
    byModule,
    bySeverity,
    byStatus,
    openCount,
    overdueCount,
    criticalOpenCount,
    oldestOpenAgeDays,
    averageResolutionDays:
      resolutionDurations.length > 0
        ? Math.round(
            resolutionDurations.reduce((a, b) => a + b, 0) /
              resolutionDurations.length,
          )
        : null,
  };
}

// ─── Priority Scoring ─────────────────────────────────────────
//
// Score = severity_weight * (1 + age_boost) * (1 + overdue_boost)
// - age_boost: 0.05 per 7 days open (max +0.5)
// - overdue_boost: +0.5 if overdue, +1.0 if > 30d overdue

export interface PrioritizedFinding extends CrossModuleFinding {
  priorityScore: number;
  isOverdue: boolean;
  daysOpen: number;
}

export function prioritizeFindings(
  findings: CrossModuleFinding[],
  now: Date = new Date(),
): PrioritizedFinding[] {
  return findings
    .map((f) => {
      const daysOpen = Math.floor(
        (now.getTime() - f.identifiedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const isOverdue =
        f.dueDate !== null && f.dueDate.getTime() < now.getTime();
      const daysOverdue =
        isOverdue && f.dueDate
          ? Math.floor(
              (now.getTime() - f.dueDate.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 0;

      const ageBoost = Math.min((daysOpen / 7) * 0.05, 0.5);
      let overdueBoost = 0;
      if (isOverdue) {
        overdueBoost = daysOverdue > 30 ? 1.0 : 0.5;
      }

      const base = SEVERITY_WEIGHT[f.severity];
      const priorityScore = Math.round(
        base * (1 + ageBoost) * (1 + overdueBoost),
      );

      return {
        ...f,
        priorityScore,
        isOverdue,
        daysOpen,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
