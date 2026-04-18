// DPMS AVV / Processor-Agreement Helpers (GDPR Art. 28)
//
// processorAgreement hat kein dediziertes pgEnum fuer Status -- wir
// arbeiten mit varchar + eigenem Typ fuer Consistent-Validation.

export type AvvAgreementStatus =
  | "pending"
  | "negotiated"
  | "signed"
  | "active"
  | "expired"
  | "terminated";

export const AVV_ALLOWED_TRANSITIONS: Record<AvvAgreementStatus, AvvAgreementStatus[]> = {
  pending: ["negotiated", "terminated"],
  negotiated: ["signed", "pending", "terminated"],
  signed: ["active", "terminated"],
  active: ["expired", "terminated"],
  expired: ["active", "terminated"], // Reaktivierung nach Renewal
  terminated: [],
};

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

export interface AvvSnapshot {
  agreementStatus: AvvAgreementStatus;
  processorName: string | null;
  processorDpoContact: string | null;
  processingActivities: unknown;
  agreementDocumentId: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  reviewDate: string | null;
  overallComplianceStatus: string | null;
}

/** AVV-Activation-Gate: Art. 28(3) Pflicht-Inhalte */
export function validateAvvGateActivate(snapshot: AvvSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.processorName) {
    blockers.push({ code: "missing_processor", message: "Processor-Name muss gesetzt sein.", gate: "AVV-1", severity: "error" });
  }

  if (!snapshot.processorDpoContact) {
    blockers.push({
      code: "missing_dpo_contact",
      message: "Art. 28(3)(h): DPO-Contact des Processors muss dokumentiert sein.",
      gate: "AVV-1",
      severity: "error",
    });
  }

  if (!Array.isArray(snapshot.processingActivities) || (snapshot.processingActivities as unknown[]).length === 0) {
    blockers.push({
      code: "missing_processing_activities",
      message: "Art. 28(3)(a): Processing-Activities muessen benannt sein.",
      gate: "AVV-1",
      severity: "error",
    });
  }

  if (!snapshot.agreementDocumentId) {
    blockers.push({
      code: "missing_agreement_document",
      message: "Signed-Agreement-Document muss verknuepft sein.",
      gate: "AVV-1",
      severity: "error",
    });
  }

  if (!snapshot.effectiveDate) {
    blockers.push({
      code: "missing_effective_date",
      message: "effectiveDate muss gesetzt sein.",
      gate: "AVV-1",
      severity: "error",
    });
  }

  if (!snapshot.expiryDate) {
    blockers.push({
      code: "missing_expiry_date",
      message: "expiryDate empfohlen -- Auto-Review-Trigger.",
      gate: "AVV-1",
      severity: "warning",
    });
  }

  return blockers;
}

export interface AvvTransitionRequest {
  currentStatus: AvvAgreementStatus;
  targetStatus: AvvAgreementStatus;
  snapshot: AvvSnapshot;
}

export interface AvvTransitionResult {
  allowed: boolean;
  blockers: Blocker[];
  updates?: Partial<AvvSnapshot>;
}

export function validateAvvTransition(req: AvvTransitionRequest): AvvTransitionResult {
  const { currentStatus, targetStatus, snapshot } = req;

  const allowed = AVV_ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    return {
      allowed: false,
      blockers: [{
        code: "invalid_transition",
        message: `Transition ${currentStatus} → ${targetStatus} nicht erlaubt.`,
        gate: "state_machine",
        severity: "error",
      }],
    };
  }

  let gateBlockers: Blocker[] = [];
  if (currentStatus === "signed" && targetStatus === "active") {
    gateBlockers = validateAvvGateActivate(snapshot);
  }

  if (gateBlockers.some((b) => b.severity === "error")) {
    return { allowed: false, blockers: gateBlockers };
  }

  return { allowed: true, blockers: gateBlockers, updates: { agreementStatus: targetStatus } };
}

// ─── AVV-Review-Helper ──────────────────────────────────────────

export interface AvvReviewStatus {
  daysSinceLastReview: number | null;
  overdueForReview: boolean;
  daysUntilExpiry: number | null;
  expiringSoon: boolean; // < 90 Tage
}

export function checkAvvReviewStatus(
  reviewDate: Date | null,
  expiryDate: Date | null,
  now: Date = new Date(),
): AvvReviewStatus {
  const DAY_MS = 24 * 60 * 60 * 1000;

  const daysSinceLastReview = reviewDate
    ? Math.floor((now.getTime() - reviewDate.getTime()) / DAY_MS)
    : null;

  const overdueForReview = daysSinceLastReview !== null && daysSinceLastReview > 365;

  const daysUntilExpiry = expiryDate
    ? Math.floor((expiryDate.getTime() - now.getTime()) / DAY_MS)
    : null;

  const expiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry < 90;

  return {
    daysSinceLastReview,
    overdueForReview,
    daysUntilExpiry,
    expiringSoon,
  };
}
