// BPM Overhaul Phase 3: structured gate-checks for process state transitions.
//
// Returns an array of blockers — empty array means the transition is allowed.
// Each blocker has a stable machine-readable `code` so the UI can localize.

import { sql } from "drizzle-orm";
// [ARCTOS-FULL-2026-08-31 / WP12 · S14-19] drizzle transaction type; replaced
// the `any` that stood on every `tx` parameter here.
import type { DbTransaction } from "@/lib/db-types";

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-19] Row shape for the raw-SQL reads
 * below, which were cast `as any[]`. `any` meant a renamed column silently
 * produced `undefined` and a gate that passed instead of blocking — in
 * modules whose entire purpose is to refuse a release. `Record<string,
 * unknown>` keeps the property access explicit while restoring the check that
 * the value is used as something.
 */
type SqlRow = Record<string, unknown>;

export interface GateBlocker {
  code: string;
  gate: string;
  message: string; // English fallback; UI overrides via i18n by code
  severity: "error" | "warning";
}

export type ProcessStatus =
  "draft" | "in_review" | "approved" | "published" | "archived";

interface CheckArgs {
  // [WP12 · S14-19] was `tx: any` — see lib/db-types.ts
  tx: DbTransaction;
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
  `)) as SqlRow[];

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
      -- [E2E-TRIAGE-2026-09-02 · C-14] The two NOT IN lists below each named a
      -- label its enum does not have, and PostgreSQL rejects the whole
      -- statement with SQLSTATE 22P02 (invalid input value for enum) rather
      -- than ignoring the unknown value. Because this query runs on EVERY
      -- process status transition, PUT /api/v1/processes/:id/status answered
      -- 500 for every draft -> in_review -> approved -> published step: the
      -- whole BPMN approval and publication workflow was unreachable. It was
      -- invisible until now only because C-09 stopped the callers before they
      -- ever reached this route.
      --
      -- Measured against the database:
      --   finding_status = identified, in_remediation, remediated, verified,
      --                    accepted, closed          -> no 'cancelled'
      --   risk_status    = identified, assessed, treated, accepted, closed,
      --                    reopened                  -> no 'mitigated'
      -- Only the two impossible labels are dropped; which of the REAL labels
      -- count as "closed out" is unchanged, so the gate keeps exactly the
      -- meaning it was written with.
      (SELECT COUNT(*) FROM finding f
         WHERE f.org_id = ${orgId}
           AND f.deleted_at IS NULL
           AND f.status NOT IN ('verified', 'closed', 'remediated')
           AND (f.process_id = ${processId} OR f.process_step_id IN (SELECT id FROM process_step WHERE process_id = ${processId}))
      )::int AS open_findings,
      (SELECT COUNT(*) FROM risk r
         WHERE r.org_id = ${orgId}
           AND r.deleted_at IS NULL
           AND r.status NOT IN ('treated', 'accepted', 'closed')
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
  `)) as SqlRow[];

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
