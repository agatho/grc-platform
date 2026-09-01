// job-run-retention.ts
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-02] Housekeeping for `job_run`, the
// operational log the new scheduler writes (migration 0435). 129 jobs, some
// at minute cadence, produce roughly 40k rows a day; without a purge the
// table would outgrow everything it is meant to make observable.
//
// `job_run` is NOT evidence — it records that a job ran, not what it found —
// so a 90-day window is a retention decision, not an audit-trail question.
// Runs that failed are kept twice as long, because a failure is what an
// operator goes looking for weeks later.

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

const KEEP_DAYS_OK = Number(process.env.JOB_RUN_RETENTION_DAYS ?? 90);
const KEEP_DAYS_FAILED = KEEP_DAYS_OK * 2;

export const processJobRunRetention = withCronInstrumentation(
  "job-run-retention",
  async (): Promise<{ deleted: number }> => {
    const deleted = await db.execute(sql`
      DELETE FROM job_run
       WHERE (status IN ('success', 'skipped_locked')
              AND started_at < now() - (${KEEP_DAYS_OK} || ' days')::interval)
          OR (status IN ('failed', 'partial')
              AND started_at < now() - (${KEEP_DAYS_FAILED} || ' days')::interval)
          -- A row still marked "running" long after the fact is a crashed
          -- run; keep it as long as a failure, then drop it.
          OR (status = 'running'
              AND started_at < now() - (${KEEP_DAYS_FAILED} || ' days')::interval)
      RETURNING id`);
    return { deleted: (deleted as unknown as unknown[]).length };
  },
);
