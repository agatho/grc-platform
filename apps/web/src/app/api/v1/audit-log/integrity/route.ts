import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { getRequestId } from "@/lib/api-errors";
import { log } from "@/lib/logger";

// GET /api/v1/audit-log/integrity
//
// ADR-011 rev.3: per-tenant SHA-256 hash-chain verification with
// hash-function versioning.
//
// Hash-version dispatch:
//   v0 — known-broken row (written during a hash-function transition
//        window). Reported as a warning, NOT counted as a mismatch.
//        Repair via migration 0312 rehashes them under v2 and clears
//        the warning.
//   v1 — rev.2 trigger (migration 0284): 9 fields, no action_detail/metadata.
//   v2 — rev.3 trigger (migration 0309): 11 fields including action_detail
//        and metadata.
//
// #WAVE9-CRITICAL-01: the previous version of this handler crashed
// silently (empty 500) when the SQL itself errored — usually because
// the column-existence assumptions diverged from what was actually
// deployed. The handler is now wrapped in a try/catch that always
// emits a structured RFC-7807 problem+json response. If integrity
// COMPUTATION fails, the response says so explicitly with a 503 and
// the underlying message — operators get something actionable instead
// of "your code is buggy" with no details.
//
// Cross-tenant: this endpoint NEVER discloses data from other tenants.
// The SQL is filtered on previous_hash_scope/org_id up front.

interface RowCheck extends Record<string, unknown> {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  created_at: string;
  hash_version: number;
  stored_entry_hash: string | null;
  recomputed_entry_hash: string | null;
  stored_previous_hash: string | null;
  prev_row_entry_hash: string | null;
  row_ok: boolean;
  chain_ok: boolean;
}

interface Mismatch {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  createdAt: string;
  hashVersion: number;
  storedEntryHash: string | null;
  recomputedEntryHash: string | null;
}

interface ChainGap {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  createdAt: string;
  storedPreviousHash: string | null;
  expectedPreviousHash: string | null;
}

interface IntegrityWarning {
  kind: "broken_hash_window";
  count: number;
  remedy: string;
}

interface IntegrityReport {
  scope: string;
  total: number;
  verified: { v1: number; v2: number };
  skipped: { v0_broken: number };
  rowMismatches: Mismatch[];
  chainMismatches: ChainGap[];
  legacyRowCount: number;
  warnings: IntegrityWarning[];
  healthy: boolean;
}

