// Sprint 82: Marketplace Security Scanner Worker
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-15, S10-09]
//
// The job used to read:
//
//     // In production: run static analysis, dependency scan, malware check
//     // For now: auto-pass with no findings
//     const passed = true;
//
// and then set `scan_status: "passed"` with `criticalCount: 0`,
// `highCount: 0`, `mediumCount: 0`, `lowCount: 0`. Every plugin submitted
// to the marketplace passed its security review without any code being
// examined — the gate that is supposed to stop a malicious plugin was an
// unconditional approval.
//
// Now: a pending scan is claimed atomically (S10-09 — the previous
// `SELECT status='pending'` followed by an unguarded `UPDATE` was a
// read-then-claim race), then moved to `failed` with an explicit reason.
// A failed scan blocks publication; an auto-passed one does not. Erring
// towards "blocked" is the only defensible direction for a security gate.

import { db, marketplaceSecurityScan } from "@grc/db";
import { eq } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { claimRow, createRunReport } from "../lib/job-runtime";

export const processMarketplaceSecurityScanner = withCronInstrumentation(
  "marketplace-security-scanner",
  async (): Promise<{
    scansProcessed: number;
    scansBlocked: number;
    ok: boolean;
    failed: number;
    errors: string[];
  }> => {
    const report = createRunReport("marketplace-security-scanner");
    const pendingScans = await db
      .select({ id: marketplaceSecurityScan.id })
      .from(marketplaceSecurityScan)
      .where(eq(marketplaceSecurityScan.scanStatus, "pending"))
      .limit(50);

    let scansBlocked = 0;

    for (const scan of pendingScans) {
      try {
        // Guarded claim: only the worker that flips pending → scanning
        // proceeds. Two workers (scale-out, rolling deploy) or a retried
        // HTTP call can no longer both process the same submission.
        const claimed = await claimRow({
          table: "marketplace_security_scan",
          id: scan.id,
          statusColumn: "scan_status",
          expectedStatus: "pending",
          nextStatus: "scanning",
          touchColumns: ["started_at"],
        });
        if (!claimed) continue;

        await db
          .update(marketplaceSecurityScan)
          .set({
            scanStatus: "failed",
            completedAt: new Date(),
          })
          .where(eq(marketplaceSecurityScan.id, scan.id));
        scansBlocked++;

        report.fail(
          `scan ${scan.id}`,
          new Error(
            "marketplace security scanning (static analysis, dependency " +
              "scan, malware check) is not implemented in this build — the " +
              "submission is blocked rather than auto-approved",
          ),
        );
      } catch (err) {
        report.fail(`scan ${scan.id}`, err);
      }
    }

    return report.toResult({
      scansProcessed: pendingScans.length,
      scansBlocked,
    });
  },
);
