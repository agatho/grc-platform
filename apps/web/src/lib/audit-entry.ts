// apps/web/src/lib/audit-entry.ts
//
// [E2E-TRIAGE-4 · 2026-09-02] The sanctioned way to write an audit entry that
// does not come from a table trigger.
//
// Measured, not inferred. `document-signature.spec.ts` had skipped itself on
// every recorded run; the moment it ran, `POST /signature-requests/:id/sign`
// answered 500 on
//
//   Failed query: insert into "audit_log" ( … )
//
// and a direct reproduction against the running database, as the runtime role,
// gives the reason:
//
//   $ node repro.cjs postgres://grc_app:…            → 42501
//     permission denied for table audit_log
//
// That is migration `0407_audit_grants_and_migration_anchor.sql` working as
// designed: it grants `grc_app` SELECT on `audit_log` and explicitly REVOKEs
// INSERT/UPDATE/DELETE, with the note that "every write goes through a
// SECURITY DEFINER trigger or through write_audit_entry()". Eight places in
// the application nevertheless wrote `tx.insert(auditLog)` directly — their
// comments say "chained by the BEFORE INSERT trigger on audit_log (migration
// 0401)", which was true of the CHAINING and became false of the PRIVILEGE
// three migrations later. Every one of those paths has been dead since:
//
//   SELECT action_detail, count(*) FROM audit_log
//    WHERE action_detail IN ('signature_chain_anchor',
//          'upload_rejected_infected', 'controlled_copy_watermarked', …)
//   → no rows, out of 8.997 audit entries.
//
// So the trail was missing exactly the events that only these paths record:
// who signed or declined a signature, who downloaded a controlled copy and
// whether it was watermarked, an upload rejected as infected or as
// non-stampable, a GDPR erasure, a bulk process change. Each of them then
// failed the whole request with a 500 — the signature ceremony could not
// complete at all.
//
// `write_audit_entry()` (migration `0404_audit_chain_verification.sql`, §4) is
// the function 0407 names and grants EXECUTE on. It is SECURITY DEFINER, so
// the row is inserted with the owner's rights, and it goes through the same
// BEFORE INSERT chain trigger — scope, `previous_hash`, `content_commitment`
// and `entry_hash` are assigned by `audit_log_chain_assign()` exactly as for a
// trigger-written row.

import { sql } from "drizzle-orm";
import type { DbTransaction } from "./db-types";

export interface AuditEntryInput {
  orgId: string | null;
  userId: string | null;
  userEmail?: string | null;
  userName?: string | null;
  entityType: string;
  entityId?: string | null;
  entityTitle?: string | null;
  /** An `audit_action` value — the function casts it. */
  action: string;
  actionDetail?: string | null;
  changes?: unknown;
  metadata?: unknown;
  /** Must be a valid `inet` literal or null. */
  ipAddress?: string | null;
}

function jsonbParam(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

/**
 * Writes one audit entry through the SECURITY DEFINER helper.
 *
 * Call it inside `withAuditContext`, like the raw insert it replaces: the
 * chain trigger reads `app.current_org_id` / `app.current_user_id`, which that
 * wrapper pins on the transaction's connection.
 */
export async function writeAuditEntry(
  tx: DbTransaction,
  entry: AuditEntryInput,
): Promise<void> {
  await tx.execute(sql`
    SELECT write_audit_entry(
      ${entry.orgId ?? null}::uuid,
      ${entry.userId ?? null}::uuid,
      ${entry.userEmail ?? null}::text,
      ${entry.userName ?? null}::text,
      ${entry.entityType}::text,
      ${entry.entityId ?? null}::uuid,
      ${entry.entityTitle ?? null}::text,
      ${entry.action}::text,
      ${entry.actionDetail ?? null}::text,
      ${jsonbParam(entry.changes)}::jsonb,
      ${jsonbParam(entry.metadata)}::jsonb,
      ${entry.ipAddress ?? null}::inet
    )
  `);
}