async function computeIntegrity(orgId: string): Promise<IntegrityReport> {
  const scope = `org:${orgId}`;

  // Per-tenant chain verification. LAG window is scoped to this org's
  // rows in **chain_seq order** (NOT created_at). Wave-9 verification
  // surfaced a race where one PUT writes multiple audit_log rows
  // (work_item + risk + search_index) inside a single transaction —
  // now() returns the same value for all of them, so ordering by
  // created_at,id is non-deterministic and the chain looked broken
  // even though it was correctly written. chain_seq is a BIGSERIAL
  // assigned at INSERT time, strictly monotonic even within a
  // transaction. Migration 0313 backfills it for existing rows.
  //
  // The CASE on hash_version dispatches v1 (9-field) vs v2 (11-field)
  // recompute. v0 rows are recognised here so row_ok / chain_ok skip
  // them rather than reporting a mismatch.
  const result = await db.execute<RowCheck>(sql`
    WITH ordered AS (
      SELECT
        id,
        entity_type,
        entity_id,
        action,
        created_at,
        hash_version,
        chain_seq,
        entry_hash    AS stored_entry_hash,
        previous_hash AS stored_previous_hash,
        LAG(entry_hash) OVER (ORDER BY chain_seq) AS prev_row_entry_hash,
        CASE
          WHEN hash_version = 0 THEN
            -- broken-window marker; skipped in row_ok / chain_ok below
            entry_hash
          WHEN hash_version = 2 THEN
            encode(digest(
              COALESCE(previous_hash, '0')      || '|' ||
              COALESCE(org_id::text, '')        || '|' ||
              COALESCE(user_id::text, '')       || '|' ||
              entity_type                       || '|' ||
              COALESCE(entity_id::text, '')     || '|' ||
              action::text                      || '|' ||
              COALESCE(changes::text, '')       || '|' ||
              COALESCE(action_detail, '')       || '|' ||
              COALESCE(metadata::text, '')      || '|' ||
              created_at::text                  || '|' ||
              previous_hash_scope,
              'sha256'
            ), 'hex')
          ELSE
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
            ), 'hex')
        END AS recomputed_entry_hash
      FROM audit_log
      WHERE previous_hash_scope = ${scope}
    )
    SELECT
      id,
      entity_type,
      entity_id,
      action,
      created_at,
      hash_version,
      stored_entry_hash,
      recomputed_entry_hash,
      stored_previous_hash,
      prev_row_entry_hash,
      -- v0 rows are skipped (counted as warnings), neither row_ok nor
      -- chain_ok considered.
      (hash_version = 0 OR stored_entry_hash = recomputed_entry_hash) AS row_ok,
      (hash_version = 0 OR COALESCE(stored_previous_hash, '') = COALESCE(prev_row_entry_hash, '')) AS chain_ok
    FROM ordered
    ORDER BY chain_seq
  `);

  const rows: RowCheck[] = Array.isArray(result) ? (result as RowCheck[]) : [];

  const v0Rows = rows.filter((r) => r.hash_version === 0);
  const v1Rows = rows.filter((r) => r.hash_version === 1);
  const v2Rows = rows.filter((r) => r.hash_version === 2);

  const rowMismatches = rows.filter((r) => !r.row_ok);
  const chainMismatches = rows.filter((r) => !r.chain_ok);

  const v1Verified = v1Rows.filter((r) => r.row_ok && r.chain_ok).length;
  const v2Verified = v2Rows.filter((r) => r.row_ok && r.chain_ok).length;

  // healthy = no v1/v2 mismatches. v0 rows are tracked separately as
  // warnings so a chain with documented broken entries can still report
  // its non-broken portion as healthy until the rehash migration runs.
  const healthy = rowMismatches.length === 0 && chainMismatches.length === 0;

  const warnings: IntegrityWarning[] = [];
  if (v0Rows.length > 0) {
    warnings.push({
      kind: "broken_hash_window",
      count: v0Rows.length,
      remedy:
        "Run migration 0312_rehash_v0_audit_entries.sql to recompute these under hash_version=2 and clear this warning. The migration is idempotent and writes its own hash_repair audit entry.",
    });
  }

  // Separate count of pre-rev2 legacy rows (NULL scope). They are not
  // verifiable under per-tenant semantics and are reported informationally.
  const legacyResult = await db.execute<{ legacy_count: number }>(sql`
    SELECT count(*)::int AS legacy_count
    FROM audit_log
    WHERE org_id = ${orgId}
      AND previous_hash_scope IS NULL
  `);
  const legacyRow = Array.isArray(legacyResult) ? legacyResult[0] : undefined;
  const legacyRowCount = legacyRow?.legacy_count ?? 0;

  return {
    scope,
    total: rows.length,
    verified: { v1: v1Verified, v2: v2Verified },
    skipped: { v0_broken: v0Rows.length },
    rowMismatches: rowMismatches.slice(0, 50).map((r) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      createdAt: r.created_at,
      hashVersion: r.hash_version,
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
    legacyRowCount,
    warnings,
    healthy,
  };
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const requestId = getRequestId(req);

  try {
    const report = await computeIntegrity(ctx.orgId);
    return Response.json(
      { data: report, requestId },
      { status: report.healthy ? 200 : 503 },
    );
  } catch (err) {
    // The previous handler returned an empty 500 here (no try/catch,
    // no withErrorHandler wrap) — operators were left guessing whether
    // the chain was broken or the verifier itself had crashed. Always
    // return a structured response so the UI banner has something to
    // render and operators have something to grep.
    const e = err as { code?: string; message?: string; detail?: string };
    log
      .withContext({
        route: "GET /api/v1/audit-log/integrity",
        url: req.url,
        method: "GET",
        requestId,
        orgId: ctx.orgId,
      })
      .error("integrity computation crashed", {
        message: e.message,
        pgCode: e.code,
        pgDetail: e.detail,
      });

    return Response.json(
      {
        type: "https://arctos.charliehund.de/errors/integrity-check-failed",
        title: "Integrity check failed",
        status: 503,
        detail: e.message ?? "Unknown error during hash-chain verification.",
        cause: e.code ?? "unknown",
        requestId,
        instance: req.url,
      },
      {
        status: 503,
        headers: {
          "content-type": "application/problem+json; charset=utf-8",
          "x-request-id": requestId,
        },
      },
    );
  }
}
