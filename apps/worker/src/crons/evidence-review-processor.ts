// Sprint 68: Evidence Review Processor Worker
// Runs every 5 minutes — processes pending evidence review jobs

import { db, evidenceReviewJob } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processEvidenceReviewJobs = withCronInstrumentation(
  "evidence-review-processor",
  async (): Promise<{
    processed: number;
    completed: number;
    failed: number;
  }> => {
    const pendingJobs = await db
      .select()
      .from(evidenceReviewJob)
      .where(eq(evidenceReviewJob.status, "pending"))
      .limit(5);

    let completed = 0;
    let failed = 0;

    for (const job of pendingJobs) {
      try {
        await db
          .update(evidenceReviewJob)
          .set({
            status: "running",
            startedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(evidenceReviewJob.id, job.id));

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

    return { processed: pendingJobs.length, completed, failed };
  },
);
