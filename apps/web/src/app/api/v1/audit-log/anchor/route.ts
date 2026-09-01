import { db, auditAnchor } from "@grc/db";
import { and, eq, asc, desc, sql } from "drizzle-orm";
import {
  merkleRootV2,
  MERKLE_VERSION_RFC6962,
} from "@grc/shared/lib/merkle-tree";
import * as freetsa from "@grc/shared/lib/freetsa";
import * as opentimestamps from "@grc/shared/lib/opentimestamps";
import { withAuth } from "@/lib/api";

// POST /api/v1/audit-log/anchor
//
// Manually trigger an external tamper-evidence anchor for the caller's
// tenant. Same logic the nightly cron runs, exposed as an API endpoint so
// (a) admins can anchor on demand before a regulatory audit and (b) tests
// and Alpha demos don't have to wait 24h.
//
// ── Changes from the ARCTOS-FULL-2026-08-31 remediation ───────────────
//
// S03-04 — the gate below used to be a second, hand-copied
//   implementation of the integrity check with branches for
//   hash_version 1 and 2 and an `ELSE entry_hash` fallback. Live rows are
//   v3/v4, so every row fell into the ELSE and was compared with itself:
//   the gate reported 0 broken for a chain its own /integrity endpoint
//   reported as broken, and FreeTSA signed it. It now calls
//   `audit_chain_check()`, the one implementation in the database.
//
// S03-01 — every anchor is sealed into `audit_anchor_seal` in the same
//   transaction. Overwriting the anchor row afterwards no longer erases
//   the evidence: `audit_anchor_verify()` compares the row against the
//   chained, HMAC-signed seal.
//
// S03-11 — `freetsa.requestTimestamp` now validates the response
//   (messageImprint, nonce, CMS signature, certificate) and throws
//   otherwise. An anchor is only written for a proof that verified.
//
// S03-17 — new roots use the RFC-6962 construction (domain separation,
//   leaf count bound into the root). `merkle_version` records which
//   construction produced a given root so historic anchors stay
//   verifiable.
//
// Leaf order is `chain_seq`, matching the trigger, the verifier and the
// archive export. It used to be `(created_at, id)`, which is ambiguous
// for rows written inside one transaction (S03-07).

interface AnchorResponse {
  orgId: string;
  date: string;
  leafCount: number;
  merkleRoot: string | null;
  merkleVersion: number;
  results: Array<{
    provider: "freetsa" | "opentimestamps";
    status: "created" | "existing" | "skipped" | "failed";
    proofStatus?: string;
    verified?: boolean;
    chainVerified?: boolean;
    sealId?: string | null;
    error?: string;
  }>;
}

/**
 * Leaves for one tenant-day, in chain order. Exported so the nightly cron
 * and the archive export build the identical tree — three separate
 * `ORDER BY` clauses were how the offline verifier ended up reporting 23
 * phantom chain breaks out of 142 rows.
 */
