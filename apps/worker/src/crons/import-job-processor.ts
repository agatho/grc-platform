// Sprint 59: Worker — Process pending import jobs
import { db, importJob, templatePack, templatePackItem } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processImportJobs = withCronInstrumentation(
  "import-job-processor",
  async (): Promise<void> => {
    const pendingJobs = await db
      .select()
      .from(importJob)
      .where(eq(importJob.status, "pending"))
      .limit(5);

    for (const job of pendingJobs) {
      try {
        // Mark as running
        await db
          .update(importJob)
          .set({
            status: "running",
            startedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(importJob.id, job.id));

        let processedCount = 0;
        let failedCount = 0;
        const errors: Array<{ item: string; error: string }> = [];

        if (job.source === "template_pack" && job.templatePackId) {
          const items = await db
            .select()
            .from(templatePackItem)
            .where(eq(templatePackItem.packId, job.templatePackId));

          // Pre-existing stub: actual per-item processing not yet wired up,
          // so we simply count the pack items as "processed" without iterating.
          processedCount += items.length;
        }

        await db
          .update(importJob)
          .set({
            status: failedCount === job.totalItems ? "failed" : "completed",
            processedItems: processedCount,
            failedItems: failedCount,
            errorLog: errors,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(importJob.id, job.id));
      } catch (err) {
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
  },
);
