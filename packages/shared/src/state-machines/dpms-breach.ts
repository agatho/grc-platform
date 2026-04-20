// DPMS Breach State-Machine + GDPR Art. 33/34 72h-Timer
//
// Referenz: docs/assessment-plans/03-dpms-assessment-plan.md §3.5
// DB-Enum `breach_status`: detected | assessing | notifying_dpa | notifying_individuals | remediation | closed

import type { BreachStatus } from "../types/dpms";
export type { BreachStatus };

export const BREACH_ALLOWED_TRANSITIONS: Record<BreachStatus, BreachStatus[]> =
  {
    detected: ["assessing"],
    assessing: ["notifying_dpa", "remediation", "closed"],
    notifying_dpa: ["notifying_individuals", "remediation"],
    notifying_individuals: ["remediation"],
    remediation: ["closed"],
    closed: [],
  };

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

export interface BreachSnapshot {
  status: BreachStatus;
  title: string | null;
  description: string | null;
  severity: string | null;
  detectedAt: Date | string | null;
  dpaNotifiedAt: Date | string | null;
  individualsNotifiedAt: Date | string | null;
  isDpaNotificationRequired: boolean;
  isIndividualNotificationRequired: boolean;
  dataCategoriesAffected: string[] | null;
  estimatedRecordsAffected: number | null;
  containmentMeasures: string | null;
  remediationMeasures: string | null;
}

/** G9: Detected -> Assessing -- Basis-Info erfasst */
export function validateBreachGate9Assess(snapshot: BreachSnapshot): Blocker[] {
  const blockers: Blocker[] = [];
  if (!snapshot.title || snapshot.title.trim().length === 0) {
    blockers.push({
      code: "missing_title",
      message: "Breach-Titel erforderlich.",
      gate: "G9",
      severity: "error",
    });
  }
  if (!snapshot.detectedAt) {
    blockers.push({
      code: "missing_detected_at",
      message: "detectedAt muss gesetzt sein -- startet den 72h-Timer.",
      gate: "G9",
      severity: "error",
    });
  }
  if (!snapshot.description || snapshot.description.trim().length < 50) {
    blockers.push({
      code: "description_too_short",
      message: "Description muss mindestens 50 Zeichen umfassen.",
      gate: "G9",
      severity: "error",
    });
  }
  return blockers;
}

/** G10: Assessing -> Notifying-DPA -- Art. 33 erforderliche Infos */
export function validateBreachGate10NotifyDpa(
  snapshot: BreachSnapshot,
): Blocker[] {
  const blockers: Blocker[] = [];

  if (
    !snapshot.dataCategoriesAffected ||
    snapshot.dataCategoriesAffected.length === 0
  ) {
    blockers.push({
      code: "missing_data_categories",
      message: "Art. 33(3)(a): Datenkategorien muessen benannt sein.",
      gate: "G10",
      severity: "error",
    });
  }
  if (
    snapshot.estimatedRecordsAffected === null ||
    snapshot.estimatedRecordsAffected === undefined
  ) {
    blockers.push({
      code: "missing_records_count",
      message:
        "Art. 33(3)(a): Anzahl betroffener Datensaetze (Schaetzung) erforderlich.",
      gate: "G10",
      severity: "error",
    });
  }
  if (
    !snapshot.containmentMeasures ||
    snapshot.containmentMeasures.trim().length < 30
  ) {
    blockers.push({
      code: "missing_containment",
      message: "Art. 33(3)(d): Containment-Measures muessen dokumentiert sein.",
      gate: "G10",
      severity: "error",
    });
  }

  // 72h-Check: wenn detected > 72h und nicht notified -> harte Warnung
  if (snapshot.detectedAt) {
    const detectedMs = new Date(snapshot.detectedAt).getTime();
    const hoursSince = (Date.now() - detectedMs) / (1000 * 60 * 60);
    if (hoursSince > 72) {
      blockers.push({
        code: "72h_deadline_exceeded",
        message: `Breach wurde vor ${Math.floor(hoursSince)}h detected. Art. 33(1) 72h-Frist ueberschritten -- Meldung muss Verzoegerungs-Gruende nennen.`,
        gate: "G10",
        severity: "warning",
      });
    }
  }

  return blockers;
}

