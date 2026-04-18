import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/audit-log/integrity
//
// Verifies the SHA-256 hash chain of the `audit_log` table as per ADR-011.
//
// Two independent checks:
//   1. Row-level integrity: re-compute the SHA-256 of every row using the
//      formula from audit_trigger() and compare to the stored entry_hash.
//      A mismatch means the row was tampered with (fields changed after
//      insert) OR the hash formula in the trigger drifted.
//   2. Chain integrity: for each row, its stored `previous_hash` must equal
//      the `entry_hash` of the preceding row (by created_at, id). A mismatch
//      means a row was deleted, inserted out-of-band, or rewritten.
//
// Admin/Auditor-only. Read-only. O(N) over the audit_log.
//
// **Cross-Tenant-Policy**: Die Hash-Chain ist plattform-global (ADR-011),
// aber **diese Route gibt KEINE Metadaten aus anderen Orgs preis**. Die
// Verifikation laeuft ueber den gesamten Chain (sonst waere der Check
// mathematisch falsch), aber Response-Details (Row-Mismatches mit
// entity_type/action/created_at) werden NUR fuer Rows der eigenen Org
// geliefert. Counts sind platform-global und bewusst so -- ein Counter
// "total = 8.4M" leaked keine tenant-spezifischen Infos.
//
// Platform-Admins die den gesamten Chain-Break inspizieren muessen,
// greifen direkt via psql oder dediziertem Platform-Admin-Tool zu
// (ausserhalb ARCTOS). Bewusste Entscheidung gegen eine weitere
// Rollen-Explosion.
//
// The trigger function uses now()::text to seed the final '|' segment of
// the SHA input AND to set created_at. Since PostgreSQL's now() returns
// the statement timestamp (cached within a transaction), those two
// references return the same value. We re-cast stored created_at to
// text and assume the session DateStyle matches the trigger's default.
export async function GET(_req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  type RowCheck = {
    id: string;
    org_id: string | null;
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
  };

  const result = await db.execute<RowCheck>(sql`
    WITH ordered AS (
      SELECT
        id,
        org_id,
        entity_type,
        entity_id,
        action,
        created_at,
        entry_hash AS stored_entry_hash,
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
          created_at::text,
          'sha256'
        ), 'hex') AS recomputed_entry_hash
      FROM audit_log
    )
    SELECT
      id,
      org_id,
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
  const total = rows.length;

  const rowMismatches = rows.filter((r) => !r.row_ok);
  const chainMismatches = rows.filter((r) => !r.chain_ok);

  const healthy = rowMismatches.length === 0 && chainMismatches.length === 0;

  // Cross-Tenant-Scrubbing: Row-Details werden NUR fuer die eigene Org
  // zurueckgegeben. Counts bleiben global (andernfalls ist die Chain-
  // Verifikation mathematisch falsch -- siehe Kommentar oben).
  const ownOrgFilter = (r: RowCheck) => r.org_id === ctx.orgId;
  const ownOrgRowMismatches = rowMismatches.filter(ownOrgFilter);
  const ownOrgChainMismatches = chainMismatches.filter(ownOrgFilter);

  return Response.json(
    {
      data: {
        total,
        rowVerified: total - rowMismatches.length,
        chainVerified: total - chainMismatches.length,
        // Platform-weite Counts -- kein Cross-Tenant-Leak, nur Aggregate
        rowMismatchCount: rowMismatches.length,
        chainMismatchCount: chainMismatches.length,
        // Details NUR fuer eigene Org (ctx.orgId). Wenn in anderer Org
        // ein Break auftritt, sieht dieser Tenant nur "rowMismatchCount > 0"
        // und kontaktiert den Platform-Admin fuer forensische Analyse.
        ownOrgRowMismatches: ownOrgRowMismatches.slice(0, 50).map((r) => ({
          id: r.id,
          entityType: r.entity_type,
          entityId: r.entity_id,
          action: r.action,
          createdAt: r.created_at,
          storedEntryHash: r.stored_entry_hash,
          recomputedEntryHash: r.recomputed_entry_hash,
        })),
        ownOrgChainMismatches: ownOrgChainMismatches.slice(0, 50).map((r) => ({
          id: r.id,
          entityType: r.entity_type,
          entityId: r.entity_id,
          action: r.action,
          createdAt: r.created_at,
          storedPreviousHash: r.stored_previous_hash,
          expectedPreviousHash: r.prev_row_entry_hash,
        })),
        healthy,
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