export async function collectLeaves(
  orgId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<string[]> {
  const rows = await db.execute<{ entry_hash: string }>(sql`
    SELECT entry_hash
    FROM audit_log
    WHERE org_id = ${orgId}
      AND created_at >= ${dayStart.toISOString()}::timestamptz
      AND created_at <  ${dayEnd.toISOString()}::timestamptz
      AND entry_hash IS NOT NULL
    ORDER BY chain_seq
  `);
  return (Array.isArray(rows) ? rows : []).map((r) => r.entry_hash);
}

/**
 * The anchor gate. Returns null when the chain may be anchored, or a
 * ready-made 409 response when it may not.
 */
export async function anchorGate(orgId: string): Promise<Response | null> {
  const scope = `org:${orgId}`;
  const result = await db.execute<{ report: Record<string, unknown> }>(sql`
    SELECT audit_chain_verify(${scope}) AS report
  `);
  const report = (Array.isArray(result) ? result[0]?.report : undefined) as
    | Record<string, number | boolean | string>
    | undefined;

  if (!report) {
    return Response.json(
      {
        type: "https://arctos.charliehund.de/errors/chain-not-verifiable",
        title: "Audit chain could not be verified — refusing to anchor",
        status: 409,
        detail:
          "audit_chain_verify() returned no report. Anchoring an unverified chain is the failure mode #WAVE10-CRITICAL-01 exists to prevent.",
      },
      { status: 409 },
    );
  }

  if (report.healthy === true) return null;

  return Response.json(
    {
      type: "https://arctos.charliehund.de/errors/chain-not-anchorable",
      title: "Audit chain integrity broken — refusing to anchor",
      status: 409,
      detail:
        `Found ${report.rowMismatches ?? 0} row mismatch(es), ` +
        `${report.chainMismatches ?? 0} chain mismatch(es), ` +
        `${report.commitmentMismatches ?? 0} content-commitment mismatch(es), ` +
        `${report.unverifiableVersion ?? 0} row(s) whose hash version cannot be verified and ` +
        `${report.unchainedRows ?? 0} row(s) written outside the chain. ` +
        "Anchoring now would propagate the broken state into the timestamp authority and make the corruption permanent. " +
        "GET /api/v1/audit-log/integrity for the full diff. Do NOT 'repair' by rehashing: a rehash recomputes the hashes from whatever the rows currently say and therefore blesses whatever changed them.",
      report,
      integrityCheck: "/api/v1/audit-log/integrity",
    },
    { status: 409 },
  );
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => ({}));
  const dateStr: string = body.date ?? new Date().toISOString().slice(0, 10);
  const providers: Array<"freetsa" | "opentimestamps"> =
    Array.isArray(body.providers) && body.providers.length > 0
      ? body.providers
      : ["freetsa", "opentimestamps"];

  const dayStart = new Date(dateStr + "T00:00:00Z");
  if (isNaN(dayStart.getTime())) {
    return Response.json({ error: "Invalid date" }, { status: 422 });
  }
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // #WAVE10-CRITICAL-01, repaired: refuse to anchor a chain that fails
  // its own verification.
  const refusal = await anchorGate(ctx.orgId);
  if (refusal) return refusal;

  const leaves = await collectLeaves(ctx.orgId, dayStart, dayEnd);
  const root = merkleRootV2(leaves);

  const response: AnchorResponse = {
    orgId: ctx.orgId,
    date: dateStr,
    leafCount: leaves.length,
    merkleRoot: root,
    merkleVersion: MERKLE_VERSION_RFC6962,
    results: [],
  };

  if (!root) {
    return Response.json({
      ...response,
      results: providers.map((p) => ({
        provider: p,
        status: "skipped" as const,
      })),
      message: "No audit entries on this day — nothing to anchor.",
    });
  }

  const rootBuffer = Buffer.from(root, "hex");

  for (const provider of providers) {
    try {
      const existing = await db
        .select({ proofStatus: auditAnchor.proofStatus })
        .from(auditAnchor)
        .where(
          and(
            eq(auditAnchor.orgId, ctx.orgId),
            eq(auditAnchor.anchorDate, dateStr),
            eq(auditAnchor.provider, provider),
          ),
        )
        .limit(1);

      if (existing.length > 0 && existing[0].proofStatus !== "failed") {
        response.results.push({
          provider,
          status: "existing",
          proofStatus: existing[0].proofStatus,
        });
        continue;
      }

      if (provider === "freetsa") {
        // Throws unless the response attests to exactly this root under a
        // signature that verifies (S03-11).
        const tsa = await freetsa.requestTimestamp(rootBuffer, {
          allowUnpinnedChain: true,
        });
        const sealId = await upsertAnchor({
          orgId: ctx.orgId,
          date: dateStr,
          provider,
          root,
          leafCount: leaves.length,
          proof: tsa.proof.toString("base64"),
          proofStatus: "complete",
          tsaVerified: tsa.verified,
          tsaGenTime: tsa.genTime ?? null,
        });
        response.results.push({
          provider,
          status: "created",
          proofStatus: "complete",
          verified: tsa.verified,
          chainVerified: tsa.chainVerified,
          sealId,
        });
      } else {
        const ots = await opentimestamps.submitToAnyCalendar(rootBuffer);
        const sealId = await upsertAnchor({
          orgId: ctx.orgId,
          date: dateStr,
          provider,
          root,
          leafCount: leaves.length,
          proof: ots.stub.toString("base64"),
          proofStatus: "pending",
        });
        response.results.push({
          provider,
          status: "created",
          proofStatus: "pending",
          sealId,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      response.results.push({ provider, status: "failed", error: msg });
      // Record the failure so an operator can retry. A failed row is not
      // evidence and is not sealed; the DB guard allows it to be replaced
      // by a real anchor later.
      await upsertAnchor({
        orgId: ctx.orgId,
        date: dateStr,
        provider,
        root,
        leafCount: leaves.length,
        proof: "",
        proofStatus: "failed",
        lastError: msg,
      }).catch(() => {
        /* ignore nested failure */
      });
    }
  }

  return Response.json(response);
}

// GET /api/v1/audit-log/anchor — status of recent anchors for this tenant
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 30));

  const rows = await db
    .select({
      id: auditAnchor.id,
      anchorDate: auditAnchor.anchorDate,
      provider: auditAnchor.provider,
      merkleRoot: auditAnchor.merkleRoot,
      merkleVersion: auditAnchor.merkleVersion,
      leafCount: auditAnchor.leafCount,
      proofStatus: auditAnchor.proofStatus,
      tsaVerified: auditAnchor.tsaVerified,
      tsaGenTime: auditAnchor.tsaGenTime,
      verifiedAt: auditAnchor.verifiedAt,
      bitcoinBlockHeight: auditAnchor.bitcoinBlockHeight,
      lastError: auditAnchor.lastError,
      createdAt: auditAnchor.createdAt,
      upgradedAt: auditAnchor.upgradedAt,
    })
    .from(auditAnchor)
    .where(eq(auditAnchor.orgId, ctx.orgId))
    .orderBy(desc(auditAnchor.anchorDate), asc(auditAnchor.provider))
    .limit(limit);

  // S03-01: the seal check that never existed. An anchor that reads fine
  // here but fails this is one that was overwritten after the fact.
  const sealResult = await db.execute<{
    anchor_date: string;
    provider: string;
    issue: string;
    detail: string;
  }>(sql`SELECT anchor_date, provider, issue, detail FROM audit_anchor_verify(${ctx.orgId}::uuid)`);
  const sealIssues = Array.isArray(sealResult) ? sealResult : [];

  const latestByProvider: Record<string, (typeof rows)[number] | undefined> =
    {};
  for (const r of rows) {
    if (!latestByProvider[r.provider]) latestByProvider[r.provider] = r;
  }

  return Response.json({
    data: rows,
    latest: {
      freetsa: latestByProvider.freetsa ?? null,
      opentimestamps: latestByProvider.opentimestamps ?? null,
    },
    sealVerification: {
      issues: sealIssues,
      healthy: sealIssues.filter((i) => i.issue !== "seal_unsigned").length === 0,
    },
  });
}

