// DPMS RoPA State-Machine (GDPR Art. 30)
//
// Referenz: docs/assessment-plans/03-dpms-assessment-plan.md §3.2 + §8 Gate G1.
// DB-Enum `ropa_status`: draft | active | under_review | archived

import type { RopaStatus } from "../types/dpms";
export type { RopaStatus };

export const ROPA_ALLOWED_TRANSITIONS: Record<RopaStatus, RopaStatus[]> = {
  draft: ["active", "archived"],
  active: ["under_review", "archived"],
  under_review: ["active", "archived"],
  archived: [],
};

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

export interface RopaSnapshot {
  status: RopaStatus;
  purposeTitle: string | null;
  purposeDescription: string | null;
  legalBasis: string | null;
  dataCategoryCount: number;
  dataSubjectCount: number;
  recipientCount: number;
  hasDpiaRequired: boolean;
  dpiaId: string | null;
  hasCrossBorderTransfer: boolean;
  hasTiaLinked: boolean;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
}

/** G1: Draft -> Active -- Pflichtfelder + DPO-Review */
export function validateRopaGate1Activate(snapshot: RopaSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.purposeTitle || snapshot.purposeTitle.trim().length === 0) {
    blockers.push({
      code: "missing_purpose_title",
      message: "Processing-Purpose-Title muss gesetzt sein (Art. 30(1)(b)).",
      gate: "G1",
      severity: "error",
    });
  }

  if (
    !snapshot.purposeDescription ||
    snapshot.purposeDescription.trim().length < 50
  ) {
    blockers.push({
      code: "purpose_description_too_short",
      message:
        "Processing-Purpose-Description muss mindestens 50 Zeichen umfassen (klar + spezifisch, Art. 5(1)(b)).",
      gate: "G1",
      severity: "error",
    });
  }

  if (!snapshot.legalBasis) {
    blockers.push({
      code: "missing_legal_basis",
      message: "Legal-Basis muss gesetzt sein (Art. 6).",
      gate: "G1",
      severity: "error",
    });
  }

  if (snapshot.dataCategoryCount === 0) {
    blockers.push({
      code: "no_data_categories",
      message: "Mindestens 1 ropa_data_category muss verknuepft sein.",
      gate: "G1",
      severity: "error",
    });
  }

  if (snapshot.dataSubjectCount === 0) {
    blockers.push({
      code: "no_data_subjects",
      message: "Mindestens 1 ropa_data_subject muss verknuepft sein.",
      gate: "G1",
      severity: "error",
    });
  }

  if (snapshot.recipientCount === 0) {
    blockers.push({
      code: "no_recipients",
      message:
        "Keine Empfaenger dokumentiert. Art. 30 fordert Recipient-Kategorien auch wenn intern-only.",
      gate: "G1",
      severity: "warning",
    });
  }

  if (snapshot.hasDpiaRequired && !snapshot.dpiaId) {
    blockers.push({
      code: "dpia_required_not_linked",
      message: "DPIA-Pflicht erkannt aber kein DPIA verknuepft (Art. 35).",
      gate: "G1",
      severity: "error",
    });
  }

  if (snapshot.hasCrossBorderTransfer && !snapshot.hasTiaLinked) {
    blockers.push({
      code: "cross_border_without_tia",
      message:
        "Drittlandstransfer dokumentiert aber kein TIA vorhanden (Art. 44-49, Schrems II).",
      gate: "G1",
      severity: "error",
    });
  }

  if (!snapshot.reviewedBy || !snapshot.reviewedAt) {
    blockers.push({
      code: "missing_dpo_review",
      message: "DPO-Review muss vor Aktivierung erfolgen.",
      gate: "G1",
      severity: "error",
    });
  }

  return blockers;
}

export interface RopaTransitionRequest {
  currentStatus: RopaStatus;
  targetStatus: RopaStatus;
  snapshot: RopaSnapshot;
}

export interface RopaTransitionResult {
  allowed: boolean;
  blockers: Blocker[];
  updates?: Partial<RopaSnapshot>;
}

export function validateRopaTransition(
  req: RopaTransitionRequest,
): RopaTransitionResult {
  const { currentStatus, targetStatus, snapshot } = req;

  const allowed = ROPA_ALLOWED_TRANSITIONS[currentStatus] ?? [];
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
  if (currentStatus === "draft" && targetStatus === "active") {
    gateBlockers = validateRopaGate1Activate(snapshot);
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

// ─── DPIA-Trigger-Detection (Art. 35 + Catalog #10) ───────────
//
// Per Katalog #10 (DPIA-Criteria, 9 Entries) werden folgende Flags
// aus RoPA-Daten abgeleitet. Wenn >= 2 Flags zutreffen: DPIA-Pflicht.
//
// Diese Logik hier zentral gehalten, damit RoPA-Setup + BPM-Bootstrap
// den gleichen Check verwenden.

export interface DpiaCriteriaFlags {
  /** Systematic monitoring (Video-Surveillance, Tracking) */
  systematicMonitoring: boolean;
  /** Special categories of data (Art. 9, 10) */
  specialCategories: boolean;
  /** Large scale processing */
  largeScale: boolean;
  /** Data matching / combining from multiple sources */
  dataMatching: boolean;
  /** Data concerning vulnerable subjects (children, elderly, employees) */
  vulnerableSubjects: boolean;
  /** Innovative technology (AI, IoT) */
  innovativeTech: boolean;
  /** Prevents data subjects from exercising right (denies service) */
  denyRightExercise: boolean;
  /** Automated decision-making with legal effect (Art. 22) */
  automatedDecisionLegal: boolean;
  /** Biometric / genetic processing */
  biometricGenetic: boolean;
}

export function countDpiaFlags(flags: DpiaCriteriaFlags): number {
  return Object.values(flags).filter((v) => v === true).length;
}

export function isDpiaRequired(flags: DpiaCriteriaFlags): boolean {
  return countDpiaFlags(flags) >= 2;
}
