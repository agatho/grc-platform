// Sprint 68: Evidence Review Processor Worker
// Runs every 5 minutes — processes pending evidence review jobs

import { db, evidenceReviewJob } from "@grc/db";
import { eq } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import {
  claimRow,
  createRunReport,
  reclaimStaleRows,
} from "../lib/job-runtime";

/** A job still `running` after this long belongs to a dead worker. */
const LEASE_MINUTES = Number(process.env.EVIDENCE_REVIEW_LEASE_MINUTES ?? 30);

export const processEvidenceReviewJobs = withCronInstrumentation(
  "evidence-review-processor",
  async (): Promise<{
    processed: number;
    completed: number;
    failed: number;
    reclaimed: number;
    ok: boolean;
    errors: string[];
  }> => {
    // [WP9 · S10-09 scenario C] Lease expiry: a worker killed after the
    // claim used to pin its row to `running` forever, with no way for the
    // user to restart the review.
    const reclaimed = await reclaimStaleRows({
      table: "evidence_review_job",
      runningStatus: "running",
      resetStatus: "pending",
      staleAfterMinutes: LEASE_MINUTES,
    });

    const pendingJobs = await db
      .select({ id: evidenceReviewJob.id })
      .from(evidenceReviewJob)
      .where(eq(evidenceReviewJob.status, "pending"))
      .limit(5);

    const report = createRunReport("evidence-review-processor");
    const completed = 0;
    let failed = 0;

    for (const job of pendingJobs) {
      try {
        // [WP9 · S10-09] Guarded claim instead of the unconditional
        // pending → running UPDATE.
        const claimed = await claimRow({
          table: "evidence_review_job",
          id: job.id,
          expectedStatus: "pending",
          nextStatus: "running",
          touchColumns: ["started_at", "updated_at"],
        });
        if (!claimed) continue;

        // [WP9 · S10-15 class] The two UPDATEs used to be adjacent: the job
        // went pending → running → completed with nothing in between. Every
        // evidence review was recorded as done without a single evidence
        // item being looked at. Until a review engine exists, the job fails
        // with a reason instead of reporting a completed review.
        await db
          .update(evidenceReviewJob)
          .set({
            status: "failed",
            errorMessage:
              "Evidence review execution is not implemented in this build. " +
              "No evidence was reviewed, so the job is not marked completed.",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(evidenceReviewJob.id, job.id));
        failed++;
        report.fail(
          `review job ${job.id}`,
          new Error("evidence review engine not implemented"),
        );
      } catch (err) {
        report.fail(`review job ${job.id}`, err);
        await db
          .update(evidenceReviewJob)
          .set({
            status: "failed",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(evidenceReviewJob.id, job.id));
        failed++;
      }
    }

    return report.toResult({
      processed: pendingJobs.length,
      completed,
      failed,
      reclaimed,
    });
  },
);
