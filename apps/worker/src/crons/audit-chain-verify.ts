// Cron Job: Audit-Chain Verification (ADR-011 rev.4)
//
// ── Why this job exists (ARCTOS-FULL-2026-08-31 / S03-12, S03-01) ─────
//
// Before it, nothing in production ever verified the audit chain. The
// only recurring check was `scripts/dr-restore-drill.sh`, and it:
//
//   * recomputed no hash at all — it compared `previous_hash` against
//     `LAG(entry_hash)` and nothing else, so content tampering was
//     invisible to it by construction;
//   * sampled the newest 1000 rows, so tampering with older entries —
//     the normal shape of a cover-up — was never looked at;
//   * tolerated up to ten chain breaks as a "known migration 0327 rehash
//     artifact", i.e. carried an explicit ten-row tampering budget, while
//     ADR-026 says in as many words that a post-rehash mismatch "is a
//     real tamper signal … not expected drift";
//   * continued on query error, so an emptied `audit_log` passed.
//
// And nothing verified the anchors at all: `audit_anchor.verified_at`
// existed as a column that no code path ever wrote.
//
// This job walks the COMPLETE chain of every tenant, recomputes every
// row, verifies every anchor against its seal, re-checks stored RFC-3161
// proofs against the roots they claim to attest to, records the result in
// `audit_chain_verification` and returns a non-healthy result the caller
// can alert on. There is no tolerance threshold and no sampling.
//
// Registration: the worker is an HTTP listener with no scheduler of its
// own (S03-10 / S10-02). Until a scheduler ships, run this at least
// daily:
//
//   POST /crons/audit-chain-verify
//
// See /work/audit/remediation/WP4.md, "Bedarf an andere Pakete".

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { verifyTimestampResponse } from "@grc/shared/lib/freetsa";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface ScopeResult {
  scope: string;
  orgId: string | null;
  rowsChecked: number;
  healthy: boolean;
  problems: string[];
}

interface AnchorGap {
  orgId: string;
  day: string;
  rows: number;
}

interface VerifyResult {
  scopesChecked: number;
  scopesUnhealthy: number;
  rowsChecked: number;
  anchorsReverified: number;
  anchorsFailingReverification: number;
  refusedWriteAttempts24h: number;
  anchorGaps: AnchorGap[];
  healthy: boolean;
  unhealthy: ScopeResult[];
}

export const processAuditChainVerify = withCronInstrumentation<
  VerifyResult,
  [string | undefined]
