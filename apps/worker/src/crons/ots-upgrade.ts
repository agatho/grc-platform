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
import { withCronInstrumentation } from "../lib/cron-instrument";

interface UpgradeRunResult {
  scanned: number;
  upgraded: number;
  stillPending: number;
  failed: Array<{ id: string; error: string }>;
}

export const processOtsUpgrade = withCronInstrumentation(
  "ots-upgrade",
  async (): Promise<UpgradeRunResult> => {
    const now = new Date();

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
      }
    }

    return result;
  },
);
