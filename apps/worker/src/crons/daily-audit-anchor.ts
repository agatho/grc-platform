// Cron Job: Daily Audit-Chain Anchor (ADR-011 rev.3)
//
// Nightly job that builds a Merkle tree over each tenant's audit_log
// entries of the previous UTC day, sends the Merkle root to FreeTSA
// (RFC 3161) and to the OpenTimestamps calendar pool, and stores both
// proofs in `audit_anchor`.
//
// The job is idempotent per (org_id, day, provider) via the unique
// index; retrying produces no duplicates but also doesn't overwrite —
// an existing successful anchor wins.
//
// Designed for: 00:05 UTC daily. If the job is started later, it
// still correctly targets "yesterday" in UTC.

import { db, auditLog, organization, auditAnchor } from "@grc/db";
import { and, eq, isNotNull, sql, asc, gte, lt } from "drizzle-orm";
import { merkleRoot } from "@grc/shared/lib/merkle-tree";
import * as freetsa from "@grc/shared/lib/freetsa";
import * as opentimestamps from "@grc/shared/lib/opentimestamps";

interface AnchorResult {
  orgsProcessed: number;
  anchorsCreated: number;
  errors: string[];
}

export async function processDailyAuditAnchor(
  targetDate?: Date,
): Promise<AnchorResult> {
  const errors: string[] = [];
  let anchorsCreated = 0;

  // Resolve the target day — default is "yesterday in UTC"
  const now = targetDate ?? new Date();
  const dayStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1,
  ));
  const dayEnd = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  const dayIso = dayStart.toISOString().slice(0, 10);

  console.log(`[cron:daily-audit-anchor] Anchoring ${dayIso}`);

  // 1. Find every tenant that had at least one audit event that day
  const activeOrgs = await db.execute<{ org_id: string }>(sql`
    SELECT DISTINCT org_id
    FROM audit_log
    WHERE previous_hash_scope LIKE 'org:%'
      AND created_at >= ${dayStart.toISOString()}
      AND created_at < ${dayEnd.toISOString()}
      AND org_id IS NOT NULL
  `);

  const rows: { org_id: string }[] = Array.isArray(activeOrgs)
    ? (activeOrgs as { org_id: string }[])
    : [];

  console.log(`[cron:daily-audit-anchor] ${rows.length} tenants had activity`);

  for (const { org_id: orgId } of rows) {
    try {
      const created = await anchorOneTenant(orgId, dayStart, dayEnd, dayIso);
      anchorsCreated += created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`org ${orgId}: ${msg}`);
      console.error(`[cron:daily-audit-anchor] org ${orgId} failed:`, msg);
    }
  }

  console.log(
    `[cron:daily-audit-anchor] done — orgs=${rows.length} anchors=${anchorsCreated} errors=${errors.length}`,
  );
  return { orgsProcessed: rows.length, anchorsCreated, errors };
}

async function anchorOneTenant(
  orgId: string,
  dayStart: Date,
  dayEnd: Date,
  dayIso: string,
): Promise<number> {
  // Pull that day's audit_log leaves, ordered for determinism
  const leafRows = await db
    .select({ entryHash: auditLog.entryHash })
    .from(auditLog)
    .where(and(
      eq(auditLog.orgId, orgId),
      gte(auditLog.createdAt, dayStart),
      lt(auditLog.createdAt, dayEnd),
      isNotNull(auditLog.entryHash),
    ))
    .orderBy(asc(auditLog.createdAt), asc(auditLog.id));

  const leaves = leafRows
    .map((r) => r.entryHash)
    .filter((h): h is string => !!h);

  if (leaves.length === 0) {
    return 0;
  }

  const root = merkleRoot(leaves);
  if (!root) {
    throw new Error("Merkle root computation returned null for non-empty leaves");
  }
  const rootBuffer = Buffer.from(root, "hex");

  let created = 0;

  // ── Provider 1: FreeTSA (RFC 3161) ─────────────────────────
  try {
    const existing = await db
      .select({ id: auditAnchor.id })
      .from(auditAnchor)
      .where(and(
        eq(auditAnchor.orgId, orgId),
        eq(auditAnchor.anchorDate, dayIso),
        eq(auditAnchor.provider, "freetsa"),
      ))
      .limit(1);

    if (existing.length === 0) {
      const tsa = await freetsa.requestTimestamp(rootBuffer);
      if (tsa.statusCode !== 0) {
        throw new Error(`FreeTSA status code ${tsa.statusCode}`);
      }
      await db.insert(auditAnchor).values({
        orgId,
        anchorDate: dayIso,
        provider: "freetsa",
        merkleRoot: root,
        leafCount: leaves.length,
        proof: tsa.proof.toString("base64"),
        proofStatus: "complete",
      });
      created++;
    }
  } catch (err) {
    await logAnchorFailure(orgId, dayIso, "freetsa", root, leaves.length, err);
  }

  // ── Provider 2: OpenTimestamps ────────────────────────────
  try {
    const existing = await db
      .select({ id: auditAnchor.id })
      .from(auditAnchor)
      .where(and(
        eq(auditAnchor.orgId, orgId),
        eq(auditAnchor.anchorDate, dayIso),
        eq(auditAnchor.provider, "opentimestamps"),
      ))
      .limit(1);

    if (existing.length === 0) {
      const ots = await opentimestamps.submitToAnyCalendar(rootBuffer);
      await db.insert(auditAnchor).values({
        orgId,
        anchorDate: dayIso,
        provider: "opentimestamps",
        merkleRoot: root,
        leafCount: leaves.length,
        proof: ots.stub.toString("base64"),
        // OTS is "pending" until the next Bitcoin block includes the
        // calendar's aggregate — a separate upgrade job (Phase 2)
        // promotes the proof to 'complete' with a block height.
        proofStatus: "pending",
      });
      created++;
    }
  } catch (err) {
    await logAnchorFailure(orgId, dayIso, "opentimestamps", root, leaves.length, err);
  }

  return created;
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
  console.error(`[cron:daily-audit-anchor] ${provider} failed for org ${orgId}:`, msg);

  // Record the failure so an operator can retry or investigate. Upsert
  // pattern — if a prior failed row exists for (org, day, provider),
  // update its error. Otherwise insert a fresh row with status=failed.
  await db
    .insert(auditAnchor)
    .values({
      orgId,
      anchorDate: dayIso,
      provider,
      merkleRoot: root,
      leafCount,
      proof: "",
      proofStatus: "failed",
      lastError: msg.slice(0, 2000),
    })
    .onConflictDoUpdate({
      target: [auditAnchor.orgId, auditAnchor.anchorDate, auditAnchor.provider],
      set: { lastError: msg.slice(0, 2000), proofStatus: "failed" },
    });
}

// Suppress unused warnings — organization import is retained for future
// filtering (e.g. skipping archived tenants).
void organization;
