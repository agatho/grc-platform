// DPMS DPIA State-Machine (GDPR Art. 35)
//
// Referenz: docs/assessment-plans/03-dpms-assessment-plan.md §3.3
// DB-Enum `dpia_status`: draft | in_progress | completed | pending_dpo_review | approved | rejected

import type { DpiaStatus } from "../types/dpms";
export type { DpiaStatus };

export const DPIA_ALLOWED_TRANSITIONS: Record<DpiaStatus, DpiaStatus[]> = {
  draft: ["in_progress"],
  in_progress: ["completed", "draft"],
  completed: ["pending_dpo_review", "in_progress"],
  pending_dpo_review: ["approved", "rejected", "in_progress"],
  approved: ["in_progress"], // Re-Assessment bei Process-Change
  rejected: ["in_progress"],
};

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

export interface DpiaSnapshot {
  status: DpiaStatus;
  title: string | null;
  processingDescription: string | null;
  necessityAssessment: string | null;
  systematicDescription: string | null;
  dataCategories: string[] | null;
  dataSubjectCategories: string[] | null;
  riskCount: number;
  measureCount: number;
  mitigatedRiskCount: number;
  dpoOpinion: string | null;
  consultationDate: string | null;
  residualRiskSignOffId: string | null;
  priorConsultationRequired: boolean;
}

/** G3a: Draft -> In-Progress -- Basics gesetzt */
export function validateDpiaGate3Start(snapshot: DpiaSnapshot): Blocker[] {
  const blockers: Blocker[] = [];
  if (!snapshot.title || snapshot.title.trim().length === 0) {
    blockers.push({ code: "missing_title", message: "DPIA braucht Titel.", gate: "G3a", severity: "error" });
  }
  if (!snapshot.processingDescription || snapshot.processingDescription.trim().length < 50) {
    blockers.push({
      code: "processing_description_too_short",
      message: "Processing-Description muss mindestens 50 Zeichen umfassen.",
      gate: "G3a",
      severity: "error",
    });
  }
  return blockers;
}

/** G3b: In-Progress -> Completed -- Art. 35(7)(a-d) Inhalte + Risks + Measures */
export function validateDpiaGate3Complete(snapshot: DpiaSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.systematicDescription || snapshot.systematicDescription.trim().length < 100) {
    blockers.push({
      code: "missing_systematic_description",
      message: "Art. 35(7)(a): Systematic-Description muss mind. 100 Zeichen umfassen.",
      gate: "G3b",
      severity: "error",
    });
  }
  if (!snapshot.necessityAssessment || snapshot.necessityAssessment.trim().length < 50) {
    blockers.push({
      code: "missing_necessity_assessment",
      message: "Art. 35(7)(b): Necessity+Proportionality-Assessment erforderlich.",
      gate: "G3b",
      severity: "error",
    });
  }
  if (!snapshot.dataCategories || snapshot.dataCategories.length === 0) {
    blockers.push({
      code: "missing_data_categories",
      message: "Mindestens 1 dataCategory muss dokumentiert sein.",
      gate: "G3b",
      severity: "error",
    });
  }
  if (!snapshot.dataSubjectCategories || snapshot.dataSubjectCategories.length === 0) {
    blockers.push({
      code: "missing_subject_categories",
      message: "Mindestens 1 dataSubjectCategory muss dokumentiert sein.",
      gate: "G3b",
      severity: "error",
    });
  }
  if (snapshot.riskCount === 0) {
    blockers.push({
      code: "no_risks",
      message: "Art. 35(7)(c): Mindestens 1 dpia_risk muss identifiziert sein.",
      gate: "G3b",
      severity: "error",
    });
  }
  if (snapshot.measureCount === 0) {
    blockers.push({
      code: "no_measures",
      message: "Art. 35(7)(d): Mindestens 1 dpia_measure muss entworfen sein.",
      gate: "G3b",
      severity: "error",
    });
  }
  if (snapshot.riskCount > 0 && snapshot.mitigatedRiskCount / snapshot.riskCount < 0.8) {
    blockers.push({
      code: "insufficient_mitigation",
      message: `Nur ${snapshot.mitigatedRiskCount}/${snapshot.riskCount} Risks haben Measures. Mindestens 80% Abdeckung vor Completion.`,
      gate: "G3b",
      severity: "warning",
    });
  }
  return blockers;
}

/** G3c: Pending_Dpo_Review -> Approved -- DPO-Opinion + Sign-Off */
export function validateDpiaGate3Approve(snapshot: DpiaSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.dpoOpinion || snapshot.dpoOpinion.trim().length < 50) {
    blockers.push({
      code: "missing_dpo_opinion",
      message: "DPO-Opinion muss dokumentiert sein (Art. 35(2)).",
      gate: "G3c",
      severity: "error",
    });
  }

  if (!snapshot.residualRiskSignOffId) {
    blockers.push({
      code: "missing_sign_off",
      message: "Residual-Risk-Sign-Off (Approver) erforderlich.",
      gate: "G3c",
      severity: "error",
    });
  }

  if (snapshot.priorConsultationRequired && !snapshot.consultationDate) {
    blockers.push({
      code: "prior_consultation_overdue",
      message: "Prior-Consultation (Art. 36) erforderlich aber noch nicht erfolgt.",
      gate: "G3c",
      severity: "error",
    });
  }

  return blockers;
}

export interface DpiaTransitionRequest {
  currentStatus: DpiaStatus;
  targetStatus: DpiaStatus;
  snapshot: DpiaSnapshot;
}

export interface DpiaTransitionResult {
  allowed: boolean;
  blockers: Blocker[];
  updates?: Partial<DpiaSnapshot>;
}

export function validateDpiaTransition(req: DpiaTransitionRequest): DpiaTransitionResult {
  const { currentStatus, targetStatus, snapshot } = req;

  const allowed = DPIA_ALLOWED_TRANSITIONS[currentStatus] ?? [];
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
  if (currentStatus === "draft" && targetStatus === "in_progress") {
    gateBlockers = validateDpiaGate3Start(snapshot);
  }
  if (currentStatus === "in_progress" && targetStatus === "completed") {
    gateBlockers = validateDpiaGate3Complete(snapshot);
  }
  if (currentStatus === "pending_dpo_review" && targetStatus === "approved") {
    gateBlockers = validateDpiaGate3Approve(snapshot);
  }

  if (gateBlockers.some((b) => b.severity === "error")) {
    return { allowed: false, blockers: gateBlockers };
  }

  return { allowed: true, blockers: gateBlockers, updates: { status: targetStatus } };
}
