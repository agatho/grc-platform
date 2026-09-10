import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { getRequestId } from "@/lib/api-errors";
import { log } from "@/lib/logger";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/audit-log/integrity
//
// ADR-011 rev.4: per-tenant SHA-256 hash-chain verification.
//
// ── What changed in the ARCTOS-FULL-2026-08-31 remediation ────────────
//
// S03-04 — the verification logic used to exist four times: here, in the
//   anchor gate, in the nightly cron (not at all) and in the DR drill
//   script. They drifted, and the anchor gate's copy had no branch for
//   hash_version = 3 — which was 100 % of the live rows — so it compared
//   every stored hash with itself and reported 0 broken for any input.
//   There is now exactly one implementation, `audit_chain_check()` in the
//   database, and every caller uses it.
//
// S03-02 — `hash_version = 0` used to switch verification OFF for a row:
//   both row_ok and chain_ok short-circuited to true and the row was
//   reported as a *warning* whose remedy text advised a rehash. Combined
//   with `hash_version` being on the guard's UPDATE allow-list, that made
//   arbitrary content forgery invisible while the anchored Merkle root
//   stayed bit-identical. A row this endpoint cannot verify is now a
//   mismatch, and `healthy` is false.
//
// S03-05 — rows with no chain scope used to be reported as
//   `legacyRowCount`, commented as "pre-rev2 legacy rows … reported
//   informationally", while six live code paths kept producing them. The
//   BEFORE INSERT trigger from migration 0401 makes new unchained rows
//   impossible; any that remain are historic, and `unchainedNewest` says
//   when the newest one was written so an auditor can tell the difference.
//
// S03-01 — the endpoint now also reports anchor verification. An anchor
//   whose stored Merkle root no longer matches its seal, a deleted
//   anchor, a spliced seal ledger: all surface here instead of nowhere.
//
// S03-19 — `grc_app` has no privileges on audit_log unless migration 0407
//   ran. A 42501 used to be reported as 503 "hash-chain verification
//   could not complete" — indistinguishable from a broken chain. It is
//   now reported as what it is: a deployment problem.
//
// Cross-tenant: this endpoint NEVER discloses data from other tenants.
// The SQL is filtered on previous_hash_scope/org_id up front.

interface RowCheck extends Record<string, unknown> {
  id: string;
  chain_seq: string | number;
  entity_type: string;
  entity_id: string | null;
  action: string;
  created_at: string;
  hash_version: number;
  stored_entry_hash: string | null;
  recomputed_entry_hash: string | null;
  stored_previous_hash: string | null;
  prev_row_entry_hash: string | null;
  stored_commitment: string | null;
  recomputed_commitment: string | null;
  tombstoned: boolean;
  redaction_proven: boolean;
  row_ok: boolean;
  chain_ok: boolean;
  commitment_ok: boolean | null;
  status: string;
}

interface Mismatch {
  id: string;
  chainSeq: number;
  entityType: string;
  entityId: string | null;
  action: string;
  createdAt: string;
  hashVersion: number;
  status: string;
  storedEntryHash: string | null;
  recomputedEntryHash: string | null;
}

interface ChainGap {
  id: string;
  chainSeq: number;
  entityType: string;
  entityId: string | null;
  action: string;
  createdAt: string;
  storedPreviousHash: string | null;
  expectedPreviousHash: string | null;
}

interface AnchorIssue {
  anchorDate: string;
  provider: string;
  issue: string;
  detail: string;
}

interface IntegrityWarning {
  kind:
    | "unchained_rows"
    | "redacted_legacy_rows"
    | "refused_write_attempts"
    | "anchor_unsealed";
  count: number;
  detail: string;
}

interface IntegrityReport {
  scope: string;
  total: number;
  verified: { v1: number; v2: number; v3: number; v4: number };
  /**
   * Kept for response-shape compatibility. `v0_broken` is no longer a
   * skip — it is counted in `unverifiableVersion` and makes the report
   * unhealthy.
   */
  skipped: { v0_broken: number };
  unverifiableVersion: number;
  commitmentMismatches: Mismatch[];
  rowMismatches: Mismatch[];
  chainMismatches: ChainGap[];
  redactedLegacyCount: number;
  redactionUnprovenCount: number;
  legacyRowCount: number;
  legacyRowNewest: string | null;
  anchorIssues: AnchorIssue[];
  refusedWriteAttempts24h: number;
  warnings: IntegrityWarning[];
  healthy: boolean;
}

