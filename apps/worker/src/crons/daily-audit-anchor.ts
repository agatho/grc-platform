// Cron Job: Daily Audit-Chain Anchor (ADR-011 rev.4)
//
// Builds a Merkle tree over each tenant's audit_log entries of the
// previous UTC day, sends the root to FreeTSA (RFC 3161) and to the
// OpenTimestamps calendar pool, stores both proofs in `audit_anchor` and
// seals each one into the HMAC-chained `audit_anchor_seal` ledger.
//
// ── Changes from the ARCTOS-FULL-2026-08-31 remediation ───────────────
//
// S03-04 — this job had NO integrity gate at all. The manual API route
//   had one (broken); the path that runs 365 days a year had none, so a
//   corrupted chain was timestamped automatically and the corruption
//   became permanent. The gate is now the first thing that happens per
//   tenant, and it is the same `audit_chain_verify()` the endpoint uses.
//
// S03-10 — a failed attempt wrote a row with proof_status='failed', and
//   the next run's `existing.length === 0` check then saw that row and
//   skipped the day for ever. One FreeTSA outage produced a permanent,
//   silent gap in the tamper evidence. The API route already had the
//   correct condition (`proofStatus !== 'failed'`); it is now here too,
//   and unanchored days from the recent past are retried, not only
//   yesterday.
//
// S03-10 (4) — `POST /crons/daily-audit-anchor {"date":"2026-04-15"}`
//   anchored the 14th: index.ts built a Date from the string and this
//   job then subtracted a day from it. `targetDate` is now the day to
//   anchor, not the day to count back from, and the HTTP handler passes
//   it unchanged. Callers that relied on the old off-by-one see a
//   one-day shift — the runbook change is noted in the ADR.
//
// S03-11 — `freetsa.requestTimestamp` validates the response and throws
//   if it does not attest to our root. A proof that does not verify is a
//   failure, not an anchor.
//
// S03-17 — new roots use the RFC-6962 construction.
//
// The job is idempotent per (org_id, day, provider).

import { db, auditAnchor } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";
import {
  merkleRootV2,
  MERKLE_VERSION_RFC6962,
} from "@grc/shared/lib/merkle-tree";
import * as freetsa from "@grc/shared/lib/freetsa";
import * as opentimestamps from "@grc/shared/lib/opentimestamps";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface AnchorResult {
  orgsProcessed: number;
  anchorsCreated: number;
  daysRetried: number;
  chainsRefused: number;
  errors: string[];
}

/** How far back the job retries days that were never anchored. */
const RETRY_WINDOW_DAYS = Number(process.env.AUDIT_ANCHOR_RETRY_DAYS ?? 14);

export const processDailyAuditAnchor = withCronInstrumentation<
  AnchorResult,
  [Date | undefined]
>("daily-audit-anchor", async (targetDate?: Date): Promise<AnchorResult> => {
  const errors: string[] = [];
  let anchorsCreated = 0;
  let daysRetried = 0;
  let chainsRefused = 0;

  // `targetDate` IS the day to anchor. Default: yesterday in UTC.
  const base = targetDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dayIso = base.toISOString().slice(0, 10);

  console.log(`[cron:daily-audit-anchor] target day ${dayIso}`);

  // Every (tenant, day) that has audit activity and no complete/pending
  // anchor yet — the target day plus any day inside the retry window that
  // was missed or failed. This is what closes the permanent-gap defect:
  // a day is not "done" because a row exists for it, only because a
  // non-failed anchor exists for it.
  const pending = await db.execute<{ org_id: string; day: string }>(sql`
    WITH activity AS (
      SELECT org_id, (created_at AT TIME ZONE 'UTC')::date AS day
      FROM audit_log
      WHERE org_id IS NOT NULL
        AND previous_hash_scope LIKE 'org:%'
        AND created_at >= (${dayIso}::date - ${RETRY_WINDOW_DAYS}::int)
        AND created_at <  (${dayIso}::date + 1)
      GROUP BY 1, 2
    )
    SELECT a.org_id, a.day::text AS day
    FROM activity a
    WHERE EXISTS (
      SELECT 1 FROM unnest(ARRAY['freetsa','opentimestamps']) p(provider)
      WHERE NOT EXISTS (
        SELECT 1 FROM audit_anchor an
        WHERE an.org_id = a.org_id
          AND an.anchor_date = a.day
          AND an.provider = p.provider
          AND an.proof_status <> 'failed'
      )
    )
    ORDER BY a.day, a.org_id
  `);

  const rows: { org_id: string; day: string }[] = Array.isArray(pending)
    ? (pending as { org_id: string; day: string }[])
    : [];

  const orgs = new Set(rows.map((r) => r.org_id));
  console.log(
    `[cron:daily-audit-anchor] ${rows.length} (tenant, day) pair(s) across ${orgs.size} tenant(s) need anchoring`,
  );

  // Verify each tenant's chain once, not once per day.
  const gateByOrg = new Map<string, boolean>();

  for (const { org_id: orgId, day } of rows) {
    try {
      if (!gateByOrg.has(orgId)) {
        gateByOrg.set(orgId, await chainIsAnchorable(orgId));
      }
      if (!gateByOrg.get(orgId)) {
        chainsRefused++;
        const msg =
          `org ${orgId}: chain fails self-verification — refusing to anchor. ` +
          "Anchoring a broken chain writes the corruption into an external timestamp and makes it permanent (#WAVE10-CRITICAL-01). " +
          "GET /api/v1/audit-log/integrity.";
        if (!errors.includes(msg)) errors.push(msg);
        continue;
      }

      if (day !== dayIso) daysRetried++;
      anchorsCreated += await anchorOneTenantDay(orgId, day);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`org ${orgId} day ${day}: ${msg}`);
      console.error(
        `[cron:daily-audit-anchor] org ${orgId} day ${day} failed:`,
        msg,
      );
    }
  }

  console.log(
    `[cron:daily-audit-anchor] done — orgs=${orgs.size} anchors=${anchorsCreated} retried=${daysRetried} refused=${chainsRefused} errors=${errors.length}`,
  );
  return {
    orgsProcessed: orgs.size,
    anchorsCreated,
    daysRetried,
    chainsRefused,
    errors,
  };
});

