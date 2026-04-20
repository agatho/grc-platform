// Cron Job: OpenTimestamps Proof Upgrade (ADR-011 rev.3 Phase 2)
//
// Walks every audit_anchor row with provider='opentimestamps' and
// proof_status='pending', polls the calendar server for each to see if
// the Bitcoin commitment has been included in a block yet. If yes,
// replaces the pending stub with the complete proof and records the
// block height. If not, leaves the row alone and tries again next run.
//
// Runs every 30 minutes. OpenTimestamps calendars typically commit once
// per hour, so a 30-minute cadence catches every attestation within an
// hour of confirmation.
//
// Idempotent: re-running has no effect on already-'complete' rows.

import { db, auditAnchor } from "@grc/db";
import { and, eq, sql, lt } from "drizzle-orm";
import { upgradeOtsProof } from "@grc/shared/lib/opentimestamps-upgrade";

interface UpgradeRunResult {
  scanned: number;
  upgraded: number;
  stillPending: number;
  failed: Array<{ id: string; error: string }>;
}

export async function processOtsUpgrade(): Promise<UpgradeRunResult> {
  const now = new Date();
  console.log(`[cron:ots-upgrade] start at ${now.toISOString()}`);

  // Only try rows at least ~45 minutes old. Calendar servers commit
  // their aggregate roughly hourly; polling sooner is wasted effort.
  const ripeThreshold = new Date(now.getTime() - 45 * 60 * 1000);

  const rows = await db
    .select({
      id: auditAnchor.id,
      proof: auditAnchor.proof,
      merkleRoot: auditAnchor.merkleRoot,
    })
    .from(auditAnchor)
    .where(
      and(
        eq(auditAnchor.provider, "opentimestamps"),
        eq(auditAnchor.proofStatus, "pending"),
        lt(auditAnchor.createdAt, ripeThreshold),
      ),
    );

  console.log(`[cron:ots-upgrade] ${rows.length} pending rows ready to poll`);

  const result: UpgradeRunResult = {
    scanned: rows.length,
    upgraded: 0,
    stillPending: 0,
    failed: [],
  };

  for (const row of rows) {
    try {
      const up = await upgradeOtsProof(row.proof, row.merkleRoot);
      if (up.upgraded && up.newProofBase64) {
        await db
          .update(auditAnchor)
          .set({
            proof: up.newProofBase64,
            proofStatus: "complete",
            bitcoinBlockHeight: up.bitcoinBlockHeight ?? null,
            upgradedAt: sql`now()`,
            lastError: null,
          })
          .where(eq(auditAnchor.id, row.id));
        result.upgraded++;
        console.log(
          `[cron:ots-upgrade] upgraded ${row.id} → block ${up.bitcoinBlockHeight ?? "?"}`,
        );
      } else {
        result.stillPending++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed.push({ id: row.id, error: msg });
      await db
        .update(auditAnchor)
        .set({ lastError: msg.slice(0, 2000) })
        .where(eq(auditAnchor.id, row.id));
      console.error(`[cron:ots-upgrade] ${row.id} failed:`, msg);
    }
  }

  console.log(
    `[cron:ots-upgrade] done — scanned=${result.scanned} upgraded=${result.upgraded} pending=${result.stillPending} failed=${result.failed.length}`,
  );
  return result;
}