interface VerifySummary {
  scope: string;
  total: number;
  ok: number;
  rowMismatches: number;
  chainMismatches: number;
  commitmentMismatches: number;
  unverifiableVersion: number;
  redactedLegacy: number;
  redactionUnproven: number;
  unchainedRows: number;
  unchainedNewest: string | null;
  versionDistribution: Record<string, number>;
  anchorIssues: AnchorIssue[];
  refusedWrites24h: number;
  healthy: boolean;
}

/** Postgres "insufficient_privilege". */
const PG_INSUFFICIENT_PRIVILEGE = "42501";

export async function computeIntegrity(
  orgId: string,
): Promise<IntegrityReport> {
  const scope = `org:${orgId}`;

  // One round-trip for the summary (chain + anchors + refused writes),
  // one for the row detail. Both go through the single DB-side
  // implementation, so the endpoint cannot disagree with the anchor gate
  // or the nightly job.
  const summaryResult = await db.execute<{ report: VerifySummary }>(sql`
    SELECT audit_chain_verify(${scope})
           || jsonb_build_object(
                'anchorIssues', (
                  SELECT COALESCE(jsonb_agg(jsonb_build_object(
                           'anchorDate', anchor_date,
                           'provider',   provider,
                           'issue',      issue,
                           'detail',     detail)), '[]'::jsonb)
                  FROM audit_anchor_verify(${orgId}::uuid)
                ),
                'refusedWrites24h', (
                  SELECT count(*)::int FROM audit_log_write_attempt
                  WHERE attempted_at > now() - interval '24 hours'
                )
              ) AS report
  `);
  const summaryRow = Array.isArray(summaryResult)
    ? summaryResult[0]
    : undefined;
  const s = summaryRow?.report as VerifySummary | undefined;
  if (!s) {
    throw new Error("audit_chain_verify returned no report");
  }

  const anchorIssues = Array.isArray(s.anchorIssues) ? s.anchorIssues : [];

  // Row detail only when there is something to show. On a healthy chain
  // this second query is skipped entirely.
  const hasFailures =
    s.rowMismatches +
      s.chainMismatches +
      s.commitmentMismatches +
      s.unverifiableVersion +
      s.redactionUnproven >
    0;

  let failing: RowCheck[] = [];
  if (hasFailures) {
    const detail = await db.execute<RowCheck>(sql`
      SELECT * FROM audit_chain_check(${scope})
      WHERE status NOT IN ('ok', 'redacted_legacy')
      ORDER BY chain_seq
      LIMIT 200
    `);
    failing = Array.isArray(detail) ? detail : [];
  }

  const toMismatch = (r: RowCheck): Mismatch => ({
    id: r.id,
    chainSeq: Number(r.chain_seq),
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    createdAt: r.created_at,
    hashVersion: r.hash_version,
    status: r.status,
    storedEntryHash: r.stored_entry_hash,
    recomputedEntryHash: r.recomputed_entry_hash,
  });

  const warnings: IntegrityWarning[] = [];
  if (s.unchainedRows > 0) {
    warnings.push({
      kind: "unchained_rows",
      count: s.unchainedRows,
      detail:
        `${s.unchainedRows} audit row(s) carry no chain scope and are outside every integrity check and every external anchor. ` +
        (s.unchainedNewest
          ? `The newest was written at ${s.unchainedNewest}. Since migration 0401 the database assigns the chain on INSERT, so a row newer than that migration means a write path is bypassing the table — investigate before treating this as historic residue.`
          : ""),
    });
  }
  if (s.redactedLegacy > 0) {
    warnings.push({
      kind: "redacted_legacy_rows",
      count: s.redactedLegacy,
      detail: `${s.redactedLegacy} pre-v4 row(s) were redacted under GDPR Art. 17. Their payload was a direct hash input, so the entry hash cannot be recomputed; each one is backed by a redaction event in the chain, which is what distinguishes a lawful erasure from tampering. Rows written under v4 keep verifying after redaction.`,
    });
  }
  if (s.refusedWrites24h > 0) {
    warnings.push({
      kind: "refused_write_attempts",
      count: s.refusedWrites24h,
      detail: `${s.refusedWrites24h} destructive operation(s) against the log tables were refused in the last 24 hours. See audit_log_write_attempt.`,
    });
  }
  const unsealed = anchorIssues.filter((a) => a.issue === "seal_unsigned");
  if (unsealed.length > 0) {
    warnings.push({
      kind: "anchor_unsealed",
      count: unsealed.length,
      detail:
        "Anchors were sealed without an HMAC key. Set AUDIT_SEAL_KEY so the seal ledger cannot be forged by anyone with database access.",
    });
  }

  const dist = s.versionDistribution ?? {};

  return {
    scope: s.scope,
    total: s.total,
    verified: {
      v1: Number(dist.v1 ?? 0),
      v2: Number(dist.v2 ?? 0),
      v3: Number(dist.v3 ?? 0),
      v4: Number(dist.v4 ?? 0),
    },
    skipped: { v0_broken: Number(dist.v0 ?? 0) },
    unverifiableVersion: s.unverifiableVersion,
    rowMismatches: failing
      .filter((r) => r.status === "row_mismatch")
      .slice(0, 50)
      .map(toMismatch),
    commitmentMismatches: failing
      .filter((r) => r.status === "commitment_mismatch")
      .slice(0, 50)
      .map(toMismatch),
    chainMismatches: failing
      .filter((r) => r.status === "chain_mismatch")
      .slice(0, 50)
      .map((r) => ({
        id: r.id,
        chainSeq: Number(r.chain_seq),
        entityType: r.entity_type,
        entityId: r.entity_id,
        action: r.action,
        createdAt: r.created_at,
        storedPreviousHash: r.stored_previous_hash,
        expectedPreviousHash: r.prev_row_entry_hash,
      })),
    redactedLegacyCount: s.redactedLegacy,
    redactionUnprovenCount: s.redactionUnproven,
    legacyRowCount: s.unchainedRows,
    legacyRowNewest: s.unchainedNewest ?? null,
    anchorIssues,
    refusedWriteAttempts24h: s.refusedWrites24h,
    warnings,
    // `healthy` covers the chain AND the anchors. An intact chain whose
    // anchors were overwritten is not a healthy audit trail — that
    // combination is exactly the S03-01 attack.
    healthy:
      s.healthy &&
      anchorIssues.filter((a) => a.issue !== "seal_unsigned").length === 0,
  };
}

