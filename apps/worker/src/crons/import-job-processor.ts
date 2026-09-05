// Sprint 59: Worker — Process pending import jobs
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-15, S10-09]
//
// Two defects, both in the audit:
//
// (1) The job reported success without importing anything. Its own comment
//     said so: "Pre-existing stub: actual per-item processing not yet wired
//     up, so we simply count the pack items as 'processed' without
//     iterating." It then wrote `status: "completed"` with
//     `processedItems = items.length`. The user saw a finished import and
//     an empty target.
//
// (2) Read-then-claim race. `SELECT … WHERE status='pending' LIMIT 5`
//     followed by `UPDATE … SET status='running'` with no `AND status =
//     'pending'` in the WHERE and no `RETURNING` check. Two workers, or one
//     external caller retrying after a gateway timeout, both processed the
//     same five jobs. And once a worker died after the claim, the row stayed
//     `running` forever with no lease — the user could never restart it.
//
// Now: rows are claimed atomically, a job that cannot be executed is marked
// `failed` with a reason rather than `completed` with a fictional count,
// and stale `running` rows are returned to `pending` after a lease timeout.

import { db, importJob, templatePackItem } from "@grc/db";
import { eq } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import {
  claimRow,
  createRunReport,
  reclaimStaleRows,
} from "../lib/job-runtime";

/** A job still `running` after this long belongs to a dead worker. */
const LEASE_MINUTES = Number(process.env.IMPORT_JOB_LEASE_MINUTES ?? 30);

export const processImportJobs = withCronInstrumentation(
  "import-job-processor",
  async (): Promise<{
    claimed: number;
    reclaimed: number;
    ok: boolean;
    failed: number;
    errors: string[];
  }> => {
    const report = createRunReport("import-job-processor");

    // Lease expiry first, so a crashed run becomes claimable again (S10-09
    // scenario C). Without this, an OOM kill pinned the row to `running`
    // permanently and the UI showed an import that never finished.
    const reclaimed = await reclaimStaleRows({
      table: "import_job",
      runningStatus: "running",
      resetStatus: "pending",
      staleAfterMinutes: LEASE_MINUTES,
    });

    const pendingJobs = await db
      .select({
        id: importJob.id,
        source: importJob.source,
        templatePackId: importJob.templatePackId,
      })
      .from(importJob)
      .where(eq(importJob.status, "pending"))
      .limit(5);

    let claimed = 0;

    for (const job of pendingJobs) {
      try {
        const won = await claimRow({
          table: "import_job",
          id: job.id,
          expectedStatus: "pending",
          nextStatus: "running",
          touchColumns: ["started_at", "updated_at"],
        });
        if (!won) continue;
        claimed++;

        let itemCount = 0;
        if (job.source === "template_pack" && job.templatePackId) {
          const items = await db
            .select({ id: templatePackItem.id })
            .from(templatePackItem)
            .where(eq(templatePackItem.packId, job.templatePackId));
          itemCount = items.length;
        }

        await db
          .update(importJob)
          .set({
            status: "failed",
            processedItems: 0,
            failedItems: 0,
            errorLog: [
              {
                item: "job",
                error:
                  "Import execution is not implemented in this build. " +
                  `${itemCount} item(s) were identified but none were ` +
                  "imported. The job is marked failed rather than completed " +
                  "so the missing data is visible.",
              },
            ],
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(importJob.id, job.id));

        report.fail(
          `import job ${job.id}`,
          new Error(
            `import execution not implemented — ${itemCount} item(s) not imported`,
          ),
        );
      } catch (err) {
        report.fail(`import job ${job.id}`, err);
        await db
          .update(importJob)
          .set({
            status: "failed",
            errorLog: [
              {
                item: "job",
                error: err instanceof Error ? err.message : "Unknown",
              },
            ],
            updatedAt: new Date(),
          })
          .where(eq(importJob.id, job.id));
      }
    }

    return report.toResult({ claimed, reclaimed });
  },
);