/** G11: Notifying-DPA -> Notifying-Individuals -- Art. 34 Schwellenwert-Check */
export function validateBreachGate11NotifyIndividuals(
  snapshot: BreachSnapshot,
): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.dpaNotifiedAt) {
    blockers.push({
      code: "dpa_not_notified",
      message:
        "DPA-Meldung muss vor Individuen-Meldung erfolgen (guter Praxis).",
      gate: "G11",
      severity: "warning",
    });
  }

  // Art. 34(1): "high risk" -> required. Schwellwert via severity-Proxy.
  if (snapshot.severity === "high" || snapshot.severity === "critical") {
    if (!snapshot.isIndividualNotificationRequired) {
      blockers.push({
        code: "high_severity_requires_individual_notification",
        message:
          "High/Critical-Severity impliziert hohes Risiko -- Art. 34(1) Individual-Notification erforderlich, sofern keine Ausnahme nach Art. 34(3).",
        gate: "G11",
        severity: "warning",
      });
    }
  }

  return blockers;
}

/** G12: Remediation -> Closed -- RCA + Lessons */
export function validateBreachGate12Close(snapshot: BreachSnapshot): Blocker[] {
  const blockers: Blocker[] = [];
  if (
    !snapshot.remediationMeasures ||
    snapshot.remediationMeasures.trim().length < 50
  ) {
    blockers.push({
      code: "missing_remediation",
      message: "Remediation-Measures muessen dokumentiert sein vor Close.",
      gate: "G12",
      severity: "error",
    });
  }
  if (snapshot.isDpaNotificationRequired && !snapshot.dpaNotifiedAt) {
    blockers.push({
      code: "dpa_notification_required_but_missing",
      message:
        "DPA-Notification erforderlich aber nicht erfolgt -- kann nicht geschlossen werden.",
      gate: "G12",
      severity: "error",
    });
  }
  return blockers;
}

// ─── 72h-Timer-Helpers (Art. 33(1)) ───────────────────────────

export interface BreachDeadline {
  detectedAt: Date;
  deadlineAt: Date;
  now: Date;
  hoursRemaining: number;
  overdue: boolean;
  urgency: "green" | "yellow" | "orange" | "red";
}

export function computeBreachDeadline(
  detectedAt: Date,
  now: Date = new Date(),
): BreachDeadline {
  const HOUR_MS = 60 * 60 * 1000;
  const deadline = new Date(detectedAt.getTime() + 72 * HOUR_MS);
  const hoursRemaining = (deadline.getTime() - now.getTime()) / HOUR_MS;
  const overdue = hoursRemaining < 0;

  let urgency: "green" | "yellow" | "orange" | "red" = "green";
  if (overdue) urgency = "red";
  else if (hoursRemaining < 6) urgency = "red";
  else if (hoursRemaining < 24) urgency = "orange";
  else if (hoursRemaining < 48) urgency = "yellow";

  return {
    detectedAt,
    deadlineAt: deadline,
    now,
    hoursRemaining,
    overdue,
    urgency,
  };
}

export interface BreachTransitionRequest {
  currentStatus: BreachStatus;
  targetStatus: BreachStatus;
  snapshot: BreachSnapshot;
}

export interface BreachTransitionResult {
  allowed: boolean;
  blockers: Blocker[];
  updates?: Partial<BreachSnapshot>;
}

export function validateBreachTransition(
  req: BreachTransitionRequest,
): BreachTransitionResult {
  const { currentStatus, targetStatus, snapshot } = req;

  const allowed = BREACH_ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    return {
      allowed: false,
      blockers: [
        {
          code: "invalid_transition",
          message: `Transition ${currentStatus} → ${targetStatus} nicht erlaubt.`,
          gate: "state_machine",
          severity: "error",
        },
      ],
    };
  }

  let gateBlockers: Blocker[] = [];
  if (currentStatus === "detected" && targetStatus === "assessing") {
    gateBlockers = validateBreachGate9Assess(snapshot);
  }
  if (currentStatus === "assessing" && targetStatus === "notifying_dpa") {
    gateBlockers = validateBreachGate10NotifyDpa(snapshot);
  }
  if (
    currentStatus === "notifying_dpa" &&
    targetStatus === "notifying_individuals"
  ) {
    gateBlockers = validateBreachGate11NotifyIndividuals(snapshot);
  }
  if (currentStatus === "remediation" && targetStatus === "closed") {
    gateBlockers = validateBreachGate12Close(snapshot);
  }

  if (gateBlockers.some((b) => b.severity === "error")) {
    return { allowed: false, blockers: gateBlockers };
  }

  return {
    allowed: true,
    blockers: gateBlockers,
    updates: { status: targetStatus },
  };
}
