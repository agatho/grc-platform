import { db, auditAnchor } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";
import { upgradeOtsProof } from "@grc/shared/lib/opentimestamps-upgrade";
import { withAuth } from "@/lib/api";

// POST /api/v1/audit-log/anchor/upgrade
//
// Poll every pending OpenTimestamps proof in this tenant and, for each,
// ask the calendar server whether the Bitcoin commitment is available
// yet. When it is, replace the stub with the full proof, record the
// Bitcoin block height, and flip proof_status to 'complete'.
//
// Runs synchronously in the request. Fine because typical pending rows
// per tenant is ≤7 (one per day until Bitcoin confirms) and each poll
// is one HTTP roundtrip. If a tenant had a backlog of 100+ rows, the
// worker cron is the right place — the API endpoint is for on-demand
// "i just want to see it committed now" use.
//
// Admin/auditor only.

interface UpgradeRowResult {
  id: string;
  anchorDate: string;
  status: "upgraded" | "still_pending" | "failed";
  bitcoinBlockHeight?: number;
  error?: string;
}

export async function POST(_req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select({
      id: auditAnchor.id,
      anchorDate: auditAnchor.anchorDate,
      proof: auditAnchor.proof,
      merkleRoot: auditAnchor.merkleRoot,
    })
    .from(auditAnchor)
    .where(and(
      eq(auditAnchor.orgId, ctx.orgId),
      eq(auditAnchor.provider, "opentimestamps"),
      eq(auditAnchor.proofStatus, "pending"),
    ));

  const results: UpgradeRowResult[] = [];

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
        results.push({
          id: row.id,
          anchorDate: row.anchorDate,
          status: "upgraded",
          bitcoinBlockHeight: up.bitcoinBlockHeight,
        });
      } else {
        results.push({
          id: row.id,
          anchorDate: row.anchorDate,
          status: "still_pending",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(auditAnchor)
        .set({ lastError: msg.slice(0, 2000) })
        .where(eq(auditAnchor.id, row.id));
      results.push({
        id: row.id,
        anchorDate: row.anchorDate,
        status: "failed",
        error: msg,
      });
    }
  }

  return Response.json({
    scanned: rows.length,
    upgraded: results.filter((r) => r.status === "upgraded").length,
    stillPending: results.filter((r) => r.status === "still_pending").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
}