export const GET = withErrorHandler(async function GET(req: Request) {
  // #WAVE24-B1: CISO + compliance_officer added back. Wave-23 tightened
  // this to admin+auditor and broke the CISO's quarterly hash-chain
  // health check (ISO 27001 A.12.4.2 requires the IS-responsible role
  // can verify audit-log integrity). The endpoint never mutates state
  // and the response carries no cross-tenant data.
  const ctx = await withAuth("admin", "auditor", "ciso", "compliance_officer");
  if (ctx instanceof Response) return ctx;

  const requestId = getRequestId(req);

  try {
    const report = await computeIntegrity(ctx.orgId);
    return Response.json(
      { data: report, requestId },
      { status: report.healthy ? 200 : 503 },
    );
  } catch (err) {
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

    // S03-19: a missing privilege is a deployment defect, not an
    // integrity failure. Reporting both as 503 "verification could not
    // complete" meant an operator could not tell a misconfigured runtime
    // role from a tampered audit trail.
    if (e.code === PG_INSUFFICIENT_PRIVILEGE) {
      return Response.json(
        {
          type: "https://arctos.charliehund.de/errors/audit-log-not-readable",
          title: "Audit log not readable by the runtime role",
          status: 500,
          detail:
            "The database role this application connects as has no SELECT privilege on the audit tables. This is a deployment problem, not a chain problem — the integrity of the audit trail is unknown, not broken. Apply migration 0407 (GRANT SELECT ON audit_log, audit_anchor TO grc_app) or check APP_DATABASE_URL.",
          requestId,
          instance: req.url,
        },
        {
          status: 500,
          headers: {
            "content-type": "application/problem+json; charset=utf-8",
            "x-request-id": requestId,
          },
        },
      );
    }

    return Response.json(
      {
        type: "https://arctos.charliehund.de/errors/integrity-check-failed",
        title: "Integrity check failed",
        status: 503,
        detail:
          "Hash-chain verification could not complete. The full error " +
          "has been logged server-side; include the requestId when reporting.",
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
});
