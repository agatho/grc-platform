// DPMS DSR State-Machine + GDPR Art. 12(3) 30-Day-Timer
//
// Referenz: docs/assessment-plans/03-dpms-assessment-plan.md §3.4 + §8 G6-G8
// DB-Enum `dsr_status`: received | verified | processing | response_sent | closed | rejected

import type { DsrStatus } from "../types/dpms";
export type { DsrStatus };

export const DSR_ALLOWED_TRANSITIONS: Record<DsrStatus, DsrStatus[]> = {
  received: ["verified", "rejected"],
  verified: ["processing", "rejected"],
  processing: ["response_sent", "rejected"],
  response_sent: ["closed"],
  closed: [],
  rejected: [],
};

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

export interface DsrSnapshot {
  status: DsrStatus;
  requestType: string | null;
  subjectName: string | null;
  subjectEmail: string | null;
  receivedAt: Date | string | null;
  deadline: Date | string | null;
  verifiedAt: Date | string | null;
  respondedAt: Date | string | null;
  closedAt: Date | string | null;
  handlerId: string | null;
  responseArtifactsCount: number;
  identityVerificationDocumented: boolean;
  article19NotificationsSent: boolean;
  extensionApplied: boolean;
}

/** G6: Received -> Verified -- Identity-Verification Art. 12(6) */
export function validateDsrGate6Verify(snapshot: DsrSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.subjectEmail && !snapshot.subjectName) {
    blockers.push({
      code: "missing_subject_identity",
      message: "Subject-Name oder Subject-Email erforderlich.",
      gate: "G6",
      severity: "error",
    });
  }

  if (!snapshot.identityVerificationDocumented) {
    blockers.push({
      code: "identity_not_verified",
      message:
        "Identity-Verification muss dokumentiert sein (Art. 12(6)) bevor Daten geteilt werden.",
      gate: "G6",
      severity: "error",
    });
  }

  return blockers;
}

/** G7: Processing -> Response-Sent -- Handler + Artifacts */
export function validateDsrGate7Response(snapshot: DsrSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.handlerId) {
    blockers.push({
      code: "missing_handler",
      message: "Ein Handler (user) muss zugewiesen sein.",
      gate: "G7",
      severity: "error",
    });
  }

  // Fuer bestimmte Types braucht es Response-Artifacts
  const needsArtifacts =
    snapshot.requestType === "access" || snapshot.requestType === "portability";
  if (needsArtifacts && snapshot.responseArtifactsCount === 0) {
    blockers.push({
      code: "missing_response_artifacts",
      message: `Request-Type '${snapshot.requestType}' erfordert mindestens 1 Response-Artifact (dsr_activity mit artifact-Referenz).`,
      gate: "G7",
      severity: "error",
    });
  }

  return blockers;
}

/** G8: Response-Sent -> Closed -- 30-Tage-Frist gehalten */
export function validateDsrGate8Close(snapshot: DsrSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.respondedAt) {
    blockers.push({
      code: "no_response_sent",
      message:
        "Response wurde nicht als gesendet markiert (respondedAt fehlt).",
      gate: "G8",
      severity: "error",
    });
  }

  // Art. 19 Notification-Check fuer rectification/erasure/restriction
  const needsArticle19 =
    snapshot.requestType === "erasure" ||
    snapshot.requestType === "restriction";
  if (needsArticle19 && !snapshot.article19NotificationsSent) {
    blockers.push({
      code: "article_19_missing",
      message:
        "Art. 19 Notification an Empfaenger (fuer erasure/restriction) nicht dokumentiert.",
      gate: "G8",
      severity: "warning",
    });
  }

  // 30-Tage-Frist-Check
  if (snapshot.receivedAt && snapshot.respondedAt) {
    const received = new Date(snapshot.receivedAt);
    const responded = new Date(snapshot.respondedAt);
    const diffDays =
      (responded.getTime() - received.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 30 && !snapshot.extensionApplied) {
      blockers.push({
        code: "deadline_exceeded_without_extension",
        message: `Antwort nach ${Math.ceil(diffDays)} Tagen -- Art. 12(3)-Frist ist 30 Tage. Extension muss dokumentiert werden.`,
        gate: "G8",
        severity: "error",
      });
    }
    if (diffDays > 90) {
      blockers.push({
        code: "deadline_hard_exceeded",
        message: `Antwort nach ${Math.ceil(diffDays)} Tagen -- auch mit Extension max 90 Tage (3 Monate). Art. 12(3) verletzt.`,
        gate: "G8",
        severity: "error",
      });
    }
  }

  return blockers;
}

// ─── DSR Deadline-Helpers ─────────────────────────────────────

export interface DsrDeadline {
  receivedAt: Date;
  standardDeadline: Date; // +30 Tage
  extendedDeadline: Date; // +90 Tage
  now: Date;
  daysRemaining: number;
  daysExtendedRemaining: number;
  standardOverdue: boolean;
  extendedOverdue: boolean;
  urgency: "green" | "yellow" | "orange" | "red";
}

export function computeDsrDeadline(
  receivedAt: Date,
  now: Date = new Date(),
): DsrDeadline {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const standard = new Date(receivedAt.getTime() + 30 * DAY_MS);
  const extended = new Date(receivedAt.getTime() + 90 * DAY_MS);

  const daysRemaining = Math.ceil(
    (standard.getTime() - now.getTime()) / DAY_MS,
  );
  const daysExtendedRemaining = Math.ceil(
    (extended.getTime() - now.getTime()) / DAY_MS,
  );

  const standardOverdue = now.getTime() > standard.getTime();
  const extendedOverdue = now.getTime() > extended.getTime();

  let urgency: "green" | "yellow" | "orange" | "red" = "green";
  if (extendedOverdue) urgency = "red";
  else if (standardOverdue) urgency = "orange";
  else if (daysRemaining <= 3) urgency = "red";
  else if (daysRemaining <= 7) urgency = "orange";
  else if (daysRemaining <= 14) urgency = "yellow";

  return {
    receivedAt,
    standardDeadline: standard,
    extendedDeadline: extended,
    now,
    daysRemaining,
    daysExtendedRemaining,
    standardOverdue,
    extendedOverdue,
    urgency,
  };
}

export interface DsrTransitionRequest {
  currentStatus: DsrStatus;
  targetStatus: DsrStatus;
  snapshot: DsrSnapshot;
}

export interface DsrTransitionResult {
  allowed: boolean;
  blockers: Blocker[];
  updates?: Partial<DsrSnapshot>;
}

export function validateDsrTransition(
  req: DsrTransitionRequest,
): DsrTransitionResult {
  const { currentStatus, targetStatus, snapshot } = req;

  const allowed = DSR_ALLOWED_TRANSITIONS[currentStatus] ?? [];
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
  if (currentStatus === "received" && targetStatus === "verified") {
    gateBlockers = validateDsrGate6Verify(snapshot);
  }
  if (currentStatus === "processing" && targetStatus === "response_sent") {
    gateBlockers = validateDsrGate7Response(snapshot);
  }
  if (currentStatus === "response_sent" && targetStatus === "closed") {
    gateBlockers = validateDsrGate8Close(snapshot);
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
