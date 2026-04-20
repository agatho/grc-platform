// Sprint 68: Evidence Review Processor Worker
// Runs every 5 minutes — processes pending evidence review jobs

import { db, evidenceReviewJob } from "@grc/db";
import { eq, and } from "drizzle-orm";

export async function processEvidenceReviewJobs(): Promise<{
  processed: number;
  completed: number;
  failed: number;
}> {
  console.log("[evidence-review-processor] Checking for pending jobs");

  const pendingJobs = await db
    .select()
    .from(evidenceReviewJob)
    .where(eq(evidenceReviewJob.status, "pending"))
    .limit(5);

  let completed = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    try {
      // Mark as running
      await db
        .update(evidenceReviewJob)
        .set({
          status: "running",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(evidenceReviewJob.id, job.id));

      console.log(
        `[evidence-review-processor] Processing job ${job.name} (${job.id})`,
      );

      // In production: fetch evidence, classify via AI, identify gaps
      // For now, mark as completed
      await db
        .update(evidenceReviewJob)
        .set({
          status: "completed",
          completedAt: new Date(),
          durationMs: Date.now() - (job.startedAt?.getTime() ?? Date.now()),
          updatedAt: new Date(),
        })
        .where(eq(evidenceReviewJob.id, job.id));

      completed++;
    } catch (err) {
      console.error(`[evidence-review-processor] Job ${job.id} failed:`, err);
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

  console.log(
    `[evidence-review-processor] Done: ${pendingJobs.length} checked, ${completed} completed, ${failed} failed`,
  );
  return { processed: pendingJobs.length, completed, failed };
}
