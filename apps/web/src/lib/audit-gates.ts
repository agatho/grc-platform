// Audit Overhaul Phase 1: structured gate-blockers for audit lifecycle.
//
// Status machine: planned → preparation → fieldwork → reporting → review
//                 → completed (or cancelled)

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

export interface AuditGateBlocker {
  code: string;
  gate: string;
  message: string;
  severity: "error" | "warning";
}

export type AuditStatus =
  | "planned"
  | "preparation"
  | "fieldwork"
  | "reporting"
  | "review"
  | "completed"
  | "cancelled";

interface Args {
  // [WP12 · S14-19] was `tx: any` — see lib/db-types.ts
  tx: DbTransaction;
  auditId: string;
  orgId: string;
  target: AuditStatus;
}

export async function evaluateAuditGates({
  tx,
  auditId,
  orgId,
  target,
}: Args): Promise<AuditGateBlocker[]> {
  const blockers: AuditGateBlocker[] = [];

  const [a] = (await tx.execute(sql`
    SELECT a.id, a.status, a.lead_auditor_id, a.scope_description,
           a.actual_start, a.actual_end, a.conclusion, a.report_document_id
    FROM audit a
    WHERE a.id = ${auditId} AND a.org_id = ${orgId} AND a.deleted_at IS NULL
  `)) as SqlRow[];
  if (!a) {
    return [
      {
        code: "audit_not_found",
        gate: "preflight",
        message: "Audit not found",
        severity: "error",
      },
    ];
  }

  const [stats] = (await tx.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM audit_checklist WHERE audit_id = ${auditId})::int AS checklist_count,
      (SELECT COUNT(*) FROM audit_checklist_item ci
         JOIN audit_checklist c ON c.id = ci.audit_checklist_id
         WHERE c.audit_id = ${auditId})::int AS item_count,
      (SELECT COUNT(*) FROM audit_checklist_item ci
         JOIN audit_checklist c ON c.id = ci.audit_checklist_id
         WHERE c.audit_id = ${auditId} AND ci.result IS NULL)::int AS unrated_items,
      (SELECT COUNT(*) FROM audit_evidence WHERE audit_id = ${auditId})::int AS evidence_count,
      (SELECT COUNT(*) FROM finding f
         WHERE f.org_id = ${orgId} AND f.audit_id = ${auditId} AND f.deleted_at IS NULL)::int AS finding_count,
      (SELECT COUNT(*) FROM finding f
         WHERE f.org_id = ${orgId} AND f.audit_id = ${auditId} AND f.deleted_at IS NULL
           AND f.status NOT IN ('verified','closed','cancelled','remediated'))::int AS open_finding_count
  `)) as SqlRow[];

  const checklistCount = Number(stats?.checklist_count ?? 0);
  const itemCount = Number(stats?.item_count ?? 0);
  const unrated = Number(stats?.unrated_items ?? 0);
  const evidenceCount = Number(stats?.evidence_count ?? 0);
  const openFindings = Number(stats?.open_finding_count ?? 0);

  // planned → preparation
  if (target === "preparation") {
    if (!a.lead_auditor_id) {
      blockers.push({
        code: "missing_lead_auditor",
        gate: "planned_to_preparation",
        message: "Lead auditor must be assigned.",
        severity: "error",
      });
    }
    if (
      !a.scope_description ||
      String(a.scope_description).trim().length < 20
    ) {
      blockers.push({
        code: "weak_scope",
        gate: "planned_to_preparation",
        message: "Scope description must be at least 20 characters.",
        severity: "warning",
      });
    }
  }

  // preparation → fieldwork
  if (target === "fieldwork") {
    if (checklistCount === 0) {
      blockers.push({
        code: "no_checklist",
        gate: "preparation_to_fieldwork",
        message: "At least one checklist must exist before fieldwork.",
        severity: "error",
      });
    }
    if (itemCount === 0) {
      blockers.push({
        code: "empty_checklist",
        gate: "preparation_to_fieldwork",
        message: "Checklist contains no items.",
        severity: "error",
      });
    }
  }

  // fieldwork → reporting
  if (target === "reporting") {
    if (unrated > 0) {
      blockers.push({
        code: "unrated_items",
        gate: "fieldwork_to_reporting",
        message: `${unrated} checklist item(s) are not yet rated.`,
        severity: "error",
      });
    }
    if (evidenceCount === 0) {
      blockers.push({
        code: "no_evidence",
        gate: "fieldwork_to_reporting",
        message: "At least one evidence record is required before reporting.",
        severity: "warning",
      });
    }
  }

  // reporting → review
  if (target === "review") {
    if (!a.conclusion) {
      blockers.push({
        code: "missing_conclusion",
        gate: "reporting_to_review",
        message: "Audit conclusion must be set.",
        severity: "error",
      });
    }
  }

  // review → completed
  if (target === "completed") {
    if (openFindings > 0) {
      blockers.push({
        code: "open_findings",
        gate: "review_to_completed",
        message: `${openFindings} open finding(s) remain — completing the audit closes the fieldwork but leaves remediation open. Confirm intent.`,
        severity: "warning",
      });
    }
    if (!a.report_document_id) {
      blockers.push({
        code: "missing_report_document",
        gate: "review_to_completed",
        message: "Audit report document should be attached before completion.",
        severity: "warning",
      });
    }
  }

  return blockers;
}