/**
 * The gate the nightly path never had. Uses the same single
 * implementation as `/api/v1/audit-log/integrity` and the manual anchor
 * route, so the three cannot drift apart (S03-04).
 */
async function chainIsAnchorable(orgId: string): Promise<boolean> {
  const result = await db.execute<{ report: Record<string, unknown> }>(sql`
    SELECT audit_chain_verify(${`org:${orgId}`}) AS report
  `);
  const report = Array.isArray(result) ? result[0]?.report : undefined;
  return (report as { healthy?: boolean } | undefined)?.healthy === true;
}

async function anchorOneTenantDay(
  orgId: string,
  dayIso: string,
): Promise<number> {
  const dayStart = new Date(dayIso + "T00:00:00Z");
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Leaf order is chain_seq — the same order the trigger, the verifier
  // and the archive export use (S03-07).
  const leafRows = await db.execute<{ entry_hash: string }>(sql`
    SELECT entry_hash
    FROM audit_log
    WHERE org_id = ${orgId}
      AND created_at >= ${dayStart.toISOString()}::timestamptz
      AND created_at <  ${dayEnd.toISOString()}::timestamptz
      AND entry_hash IS NOT NULL
    ORDER BY chain_seq
  `);
  const leaves = (Array.isArray(leafRows) ? leafRows : []).map(
    (r) => r.entry_hash,
  );
  if (leaves.length === 0) return 0;

  const root = merkleRootV2(leaves);
  if (!root) {
    throw new Error(
      "Merkle root computation returned null for non-empty leaves",
    );
  }
  const rootBuffer = Buffer.from(root, "hex");

  let created = 0;

  for (const provider of ["freetsa", "opentimestamps"] as const) {
    try {
      // A FAILED row is not an anchor and must not block a retry. This
      // one condition is the whole of S03-10 finding 2.
      const existing = await db
        .select({ proofStatus: auditAnchor.proofStatus })
        .from(auditAnchor)
        .where(
          and(
            eq(auditAnchor.orgId, orgId),
            eq(auditAnchor.anchorDate, dayIso),
            eq(auditAnchor.provider, provider),
          ),
        )
        .limit(1);
      if (existing.length > 0 && existing[0].proofStatus !== "failed") {
        continue;
      }

      if (provider === "freetsa") {
        const tsa = await freetsa.requestTimestamp(rootBuffer, {
          allowUnpinnedChain: true,
        });
        await writeAnchor({
          orgId,
          dayIso,
          provider,
          root,
          leafCount: leaves.length,
          proof: tsa.proof.toString("base64"),
          proofStatus: "complete",
          tsaVerified: tsa.verified,
          tsaGenTime: tsa.genTime ?? null,
        });
      } else {
        const ots = await opentimestamps.submitToAnyCalendar(rootBuffer);
        await writeAnchor({
          orgId,
          dayIso,
          provider,
          root,
          leafCount: leaves.length,
          proof: ots.stub.toString("base64"),
          proofStatus: "pending",
        });
      }
      created++;
    } catch (err) {
      await logAnchorFailure(orgId, dayIso, provider, root, leaves.length, err);
    }
  }

  return created;
}

