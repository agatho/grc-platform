// Sprint 70: Control Test Scheduler Worker
// Runs every 15 minutes — schedules automated control tests

import { db, controlTestScript, controlTestExecution } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";

export async function processControlTestScheduler(): Promise<{
  scriptsChecked: number;
  testsScheduled: number;
}> {
  console.log("[control-test-scheduler] Checking for scheduled tests");

  // Find active automated scripts that need execution based on frequency
  const dueScripts = await db
    .select()
    .from(controlTestScript)
    .where(
      and(
        eq(controlTestScript.isActive, true),
        sql`${controlTestScript.testType} IN ('automated', 'hybrid')`,
        sql`${controlTestScript.frequency} IS NOT NULL`,
      ),
    );

  let testsScheduled = 0;

  for (const script of dueScripts) {
    try {
      // Check last execution time
      const [lastExec] = await db
        .select({ createdAt: controlTestExecution.createdAt })
        .from(controlTestExecution)
        .where(eq(controlTestExecution.scriptId, script.id))
        .orderBy(sql`${controlTestExecution.createdAt} DESC`)
        .limit(1);

      const frequencyMs = getFrequencyMs(script.frequency ?? "weekly");
      const lastRunAt = lastExec?.createdAt?.getTime() ?? 0;

      if (Date.now() - lastRunAt >= frequencyMs) {
        await db.insert(controlTestExecution).values({
          scriptId: script.id,
          orgId: script.orgId,
          controlId: script.controlId,
          status: "pending",
          triggeredBy: "scheduled",
          startedAt: new Date(),
        });
        testsScheduled++;
        console.log(
          `[control-test-scheduler] Scheduled test for script ${script.name}`,
        );
      }
    } catch (err) {
      console.error(
        `[control-test-scheduler] Failed for script ${script.id}:`,
        err,
      );
    }
  }

  console.log(
    `[control-test-scheduler] Checked ${dueScripts.length} scripts, scheduled ${testsScheduled} tests`,
  );
  return { scriptsChecked: dueScripts.length, testsScheduled };
}

function getFrequencyMs(frequency: string): number {
  const map: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    quarterly: 90 * 24 * 60 * 60 * 1000,
  };
  return map[frequency] ?? map.weekly;
}
