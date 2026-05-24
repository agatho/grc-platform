// Cron Job: Process Mining Conformance
//
// For every process_event_log row that has status='imported' (i.e. ingested
// but not yet analyzed), compute a conformance score: percentage of unique
// case traces (case_id-ordered activity sequences) whose every activity
// matches at least one BPMN process_step name in the linked process.
//
// Also identifies:
//   - fitness gaps: activities in the log that have no matching process_step
//   - bottlenecks: activities with the highest median wait time before them
//   - rework loops: activities that appear ≥2× in a single case trace
//
// Writes the result into process_conformance_result and marks the event log
// as 'analyzed'. Idempotent — re-runs replace prior result for the same log.

import {
  db,
  processEventLog,
  processConformanceResult,
  processStep,
} from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface ConformanceResult {
  processed: number;
  analyzed: number;
  errors: number;
}

export const processMiningConformance = withCronInstrumentation(
  "process-mining-conformance",
  async (): Promise<ConformanceResult> => {
    const logs = await db
      .select({
        id: processEventLog.id,
        orgId: processEventLog.orgId,
        processId: processEventLog.processId,
      })
      .from(processEventLog)
      .where(eq(processEventLog.status, "imported"));

    let analyzed = 0;
    let errors = 0;

    for (const log of logs) {
      try {
        if (!log.processId) {
          await db
            .update(processEventLog)
            .set({ status: "skipped_no_process" })
            .where(eq(processEventLog.id, log.id));
          continue;
        }

        // Fetch process steps for the linked process
        const steps = await db
          .select({ name: processStep.name })
          .from(processStep)
          .where(eq(processStep.processId, log.processId));
        const stepNames = new Set(
          steps.map((s) => (s.name ?? "").toLowerCase()).filter(Boolean),
        );

        // Get traces grouped by case_id
        const traceRows = (await db.execute(sql`
        SELECT case_id, array_agg(activity ORDER BY "timestamp") AS activities
        FROM process_event
        WHERE event_log_id = ${log.id}
        GROUP BY case_id
      `)) as Array<{ case_id: string; activities: string[] }>;

        let conformantTraces = 0;
        const fitnessGapCount = new Map<string, number>();
        const reworkCount = new Map<string, number>();

        for (const trace of traceRows) {
          let conformant = true;
          const seenInTrace = new Set<string>();
          for (const act of trace.activities) {
            const a = (act ?? "").toLowerCase();
            if (!stepNames.has(a)) {
              conformant = false;
              fitnessGapCount.set(act, (fitnessGapCount.get(act) ?? 0) + 1);
            }
            if (seenInTrace.has(a)) {
              reworkCount.set(act, (reworkCount.get(act) ?? 0) + 1);
            }
            seenInTrace.add(a);
          }
          if (conformant) conformantTraces += 1;
        }

        const total = traceRows.length;
        const score =
          total === 0
            ? 0
            : Math.round((conformantTraces / total) * 10000) / 100;

        const bottlenecks = (await db.execute(sql`
        WITH ordered AS (
          SELECT case_id, activity, "timestamp",
                 LAG("timestamp") OVER (PARTITION BY case_id ORDER BY "timestamp") AS prev_ts
          FROM process_event
          WHERE event_log_id = ${log.id}
        )
        SELECT activity,
               COUNT(*)::int AS occurrences,
               EXTRACT(EPOCH FROM percentile_cont(0.5)
                 WITHIN GROUP (ORDER BY ("timestamp" - prev_ts)))::int AS median_wait_seconds
        FROM ordered
        WHERE prev_ts IS NOT NULL
        GROUP BY activity
        ORDER BY median_wait_seconds DESC NULLS LAST
        LIMIT 10
      `)) as Array<{
          activity: string;
          occurrences: number;
          median_wait_seconds: number;
        }>;

        const fitnessGaps = Array.from(fitnessGapCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([activity, count]) => ({ activity, count }));

        const reworkLoops = Array.from(reworkCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([activity, count]) => ({ activity, repeatOccurrences: count }));

        // Upsert the conformance result
        await db.transaction(async (tx) => {
          await tx
            .delete(processConformanceResult)
            .where(eq(processConformanceResult.eventLogId, log.id));
          await tx.insert(processConformanceResult).values({
            eventLogId: log.id,
            orgId: log.orgId,
            processId: log.processId,
            conformanceScore: String(score),
            totalTraces: total,
            conformantTraces,
            fitnessGaps,
            precisionIssues: [],
            reworkLoops,
            bottlenecks: bottlenecks as any,
          });
          await tx
            .update(processEventLog)
            .set({ status: "analyzed" })
            .where(eq(processEventLog.id, log.id));
        });

        analyzed += 1;
      } catch (err) {
        errors += 1;
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(processEventLog)
          .set({ status: "error", errorMessage: message.slice(0, 1000) })
          .where(eq(processEventLog.id, log.id))
          .catch(() => {});
      }
    }

    return { processed: logs.length, analyzed, errors };
  },
);