async function writeAnchor(row: {
  orgId: string;
  dayIso: string;
  provider: "freetsa" | "opentimestamps";
  root: string;
  leafCount: number;
  proof: string;
  proofStatus: "complete" | "pending";
  tsaVerified?: boolean;
  tsaGenTime?: Date | null;
}): Promise<void> {
  const sealKey = process.env.AUDIT_SEAL_KEY ?? "";
  const sealKeyId = process.env.AUDIT_SEAL_KEY_ID ?? "default";

  await db.transaction(async (tx) => {
    if (sealKey) {
      await tx.execute(
        sql`SELECT set_config('app.audit_seal_key', ${sealKey}, true)`,
      );
      await tx.execute(
        sql`SELECT set_config('app.audit_seal_key_id', ${sealKeyId}, true)`,
      );
    } else {
      // Not fatal — an unsigned seal is still a chained record and still
      // detects an overwritten anchor from inside the database. It just
      // does not survive an actor who can write the seal ledger too.
      // /audit-log/integrity reports this as `anchor_unsealed`.
      console.warn(
        "[cron:daily-audit-anchor] AUDIT_SEAL_KEY is not set — anchors are sealed but not signed (S03-01)",
      );
    }

    const inserted = await tx.execute<{ id: string }>(sql`
      INSERT INTO audit_anchor (
        org_id, anchor_date, provider, merkle_root, merkle_version,
        leaf_count, proof, proof_status, last_error,
        anchored_at, hash_version, tsa_verified, tsa_gen_time
      ) VALUES (
        ${row.orgId}, ${row.dayIso}, ${row.provider}, ${row.root},
        ${MERKLE_VERSION_RFC6962}, ${row.leafCount}, ${row.proof},
        ${row.proofStatus}, NULL, now(), 4,
        ${row.tsaVerified ?? false}, ${row.tsaGenTime ?? null}
      )
      ON CONFLICT (org_id, anchor_date, provider) DO UPDATE SET
        merkle_root    = EXCLUDED.merkle_root,
        merkle_version = EXCLUDED.merkle_version,
        leaf_count     = EXCLUDED.leaf_count,
        proof          = EXCLUDED.proof,
        proof_status   = EXCLUDED.proof_status,
        last_error     = NULL,
        anchored_at    = EXCLUDED.anchored_at,
        hash_version   = EXCLUDED.hash_version,
        tsa_verified   = EXCLUDED.tsa_verified,
        tsa_gen_time   = EXCLUDED.tsa_gen_time
      RETURNING id
    `);
    const id = Array.isArray(inserted) ? inserted[0]?.id : undefined;
    if (id) {
      await tx.execute(sql`SELECT audit_anchor_seal_record(${id}::uuid)`);
    }
  });
}

async function logAnchorFailure(
  orgId: string,
  dayIso: string,
  provider: "freetsa" | "opentimestamps",
  root: string,
  leafCount: number,
  err: unknown,
): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(
    `[cron:daily-audit-anchor] ${provider} failed for org ${orgId} day ${dayIso}:`,
    msg,
  );

  // A failed row records the attempt and is explicitly NOT sealed — it is
  // not evidence. The DB guard allows it to be replaced by a real anchor
  // on the next run; a completed anchor cannot be replaced.
  await db
    .execute(
      sql`
      INSERT INTO audit_anchor (
        org_id, anchor_date, provider, merkle_root, merkle_version,
        leaf_count, proof, proof_status, last_error, anchored_at, hash_version
      ) VALUES (
        ${orgId}, ${dayIso}, ${provider}, ${root}, ${MERKLE_VERSION_RFC6962},
        ${leafCount}, '', 'failed', ${msg.slice(0, 2000)}, now(), 4
      )
      ON CONFLICT (org_id, anchor_date, provider) DO UPDATE SET
        last_error   = EXCLUDED.last_error,
        proof_status = 'failed'
    `,
    )
    .catch((e) => {
      // The append-only guard refuses to downgrade a completed anchor to
      // failed. That is correct: evidence is not overwritten by a later
      // error. Log and move on.
      console.error(
        `[cron:daily-audit-anchor] could not record failure for ${orgId}/${dayIso}/${provider}:`,
        e instanceof Error ? e.message : String(e),
      );
    });
}
