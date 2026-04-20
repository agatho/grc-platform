// BCMS BCP State-Machine
//
// Referenz: docs/assessment-plans/02-bcms-assessment-plan.md §3.5 + §8
// Gates B3 (strategy selected) - B6 (publish).
//
// DB-Enum `bcp_status`: draft | in_review | approved | published | archived | superseded

import type { BcpStatus } from "../types/bcms";
export type { BcpStatus };

export const BCP_ALLOWED_TRANSITIONS: Record<BcpStatus, BcpStatus[]> = {
  draft: ["in_review", "archived"],
  in_review: ["approved", "draft"],
  approved: ["published", "in_review", "archived"],
  published: ["superseded", "archived"],
  superseded: ["archived"],
  archived: [],
};

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

export interface BcpSnapshot {
  status: BcpStatus;
  title: string | null;
  scope: string | null;
  activationCriteria: string | null;
  bcManagerId: string | null;
  processIds: string[] | null;
  procedureCount: number;
  resourceCount: number;
  approvedBy: string | null;
  approvedAt: Date | string | null;
  publishedAt: Date | string | null;
}

/** B3: Draft -> In-Review -- mind. 3 Procedures + Resources + Manager */
export function validateBcpGate3Review(snapshot: BcpSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.title || snapshot.title.trim().length === 0) {
    blockers.push({
      code: "missing_title",
      message: "BCP braucht einen Titel.",
      gate: "B3",
      severity: "error",
    });
  }

  if (!snapshot.scope || snapshot.scope.trim().length < 50) {
    blockers.push({
      code: "scope_too_short",
      message: "Scope-Statement muss mindestens 50 Zeichen umfassen.",
      gate: "B3",
      severity: "error",
    });
  }

  if (
    !snapshot.activationCriteria ||
    snapshot.activationCriteria.trim().length < 30
  ) {
    blockers.push({
      code: "missing_activation_criteria",
      message: "Activation-Criteria muessen definiert sein (mind. 30 Zeichen).",
      gate: "B3",
      severity: "error",
    });
  }

  if (!snapshot.bcManagerId) {
    blockers.push({
      code: "missing_bc_manager",
      message: "BC-Manager muss zugewiesen sein.",
      gate: "B3",
      severity: "error",
    });
  }

  if (snapshot.procedureCount < 3) {
    blockers.push({
      code: "too_few_procedures",
      message: `Mindestens 3 bcp_procedure-Eintraege erforderlich (aktuell: ${snapshot.procedureCount}).`,
      gate: "B3",
      severity: "error",
    });
  }

  if (snapshot.resourceCount === 0) {
    blockers.push({
      code: "no_resources",
      message: "Mindestens 1 bcp_resource sollte dokumentiert sein.",
      gate: "B3",
      severity: "warning",
    });
  }

  if (!snapshot.processIds || snapshot.processIds.length === 0) {
    blockers.push({
      code: "no_processes_linked",
      message: "Der BCP sollte mindestens einen Prozess referenzieren.",
      gate: "B3",
      severity: "warning",
    });
  }

  return blockers;
}

/** B5: Review -> Approved -- Approver (Role='risk_manager' oder 'admin') */
export function validateBcpGate5Approval(
  snapshot: BcpSnapshot,
  approverUserId: string | null,
): Blocker[] {
  const blockers: Blocker[] = [];

  if (!approverUserId) {
    blockers.push({
      code: "missing_approver",
      message: "Approver muss angegeben sein.",
      gate: "B5",
      severity: "error",
    });
  }

  // Wiederhole B3-Checks als harte Gates (niemand approved einen BCP mit fehlenden Procedures)
  const b3 = validateBcpGate3Review(snapshot);
  for (const b of b3) {
    if (b.severity === "error") {
      blockers.push({ ...b, gate: "B5" });
    }
  }

  return blockers;
}

/** B6: Approved -> Published -- zusaetzlich PDF-Export + Physical-Storage-Documentation */
export interface PublishContext {
  reportDocumentId: string | null;
  physicalStorageLocation: string | null;
}

export function validateBcpGate6Publish(
  snapshot: BcpSnapshot,
  ctx: PublishContext,
): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.approvedBy || !snapshot.approvedAt) {
    blockers.push({
      code: "not_approved",
      message:
        "BCP muss zuerst approved sein (status='approved') bevor published werden kann.",
      gate: "B6",
      severity: "error",
    });
  }

  if (!ctx.reportDocumentId) {
    blockers.push({
      code: "missing_pdf_export",
      message:
        "PDF-Export (report_document_id) fehlt -- Offline-Kopie pflicht vor publish.",
      gate: "B6",
      severity: "error",
    });
  }

  if (
    !ctx.physicalStorageLocation ||
    ctx.physicalStorageLocation.trim().length < 10
  ) {
    blockers.push({
      code: "missing_physical_storage",
      message:
        "Physical-Storage-Location dokumentieren (wo liegt die gedruckte BCP-Kopie fuer Offline-Faelle).",
      gate: "B6",
      severity: "warning",
    });
  }

  return blockers;
}

export interface BcpTransitionRequest {
  currentStatus: BcpStatus;
  targetStatus: BcpStatus;
  snapshot: BcpSnapshot;
  approverUserId?: string | null;
  publishCtx?: PublishContext;
}

export interface BcpTransitionResult {
  allowed: boolean;
  blockers: Blocker[];
  updates?: Partial<BcpSnapshot>;
}

export function validateBcpTransition(
  req: BcpTransitionRequest,
): BcpTransitionResult {
  const { currentStatus, targetStatus, snapshot, approverUserId, publishCtx } =
    req;

  const allowed = BCP_ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    return {
      allowed: false,
      blockers: [
        {
          code: "invalid_transition",
          message: `Transition ${currentStatus} → ${targetStatus} nicht erlaubt. Zulaessig: ${allowed.join(", ") || "(keine)"}.`,
          gate: "state_machine",
          severity: "error",
        },
      ],
    };
  }

  let gateBlockers: Blocker[] = [];

  if (currentStatus === "draft" && targetStatus === "in_review") {
    gateBlockers = validateBcpGate3Review(snapshot);
  }

  if (currentStatus === "in_review" && targetStatus === "approved") {
    gateBlockers = validateBcpGate5Approval(snapshot, approverUserId ?? null);
  }

  if (currentStatus === "approved" && targetStatus === "published") {
    gateBlockers = validateBcpGate6Publish(
      snapshot,
      publishCtx ?? { reportDocumentId: null, physicalStorageLocation: null },
    );
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