/**
 * Insert (or replace a previously failed) anchor and seal it in the same
 * transaction. Returns the seal id, or null for a failed attempt, which
 * is not evidence and therefore not sealed.
 */
export async function upsertAnchor(row: {
  orgId: string;
  date: string;
  provider: "freetsa" | "opentimestamps";
  root: string;
  leafCount: number;
  proof: string;
  proofStatus: "complete" | "pending" | "failed";
  lastError?: string;
  tsaVerified?: boolean;
  tsaGenTime?: Date | null;
}): Promise<string | null> {
  const sealKey = process.env.AUDIT_SEAL_KEY ?? "";
  const sealKeyId = process.env.AUDIT_SEAL_KEY_ID ?? "default";

  return db.transaction(async (tx) => {
    // The seal functions read the key from a session GUC — it is never
    // stored in the database, which is the whole point of the HMAC.
    if (sealKey) {
      await tx.execute(sql`SELECT set_config('app.audit_seal_key', ${sealKey}, true)`);
      await tx.execute(
        sql`SELECT set_config('app.audit_seal_key_id', ${sealKeyId}, true)`,
      );
    }

    const inserted = await tx.execute<{ id: string }>(sql`
      INSERT INTO audit_anchor (
        org_id, anchor_date, provider, merkle_root, merkle_version,
        leaf_count, proof, proof_status, last_error,
        anchored_at, hash_version, tsa_verified, tsa_gen_time
      ) VALUES (
        ${row.orgId}, ${row.date}, ${row.provider}, ${row.root},
        ${MERKLE_VERSION_RFC6962}, ${row.leafCount}, ${row.proof},
        ${row.proofStatus}, ${row.lastError ?? null},
        now(), 4, ${row.tsaVerified ?? false}, ${row.tsaGenTime ?? null}
      )
      ON CONFLICT (org_id, anchor_date, provider) DO UPDATE SET
        merkle_root    = EXCLUDED.merkle_root,
        merkle_version = EXCLUDED.merkle_version,
        leaf_count     = EXCLUDED.leaf_count,
        proof          = EXCLUDED.proof,
        proof_status   = EXCLUDED.proof_status,
        last_error     = EXCLUDED.last_error,
        anchored_at    = EXCLUDED.anchored_at,
        hash_version   = EXCLUDED.hash_version,
        tsa_verified   = EXCLUDED.tsa_verified,
        tsa_gen_time   = EXCLUDED.tsa_gen_time
      RETURNING id
    `);
    const id = Array.isArray(inserted) ? inserted[0]?.id : undefined;
    if (!id || row.proofStatus === "failed") return null;

    const sealed = await tx.execute<{ seal: string | null }>(
      sql`SELECT audit_anchor_seal_record(${id}::uuid) AS seal`,
    );
    return (Array.isArray(sealed) ? sealed[0]?.seal : null) ?? null;
  });
}