>(
  "audit-chain-verify",
  async (onlyScope?: string): Promise<VerifyResult> => {
    const sealKey = process.env.AUDIT_SEAL_KEY ?? "";
    const scopes = await listScopes(onlyScope);

    const unhealthy: ScopeResult[] = [];
    let rowsChecked = 0;

    for (const scope of scopes) {
      // One transaction: the seal key has to be visible to
      // audit_anchor_verify() on the same connection, and the recorded
      // run has to be written on it too.
      const report = await db.transaction(async (tx) => {
        if (sealKey) {
          await tx.execute(
            sql`SELECT set_config('app.audit_seal_key', ${sealKey}, true)`,
          );
        }
        const result = await tx.execute<{ report: Record<string, unknown> }>(
          sql`SELECT audit_chain_verify_and_record(${scope}, 'cron') AS report`,
        );
        const raw = Array.isArray(result) ? result[0]?.report : undefined;
        return (raw ?? {}) as Record<string, unknown>;
      });

      const total = Number(report.total ?? 0);
      rowsChecked += total;

      if (report.healthy !== true) {
        unhealthy.push({
          scope,
          orgId: scope.startsWith("org:") && scope !== "org:platform"
            ? scope.slice(4)
            : null,
          rowsChecked: total,
          healthy: false,
          problems: describeProblems(report),
        });
      }
    }

    // Re-verify stored RFC-3161 proofs against the roots they claim to
    // attest to. This is what finally writes `audit_anchor.verified_at`
    // — a column that existed since ADR-011 rev.3 and was never set.
    const { reverified, failing } = await reverifyTimestamps();

    const refusedResult = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM audit_log_write_attempt
      WHERE attempted_at > now() - interval '24 hours'
    `);
    const refused = Number(
      (Array.isArray(refusedResult) ? refusedResult[0]?.n : 0) ?? 0,
    );

    // S03-10 finding 3: a FreeTSA outage used to produce a permanent,
    // silent gap in the tamper evidence — nothing alarmed, nothing
    // retried. A day with audit activity and no completed anchor after
    // 48 hours is a hole in the external commitment, and it is reported
    // here even when every hash in the chain verifies.
    const gapRows = await db.execute<{
      org_id: string;
      day: string;
      rows: number;
    }>(sql`
      WITH activity AS (
        SELECT org_id, (created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS rows
        FROM audit_log
        WHERE org_id IS NOT NULL
          AND created_at < now() - interval '48 hours'
          AND created_at > now() - interval '90 days'
        GROUP BY 1, 2
      )
      SELECT a.org_id, a.day::text AS day, a.rows
      FROM activity a
      WHERE NOT EXISTS (
        SELECT 1 FROM audit_anchor an
        WHERE an.org_id = a.org_id
          AND an.anchor_date = a.day
          AND an.proof_status <> 'failed'
      )
      ORDER BY a.day DESC
      LIMIT 100
    `);
    const anchorGaps: AnchorGap[] = (
      Array.isArray(gapRows) ? gapRows : []
    ).map((r) => ({ orgId: r.org_id, day: r.day, rows: Number(r.rows) }));

    if (anchorGaps.length > 0) {
      console.warn(
        `[cron:audit-chain-verify] ${anchorGaps.length} tenant-day(s) older than 48h have audit activity but no external anchor. ` +
          "Those events are outside the tamper-evidence guarantee. Check that a scheduler actually calls POST /crons/daily-audit-anchor — " +
          "the worker ships no scheduler of its own.",
      );
    }

    const healthy = unhealthy.length === 0 && failing === 0;

    if (!healthy) {
      // Deliberately loud and unstructured-readable in addition to the
      // NDJSON the instrumentation emits: this is the line an operator
      // greps for at 03:00.
      console.error(
        "[cron:audit-chain-verify] AUDIT TRAIL INTEGRITY FAILURE — " +
          `${unhealthy.length} scope(s) unhealthy, ${failing} anchor(s) fail re-verification. ` +
          "This is a tamper signal until proven otherwise. Do NOT run a rehash: " +
          "recomputing hashes from the current content makes whatever changed it permanent.",
      );
      for (const u of unhealthy) {
        console.error(
          `[cron:audit-chain-verify]   ${u.scope}: ${u.problems.join("; ")}`,
        );
      }
    }

    if (refused > 0) {
      console.warn(
        `[cron:audit-chain-verify] ${refused} destructive operation(s) against the log tables were refused in the last 24h — see audit_log_write_attempt`,
      );
    }

    return {
      scopesChecked: scopes.length,
      scopesUnhealthy: unhealthy.length,
      rowsChecked,
      anchorsReverified: reverified,
      anchorsFailingReverification: failing,
      refusedWriteAttempts24h: refused,
      anchorGaps,
      healthy,
      unhealthy,
    };
  },
);

async function listScopes(onlyScope?: string): Promise<string[]> {
  if (onlyScope) return [onlyScope];
  const rows = await db.execute<{ scope: string }>(sql`
    SELECT DISTINCT previous_hash_scope AS scope
    FROM audit_log
    WHERE previous_hash_scope IS NOT NULL
    ORDER BY 1
  `);
  return (Array.isArray(rows) ? rows : []).map((r) => r.scope);
}

function describeProblems(report: Record<string, unknown>): string[] {
  const out: string[] = [];
  const n = (k: string) => Number(report[k] ?? 0);
  if (n("rowMismatches") > 0)
    out.push(`${n("rowMismatches")} row hash mismatch(es)`);
  if (n("chainMismatches") > 0)
    out.push(`${n("chainMismatches")} broken chain link(s)`);
  if (n("commitmentMismatches") > 0)
    out.push(
      `${n("commitmentMismatches")} content/actor field(s) altered after the fact`,
    );
  if (n("unverifiableVersion") > 0)
    out.push(
      `${n("unverifiableVersion")} row(s) with an unverifiable hash version (hash_version=0 is not a "migration pending" state, it is a row nobody can verify)`,
    );
  if (n("redactionUnproven") > 0)
    out.push(
      `${n("redactionUnproven")} redacted row(s) with no redaction event in the chain`,
    );
  if (n("unchainedRows") > 0)
    out.push(
      `${n("unchainedRows")} row(s) written outside the chain (newest ${String(report.unchainedNewest ?? "unknown")})`,
    );
  const anchorIssues = report.anchorIssues;
  if (Array.isArray(anchorIssues) && anchorIssues.length > 0) {
    const real = anchorIssues.filter(
      (a) => (a as { issue?: string }).issue !== "seal_unsigned",
    );
    if (real.length > 0) {
      out.push(
        `${real.length} anchor issue(s): ` +
          real
            .map((a) => (a as { issue?: string }).issue ?? "unknown")
            .join(", "),
      );
    }
  }
  return out.length > 0 ? out : ["unhealthy for an unenumerated reason"];
}

/**
 * S03-11: re-check stored FreeTSA proofs. Each proof must still attest to
 * the Merkle root stored next to it. The nonce is not persisted, so its
 * replay protection cannot be re-checked here — it was checked when the
 * proof arrived. Everything else is.
 */
async function reverifyTimestamps(): Promise<{
  reverified: number;
  failing: number;
}> {
  const rows = await db.execute<{
    id: string;
    merkle_root: string;
    proof: string;
  }>(sql`
    SELECT id, merkle_root, proof
    FROM audit_anchor
    WHERE provider = 'freetsa'
      AND proof_status = 'complete'
      AND proof <> ''
      AND (verified_at IS NULL OR verified_at < now() - interval '30 days')
    ORDER BY anchored_at DESC NULLS LAST
    LIMIT 500
  `);

  let reverified = 0;
  let failing = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    try {
      const proof = Buffer.from(row.proof, "base64");
      const expected = Buffer.from(row.merkle_root, "hex");
      const r = verifyTimestampResponse(proof, expected, undefined, {
        allowUnpinnedChain: true,
      });
      await db.execute(sql`
        UPDATE audit_anchor
           SET verified_at = now(),
               tsa_verified = ${r.verified},
               tsa_gen_time = COALESCE(${r.genTime ?? null}, tsa_gen_time)
         WHERE id = ${row.id}::uuid
      `);
      reverified++;
    } catch (err) {
      failing++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:audit-chain-verify] anchor ${row.id} fails re-verification: ${msg}`,
      );
      // Record it without claiming the anchor is verified. The guard
      // permits last_error and tsa_verified on a complete anchor; it does
      // not permit touching merkle_root, leaf_count or proof.
      await db
        .execute(
          sql`
        UPDATE audit_anchor
           SET tsa_verified = false,
               last_error = ${`re-verification failed: ${msg}`.slice(0, 2000)}
         WHERE id = ${row.id}::uuid
      `,
        )
        .catch(() => {
          /* the guard refused — the console line above is the record */
        });
    }
  }

  return { reverified, failing };
}
