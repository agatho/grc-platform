// TPRM Overhaul: vendor lifecycle gate-blockers.
// prospect → onboarding → active → under_review → suspended → terminated

import { sql } from "drizzle-orm";

export interface VendorGateBlocker {
  code: string;
  gate: string;
  message: string;
  severity: "error" | "warning";
}

export type VendorStatus =
  | "prospect"
  | "onboarding"
  | "active"
  | "under_review"
  | "suspended"
  | "terminated";

interface Args {
  tx: any;
  vendorId: string;
  orgId: string;
  target: VendorStatus;
}

export async function evaluateVendorGates({
  tx,
  vendorId,
  orgId,
  target,
}: Args): Promise<VendorGateBlocker[]> {
  const blockers: VendorGateBlocker[] = [];

  const [v] = (await tx.execute(sql`
    SELECT v.id, v.name, v.status, v.tier, v.owner_id, v.country,
           v.dora_critical_ict, v.lksg_tier_1,
           (SELECT COUNT(*) FROM vendor_due_diligence
              WHERE vendor_id = v.id AND status = 'completed')::int AS completed_dd,
           (SELECT COUNT(*) FROM vendor_due_diligence
              WHERE vendor_id = v.id AND status = 'in_progress')::int AS in_progress_dd,
           (SELECT COUNT(*) FROM contract
              WHERE vendor_id = v.id AND status = 'active' AND deleted_at IS NULL)::int AS active_contracts,
           (SELECT COUNT(*) FROM lksg_assessment
              WHERE vendor_id = v.id AND status = 'completed')::int AS lksg_assessments,
           (SELECT COUNT(*) FROM vendor_exit_plan
              WHERE vendor_id = v.id AND status IN ('approved','activated'))::int AS exit_plans
    FROM vendor v
    WHERE v.id = ${vendorId} AND v.org_id = ${orgId} AND v.deleted_at IS NULL
  `)) as any[];

  if (!v) {
    return [{ code: "vendor_not_found", gate: "preflight", message: "Vendor not found", severity: "error" }];
  }

  // prospect → onboarding
  if (target === "onboarding") {
    if (!v.owner_id) {
      blockers.push({
        code: "missing_owner",
        gate: "prospect_to_onboarding",
        message: "Vendor owner / relationship manager must be assigned.",
        severity: "error",
      });
    }
    if (!v.country) {
      blockers.push({
        code: "missing_country",
        gate: "prospect_to_onboarding",
        message: "Country must be set (DORA + LkSG depend on jurisdiction).",
        severity: "warning",
      });
    }
  }

  // onboarding → active
  if (target === "active") {
    if (v.completed_dd === 0) {
      blockers.push({
        code: "no_dd_completed",
        gate: "onboarding_to_active",
        message: "At least one due-diligence must be completed before activation.",
        severity: "error",
      });
    }
    if (v.lksg_tier_1 && v.lksg_assessments === 0) {
      blockers.push({
        code: "lksg_assessment_required",
        gate: "onboarding_to_active",
        message: "LkSG-tier-1 vendor requires a completed LkSG assessment.",
        severity: "error",
      });
    }
    if (v.dora_critical_ict && v.exit_plans === 0) {
      blockers.push({
        code: "dora_exit_plan_required",
        gate: "onboarding_to_active",
        message: "DORA-critical-ICT vendor requires an approved exit plan (Art. 28(8) RTS).",
        severity: "error",
      });
    }
  }

  // → terminated
  if (target === "terminated") {
    if (v.active_contracts > 0) {
      blockers.push({
        code: "active_contracts_remain",
        gate: "active_to_terminated",
        message: `${v.active_contracts} active contract(s) must be terminated or transferred first.`,
        severity: "error",
      });
    }
    if (v.dora_critical_ict && v.exit_plans === 0) {
      blockers.push({
        code: "exit_plan_required_for_dora_critical",
        gate: "active_to_terminated",
        message: "DORA-critical vendor cannot be exited without an activated exit plan.",
        severity: "error",
      });
    }
  }

  return blockers;
}
