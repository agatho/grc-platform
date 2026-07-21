// BPM Overhaul Phase 3: structured gate-checks for process state transitions.
//
// Returns an array of blockers — empty array means the transition is allowed.
// Each blocker has a stable machine-readable `code` so the UI can localize.

import { sql } from "drizzle-orm";

export interface GateBlocker {
  code: string;
  gate: string;
  message: string; // English fallback; UI overrides via i18n by code
  severity: "error" | "warning";
}

export type ProcessStatus =
  "draft" | "in_review" | "approved" | "published" | "archived";

interface CheckArgs {
  tx: any;
  processId: string;
  orgId: string;
  target: ProcessStatus;
}

export async function evaluateTransitionGates({
  tx,
  processId,
  orgId,
  target,
}: CheckArgs): Promise<GateBlocker[]> {
  const blockers: GateBlocker[] = [];

  const [proc] = (await tx.execute(sql`
    SELECT p.id, p.name, p.status, p.process_owner_id, p.reviewer_id,
           p.is_critical_process, p.description
    FROM process p
    WHERE p.id = ${processId} AND p.org_id = ${orgId} AND p.deleted_at IS NULL
  `)) as any[];

  if (!proc) {
    return [
      {
        code: "process_not_found",
        gate: "preflight",
        message: "Process not found",
        severity: "error",
      },
    ];
  }

  const [stats] = (await tx.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM process_step WHERE process_id = ${processId} AND deleted_at IS NULL)::int AS activities,
      (SELECT COUNT(*) FROM process_step WHERE process_id = ${processId} AND deleted_at IS NULL AND (description IS NULL OR description = ''))::int AS activities_without_desc,
      (SELECT COUNT(*) FROM process_version WHERE process_id = ${processId})::int AS versions,
      (SELECT COUNT(*) FROM process_framework_mapping WHERE process_id = ${processId})::int AS framework_mappings,
      (SELECT COUNT(*) FROM finding f
         WHERE f.org_id = ${orgId}
           AND f.deleted_at IS NULL
           AND f.status NOT IN ('verified', 'closed', 'cancelled', 'remediated')
           AND (f.process_id = ${processId} OR f.process_step_id IN (SELECT id FROM process_step WHERE process_id = ${processId}))
      )::int AS open_findings,
      (SELECT COUNT(*) FROM risk r
         WHERE r.org_id = ${orgId}
           AND r.deleted_at IS NULL
           AND r.status NOT IN ('treated', 'accepted', 'mitigated', 'closed')
           AND r.id IN (
             SELECT risk_id FROM process_risk WHERE process_id = ${processId}
             UNION
             SELECT psr.risk_id FROM process_step_risk psr
             JOIN process_step ps ON ps.id = psr.process_step_id
             WHERE ps.process_id = ${processId}
           )
      )::int AS untreated_risks,
      -- B2.2: a valid process_owner sign-off must exist for the current
      -- version before the process may be published.
      (SELECT COUNT(*) FROM process_sign_off pso
         JOIN process_version pv ON pv.id = pso.process_version_id
         WHERE pso.process_id = ${processId}
           AND pso.org_id = ${orgId}
           AND pso.signer_role = 'process_owner'
           AND pv.is_current = true
      )::int AS owner_sign_offs
  `)) as any[];

  const activities = Number(stats?.activities ?? 0);
  const activitiesWithoutDesc = Number(stats?.activities_without_desc ?? 0);
  const versions = Number(stats?.versions ?? 0);
  const frameworkMappings = Number(stats?.framework_mappings ?? 0);
  const openFindings = Number(stats?.open_findings ?? 0);
  const untreatedRisks = Number(stats?.untreated_risks ?? 0);
  const ownerSignOffs = Number(stats?.owner_sign_offs ?? 0);

  // Gate: draft → in_review
  if (target === "in_review") {
    if (!proc.process_owner_id) {
      blockers.push({
        code: "missing_process_owner",
        gate: "draft_to_in_review",
        message: "Process owner must be assigned before review.",
        severity: "error",
      });
    }
    if (activities === 0) {
      blockers.push({
        code: "no_activities",
        gate: "draft_to_in_review",
        message: "Process must contain at least one activity.",
        severity: "error",
      });
    }
    if (versions === 0) {
      blockers.push({
        code: "no_versions",
        gate: "draft_to_in_review",
        message: "Process must have at least one version before review.",
        severity: "error",
      });
    }
    if (untreatedRisks > 0) {
      blockers.push({
        code: "untreated_risks",
        gate: "draft_to_in_review",
        message: `${untreatedRisks} linked risk(s) are not yet treated.`,
        severity: "warning",
      });
    }
  }

  // Gate: in_review → approved
  if (target === "approved") {
    if (!proc.reviewer_id) {
      blockers.push({
        code: "missing_reviewer",
        gate: "in_review_to_approved",
        message: "Reviewer must be assigned before approval.",
        severity: "error",
      });
    }
    if (activitiesWithoutDesc > 0) {
      blockers.push({
        code: "activities_missing_description",
        gate: "in_review_to_approved",
        message: `${activitiesWithoutDesc} activity/-ies are missing a description.`,
        severity: "error",
      });
    }
  }

  // Gate: approved → published
  if (target === "published") {
    if (openFindings > 0) {
      blockers.push({
        code: "open_findings",
        gate: "approved_to_published",
        message: `${openFindings} open finding(s) must be resolved before publication.`,
        severity: "error",
      });
    }
    if (frameworkMappings === 0) {
      blockers.push({
        code: "no_framework_mapping",
        gate: "approved_to_published",
        message:
          "At least one framework mapping (ISO/NIS2/GDPR/...) is required for publication.",
        severity: "error",
      });
    }
    // B2.2: hard blocker — publication requires a cryptographic sign-off
    // (process_sign_off hash chain) of the process_owner for the current
    // version.
    if (ownerSignOffs === 0) {
      blockers.push({
        code: "missing_owner_sign_off",
        gate: "approved_to_published",
        message:
          "A process-owner sign-off for the current version is required before publication.",
        severity: "error",
      });
    }
    if (!proc.description || String(proc.description).trim().length < 20) {
      blockers.push({
        code: "weak_description",
        gate: "approved_to_published",
        message:
          "Process description must be at least 20 characters before publication.",
        severity: "warning",
      });
    }
  }

  return blockers;
}
