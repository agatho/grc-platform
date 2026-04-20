import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/audit-log/integrity
//
// ADR-011 rev.2: verifies the SHA-256 hash chain of audit_log with
// per-tenant scope. Rev.1 had one global chain across all tenants —
// that design is superseded. This route now returns two numbers:
//
//   - This tenant's chain (previous_hash_scope = 'org:<ctx.orgId>')
//     — every row's entry_hash is recomputable from its fields, and
//     every row's previous_hash matches the prior row's entry_hash.
//     If either check fails the chain is broken and the response is
//     503 with pointers to the offending rows.
//
//   - Legacy chain (previous_hash_scope IS NULL) — rows written under
//     the rev.1 global-chain design before this tenant was migrated to
//     per-tenant. They are reported as "legacy" and excluded from the
//     healthy computation. This preserves forensic visibility without
//     failing the integrity check on pre-migration data.
//
// Row-hash recomputation matches the trigger formula in migration 0284:
//   sha256(previous_hash | org_id | user_id | entity_type | entity_id |
//          action | changes | created_at | scope)
//
// Cross-tenant: this endpoint NEVER discloses data from other tenants.
// The SQL is filtered on org_id up front.

interface RowCheck extends Record<string, unknown> {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  created_at: string;
  stored_entry_hash: string | null;
  recomputed_entry_hash: string | null;
  stored_previous_hash: string | null;
  prev_row_entry_hash: string | null;
  row_ok: boolean;
  chain_ok: boolean;
}

export async function GET(_req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const scope = `org:${ctx.orgId}`;

  // Per-tenant chain verification. LAG window is scoped to this org's
  // rows in chronological order, so the "prev_row_entry_hash" refers
  // strictly to the previous row in THIS tenant's chain.
  const result = await db.execute<RowCheck>(sql`
    WITH ordered AS (
      SELECT
        id,
        entity_type,
        entity_id,
        action,
        created_at,
        entry_hash    AS stored_entry_hash,
        previous_hash AS stored_previous_hash,
        LAG(entry_hash) OVER (ORDER BY created_at, id) AS prev_row_entry_hash,
        encode(digest(
          COALESCE(previous_hash, '0') || '|' ||
          COALESCE(org_id::text, '')   || '|' ||
          COALESCE(user_id::text, '')  || '|' ||
          entity_type                  || '|' ||
          COALESCE(entity_id::text, '')|| '|' ||
          action::text                 || '|' ||
          COALESCE(changes::text, '')  || '|' ||
          created_at::text             || '|' ||
          previous_hash_scope,
          'sha256'
        ), 'hex') AS recomputed_entry_hash
      FROM audit_log
      WHERE previous_hash_scope = ${scope}
    )
    SELECT
      id,
      entity_type,
      entity_id,
      action,
      created_at,
      stored_entry_hash,
      recomputed_entry_hash,
      stored_previous_hash,
      prev_row_entry_hash,
      (stored_entry_hash = recomputed_entry_hash) AS row_ok,
      (COALESCE(stored_previous_hash, '') = COALESCE(prev_row_entry_hash, '')) AS chain_ok
    FROM ordered
    ORDER BY created_at, id
  `);

  const rows: RowCheck[] = Array.isArray(result) ? (result as RowCheck[]) : [];

  const rowMismatches = rows.filter((r) => !r.row_ok);
  const chainMismatches = rows.filter((r) => !r.chain_ok);

  const healthy = rowMismatches.length === 0 && chainMismatches.length === 0;

  // Separate count of pre-rev2 legacy rows (NULL scope). They are not
  // verifiable under per-tenant semantics and are reported informationally.
  const [{ legacy_count }] = await db.execute<{ legacy_count: number }>(sql`
    SELECT count(*)::int AS legacy_count
    FROM audit_log
    WHERE org_id = ${ctx.orgId}
      AND previous_hash_scope IS NULL
  `);

  return Response.json(
    {
      data: {
        scope,
        total: rows.length,
        rowVerified: rows.length - rowMismatches.length,
        chainVerified: rows.length - chainMismatches.length,
        rowMismatches: rowMismatches.slice(0, 50).map((r) => ({
          id: r.id,
          entityType: r.entity_type,
          entityId: r.entity_id,
          action: r.action,
          createdAt: r.created_at,
          storedEntryHash: r.stored_entry_hash,
          recomputedEntryHash: r.recomputed_entry_hash,
        })),
        chainMismatches: chainMismatches.slice(0, 50).map((r) => ({
          id: r.id,
          entityType: r.entity_type,
          entityId: r.entity_id,
          action: r.action,
          createdAt: r.created_at,
          storedPreviousHash: r.stored_previous_hash,
          expectedPreviousHash: r.prev_row_entry_hash,
        })),
        legacyRowCount: legacy_count,
        healthy,
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
