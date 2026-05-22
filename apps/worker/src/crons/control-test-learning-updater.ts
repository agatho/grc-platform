// Sprint 70: Control Test Learning Updater Worker
// Runs daily — analyzes test execution history and updates learning patterns

import { db, controlTestExecution, controlTestLearning } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processControlTestLearning = withCronInstrumentation(
  "control-test-learning-updater",
  async (): Promise<{ patternsUpdated: number }> => {

  // Find controls with multiple test executions to analyze patterns
  const controlStats = await db
    .select({
      orgId: controlTestExecution.orgId,
      controlId: controlTestExecution.controlId,
      totalTests: sql<number>`count(*)`,
      failCount: sql<number>`count(*) filter (where ${controlTestExecution.result} = 'fail')`,
      passCount: sql<number>`count(*) filter (where ${controlTestExecution.result} = 'pass')`,
    })
    .from(controlTestExecution)
    .where(sql`${controlTestExecution.result} IS NOT NULL`)
    .groupBy(controlTestExecution.orgId, controlTestExecution.controlId)
    .having(sql`count(*) >= 3`);

  let patternsUpdated = 0;

  for (const stat of controlStats) {
    const failRate = stat.failCount / stat.totalTests;

    if (failRate > 0.5) {
      // Common failure pattern
      await db
        .insert(controlTestLearning)
        .values({
          orgId: stat.orgId,
          controlId: stat.controlId,
          patternType: "common_failure",
          pattern: {
            description: `Control fails ${(failRate * 100).toFixed(0)}% of tests`,
            conditions: { failRate, totalTests: stat.totalTests },
            frequency: stat.failCount,
            lastSeen: new Date().toISOString(),
          },
          confidence: String(Math.min(failRate * 100, 99)),
          sampleSize: stat.totalTests,
        })
        .onConflictDoNothing();
      patternsUpdated++;
    }
  }

    return { patternsUpdated };
  },
);
