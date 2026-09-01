// GET /api/v1/audit-log/integrity/continuity — Wave-24-C1
//
// #WAVE24-C1: Hash-chain v3 continuity proof endpoint. See
// docs/ADR-026-hash-chain-v3-migration.md for the underlying
// reasoning.
//
// What this endpoint answers, in one phrase: "Is the audit-log
// hash chain still provably continuous after the v3 migration?"
//
// Auditor-grade endpoint. Read-only, no mutations. Open to the
// same role set as `/audit-log/integrity` (admin, auditor, ciso,
// compliance_officer) — they're the roles ISO 27001 A.12.4.2 calls
// out as responsible for the integrity-of-audit-log control.

import { db, auditLog } from "@grc/db";
import { sql, eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { getRequestId } from "@/lib/api-errors";

type ContinuityClaim = "monolithic_v3" | "v3_with_legacy" | "unmigrated";

interface MigrationAnchor {
  migration: string;
  name: string;
  appliedAt: string;
  rowsRehashed: number;
  purpose: string;
}

interface ContinuityReport {
  currentVersion: number;
  versionDistribution: {
    v0_broken: number;
    v1: number;
    v2: number;
    v3: number;
    v4: number;
  };
  /**
   * S03-08: `totalContinuityValid` used to be derived from the version
   * histogram alone. A chain that had been completely rewritten was still
   * "monolithic_v3 / valid: true" — and scripts/pilot-readiness-gate.sh
   * gates the production start on exactly that value. The claim is now
   * additionally bound to the cryptographic verification.
   */
  chainVerification: {
    healthy: boolean;
    rowMismatches: number;
    chainMismatches: number;
    commitmentMismatches: number;
    unverifiableVersion: number;
    unchainedRows: number;
    anchorIssues: number;
  };
  migrationAnchors: MigrationAnchor[];
  freeTsaAnchors: {
    lastV2Anchor: string | null;
    firstV3Anchor: string | null;
  };
  continuityClaim: ContinuityClaim;
  totalContinuityValid: boolean;
  notes: string[];
}

async function gatherVersionDistribution(
  orgId: string,
): Promise<ContinuityReport["versionDistribution"]> {
  // Scope to the tenant chain. The `previous_hash_scope` column lets
  // us partition the global table by tenant — same partition the
  // existing /audit-log/integrity endpoint uses.
  const scope = `org:${orgId}`;
  const result = await db.execute<{
    hash_version: number;
    count: number;
  }>(sql`
    SELECT hash_version, COUNT(*)::int AS count
    FROM audit_log
    WHERE previous_hash_scope = ${scope}
    GROUP BY hash_version
  `);

  const rows = Array.isArray(result) ? result : [];
  const dist = { v0_broken: 0, v1: 0, v2: 0, v3: 0, v4: 0 };
  for (const r of rows) {
    if (r.hash_version === 0) dist.v0_broken = Number(r.count);
    else if (r.hash_version === 1) dist.v1 = Number(r.count);
    else if (r.hash_version === 2) dist.v2 = Number(r.count);
    else if (r.hash_version === 3) dist.v3 = Number(r.count);
    else if (r.hash_version === 4) dist.v4 = Number(r.count);
  }
  return dist;
}

async function gatherMigrationAnchors(
  orgId: string,
): Promise<MigrationAnchor[]> {
  // S03-08: ADR-026 described these rows as written by "the migration
  // audit trigger added in 0341". Migration 0341 contains no trigger, the
  // `audit_action` enum had no `migration_run` value, so the cast in this
  // query threw, the bare catch swallowed it and this function returned
  // `[]` on every call since Wave 24 — while the value it feeds gates the
  // production start.
  //
  // The enum value and the writer now exist (migration 0407,
  // `record_migration_anchor()`). `entity_id` is a uuid column and cannot
  // hold "0328", so the migration number lives in `entity_title` /
  // `action_detail`; the ADR has been corrected accordingly.
  type AnchorRow = {
    id: string;
    migration: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  };
  const rows = await db.execute<AnchorRow>(sql`
    SELECT id, action_detail AS migration, created_at, metadata
    FROM audit_log
    WHERE previous_hash_scope = ${`org:${orgId}`}
      AND entity_type = 'database'
      AND action::text = 'migration_run'
    UNION ALL
    SELECT id, action_detail AS migration, created_at, metadata
    FROM audit_log
    WHERE previous_hash_scope = 'org:platform'
      AND entity_type = 'database'
      AND action::text = 'migration_run'
    ORDER BY created_at ASC
  `);
  const anchors = Array.isArray(rows) ? rows : [];
  return anchors.map((row) => ({
    migration: row.migration ?? "unknown",
    name:
      typeof row.metadata?.name === "string"
        ? row.metadata.name
        : "audit_chain_rehash",
    appliedAt: String(row.created_at),
    rowsRehashed:
      typeof row.metadata?.rowsRehashed === "number"
        ? row.metadata.rowsRehashed
        : 0,
    purpose:
      typeof row.metadata?.purpose === "string"
        ? row.metadata.purpose
        : "hash-formula migration",
  }));
}

interface ChainVerification {
  healthy: boolean;
  rowMismatches: number;
  chainMismatches: number;
  commitmentMismatches: number;
  unverifiableVersion: number;
  unchainedRows: number;
  anchorIssues: number;
}

async function gatherChainVerification(
  orgId: string,
): Promise<ChainVerification> {
  const result = await db.execute<{ report: Record<string, number | boolean> }>(sql`
    SELECT audit_chain_verify(${`org:${orgId}`})
           || jsonb_build_object(
                'anchorIssueCount',
                (SELECT count(*)::int FROM audit_anchor_verify(${orgId}::uuid)
                  WHERE issue <> 'seal_unsigned')
              ) AS report
  `);
  const r = (Array.isArray(result) ? result[0]?.report : undefined) ?? {};
  return {
    healthy: r.healthy === true && Number(r.anchorIssueCount ?? 0) === 0,
    rowMismatches: Number(r.rowMismatches ?? 0),
    chainMismatches: Number(r.chainMismatches ?? 0),
    commitmentMismatches: Number(r.commitmentMismatches ?? 0),
    unverifiableVersion: Number(r.unverifiableVersion ?? 0),
    unchainedRows: Number(r.unchainedRows ?? 0),
    anchorIssues: Number(r.anchorIssueCount ?? 0),
  };
}

function deriveContinuityClaim(
  dist: ContinuityReport["versionDistribution"],
  anchors: MigrationAnchor[],
  verification: ChainVerification,
): { claim: ContinuityClaim; valid: boolean; notes: string[] } {
  const notes: string[] = [];

  // S03-08: the decisive change. `valid` used to be derived from the
  // version histogram alone, so a chain that had been recomputed end to
  // end — every row v3, every pointer consistent, content rewritten —
  // reported "monolithic_v3 / valid: true". The claim is a claim about
  // continuity, and continuity that is not cryptographically verified is
  // not continuity. No histogram shape can now produce `valid: true`
  // while the verification fails.
  if (!verification.healthy) {
    notes.push(
      `Cryptographic verification failed: ${verification.rowMismatches} row, ` +
        `${verification.chainMismatches} chain, ${verification.commitmentMismatches} commitment mismatch(es), ` +
        `${verification.unverifiableVersion} unverifiable row(s), ${verification.unchainedRows} unchained row(s), ` +
        `${verification.anchorIssues} anchor issue(s). See GET /api/v1/audit-log/integrity.`,
    );
  }

  if (dist.v0_broken > 0) {
    notes.push(
      `${dist.v0_broken} row(s) carry hash_version 0. There is no formula for v0, so those rows cannot be verified at all. ` +
        "Do NOT rehash them: a rehash recomputes the hash from whatever the row now says, which is how a forged row becomes permanent. " +
        "Treat this as a tamper signal and investigate against an offline archive export.",
    );
  }

  // Formula versions that render `created_at` in the SESSION timezone
  // (v1, v2). ADR-026 exists because a row hashed on one host failed
  // verification on another. Their presence without a documented
  // migration event is a real continuity gap, not a cosmetic one.
  const tzDependent = dist.v1 + dist.v2;
  const present = [dist.v1, dist.v2, dist.v3, dist.v4].filter(
    (n) => n > 0,
  ).length;
  const hasMigrationAnchor = anchors.some(
    (a) => a.migration === "0400" || a.migration === "0328",
  );
  const noRows = dist.v1 + dist.v2 + dist.v3 + dist.v4 + dist.v0_broken === 0;

  if (noRows) {
    return {
      claim: "monolithic_v3",
      valid: verification.healthy,
      notes: notes.concat("Empty chain — no audit events recorded yet."),
    };
  }

  if (dist.v0_broken > 0 || !verification.healthy) {
    return { claim: "unmigrated", valid: false, notes };
  }

  if (present === 1) {
    return {
      claim: "monolithic_v3",
      valid: true,
      notes: notes.concat(
        "Every row is under a single formula version and every row verifies.",
      ),
    };
  }

  if (tzDependent > 0 && !hasMigrationAnchor) {
    notes.push(
      `${tzDependent} row(s) still use a timezone-dependent formula (v1/v2) and no migration anchor documents the change. ` +
        "The continuity claim cannot be made automatically. Do not resolve this with a blanket rehash — a rehash recomputes hashes from the current content and invalidates every Merkle root already timestamped.",
    );
    return { claim: "unmigrated", valid: false, notes };
  }

  return {
    claim: "v3_with_legacy",
    valid: true,
    notes: notes.concat(
      "Rows written under more than one formula version coexist and each verifies under the formula it was written with. " +
        "History was deliberately NOT rehashed: a rehash would have invalidated every Merkle root already timestamped and would have blessed any tampering that preceded it. " +
        (hasMigrationAnchor
          ? "The formula change is recorded as a migration anchor inside the chain itself, so the cross-link is hashed and anchorable."
          : "No migration anchor was found in this scope, so the claim rests on verification alone."),
    ),
  };
}


export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor", "ciso", "compliance_officer");
  if (ctx instanceof Response) return ctx;

  const requestId = getRequestId(req);

  const [versionDistribution, migrationAnchors, chainVerification] =
    await Promise.all([
      gatherVersionDistribution(ctx.orgId),
      gatherMigrationAnchors(ctx.orgId),
      gatherChainVerification(ctx.orgId),
    ]);

  const derivation = deriveContinuityClaim(
    versionDistribution,
    migrationAnchors,
    chainVerification,
  );

  // S03-08: these two fields were documented in ADR-026 as delivered and
  // were structurally always null — the query referenced `anchored_at`
  // and `hash_version`, neither of which existed on audit_anchor, and the
  // resulting error was swallowed by a bare catch. Migration 0403 adds
  // both columns; the query below is the same one, now against a table
  // that has them.
  let lastV2Anchor: string | null = null;
  let firstV3Anchor: string | null = null;
  type AnchorReceiptRow = { anchored_at: string; hash_version: number };
  const anchorRows = await db.execute<AnchorReceiptRow>(sql`
    SELECT anchored_at, hash_version
    FROM audit_anchor
    WHERE org_id = ${ctx.orgId}
      AND proof_status <> 'failed'
    ORDER BY anchored_at DESC
    LIMIT 50
  `);
  const arr = Array.isArray(anchorRows) ? anchorRows : [];
  const post = arr.filter((a) => Number(a.hash_version) >= 4).reverse();
  const pre = arr.filter((a) => Number(a.hash_version) < 4);
  if (post.length > 0) firstV3Anchor = String(post[0].anchored_at);
  if (pre.length > 0) lastV2Anchor = String(pre[0].anchored_at);

  const report: ContinuityReport = {
    currentVersion: 4,
    versionDistribution,
    chainVerification,
    migrationAnchors,
    freeTsaAnchors: { lastV2Anchor, firstV3Anchor },
    continuityClaim: derivation.claim,
    totalContinuityValid: derivation.valid,
    notes: derivation.notes,
  };

  return Response.json(
    { data: report, requestId },
    { status: report.totalContinuityValid ? 200 : 503 },
  );
});

// Mark auditLog as used for tree-shaking. The endpoint queries via
// raw SQL because it needs version-distribution counts and metadata
// JSONB inspection that Drizzle's typed query API doesn't ergonomically
// support. The import remains so the bundler keeps audit-log helpers
// in scope and IDE go-to-definition still works from this module.
void auditLog;
void and;
void eq;
void desc;
