// DPMS Overhaul: gate-blocker logic for the DPIA lifecycle.
// Status machine (dpia_status enum):
//   draft → in_progress → pending_dpo_review → approved (or rejected) → completed

import { sql } from "drizzle-orm";

export interface DpiaGateBlocker {
  code: string;
  gate: string;
  message: string;
  severity: "error" | "warning";
}

export type DpiaStatus =
  | "draft"
  | "in_progress"
  | "pending_dpo_review"
  | "approved"
  | "rejected"
  | "completed";

interface Args {
  tx: any;
  dpiaId: string;
  orgId: string;
  target: DpiaStatus;
}

export async function evaluateDpiaGates({
  tx,
  dpiaId,
  orgId,
  target,
}: Args): Promise<DpiaGateBlocker[]> {
  const blockers: DpiaGateBlocker[] = [];

  const [d] = (await tx.execute(sql`
    SELECT d.id, d.title, d.status, d.processing_description, d.legal_basis,
           d.necessity_assessment, d.dpo_consultation_required, d.dpo_opinion,
           d.consultation_result, d.residual_risk_sign_off_id,
           (SELECT COUNT(*) FROM dpia_risk WHERE dpia_id = d.id)::int AS risk_count,
           (SELECT COUNT(*) FROM dpia_measure WHERE dpia_id = d.id)::int AS measure_count,
           (SELECT COUNT(*) FROM dpia_risk WHERE dpia_id = d.id AND residual_risk_score >= 15)::int AS high_residual_count
    FROM dpia d
    WHERE d.id = ${dpiaId} AND d.org_id = ${orgId} AND d.deleted_at IS NULL
  `)) as any[];

  if (!d) {
    return [
      {
        code: "dpia_not_found",
        gate: "preflight",
        message: "DPIA not found",
        severity: "error",
      },
    ];
  }

  if (target === "in_progress") {
    if (
      !d.processing_description ||
      String(d.processing_description).trim().length < 30
    ) {
      blockers.push({
        code: "weak_processing_description",
        gate: "draft_to_in_progress",
        message: "Processing description must be at least 30 characters.",
        severity: "error",
      });
    }
    if (!d.legal_basis) {
      blockers.push({
        code: "missing_legal_basis",
        gate: "draft_to_in_progress",
        message: "Legal basis (Art. 6) must be specified.",
        severity: "error",
      });
    }
  }

  if (target === "pending_dpo_review") {
    if (d.risk_count === 0) {
      blockers.push({
        code: "no_risks_identified",
        gate: "in_progress_to_review",
        message: "At least one risk must be identified.",
        severity: "error",
      });
    }
    if (d.measure_count === 0) {
      blockers.push({
        code: "no_measures",
        gate: "in_progress_to_review",
        message: "At least one mitigating measure must be defined.",
        severity: "error",
      });
    }
    if (!d.necessity_assessment) {
      blockers.push({
        code: "missing_necessity_assessment",
        gate: "in_progress_to_review",
        message:
          "Necessity & proportionality assessment is required (Art. 35(7)(b)).",
        severity: "warning",
      });
    }
  }

  if (target === "approved") {
    if (!d.dpo_opinion) {
      blockers.push({
        code: "missing_dpo_opinion",
        gate: "review_to_approved",
        message: "DPO opinion must be recorded.",
        severity: "error",
      });
    }
    if (d.high_residual_count > 0 && !d.consultation_result) {
      blockers.push({
        code: "missing_authority_consultation",
        gate: "review_to_approved",
        message: `${d.high_residual_count} risk(s) remain high after mitigation — Art. 36 authority consultation likely required.`,
        severity: "warning",
      });
    }
  }

  if (target === "completed") {
    if (!d.residual_risk_sign_off_id) {
      blockers.push({
        code: "missing_residual_signoff",
        gate: "approved_to_completed",
        message:
          "Residual-risk sign-off (controller/management) required before completion.",
        severity: "error",
      });
    }
  }

  return blockers;
}
