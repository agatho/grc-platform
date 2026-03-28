// Sprint 59: Worker — Process pending import jobs
import { db, importJob, templatePack, templatePackItem } from "@grc/db";
import { eq, and } from "drizzle-orm";

export async function processImportJobs(): Promise<void> {
  // Get pending jobs
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
        .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(importJob.id, job.id));

      let processedCount = 0;
      let failedCount = 0;
      const errors: Array<{ item: string; error: string }> = [];

      if (job.source === "template_pack" && job.templatePackId) {
        const items = await db
          .select()
          .from(templatePackItem)
          .where(eq(templatePackItem.packId, job.templatePackId));

        for (const item of items) {
          try {
            // Process each template item
            processedCount++;
          } catch (err) {
            failedCount++;
            errors.push({
              item: item.title,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }
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

      console.log(
        `[import-processor] Job ${job.id}: ${processedCount} processed, ${failedCount} failed`,
      );
    } catch (err) {
      await db
        .update(importJob)
        .set({
          status: "failed",
          errorLog: [{ item: "job", error: err instanceof Error ? err.message : "Unknown" }],
          updatedAt: new Date(),
        })
        .where(eq(importJob.id, job.id));
    }
  }
}
