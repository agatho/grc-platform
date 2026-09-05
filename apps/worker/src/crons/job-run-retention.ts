// job-run-retention.ts
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-02] Housekeeping for `job_run`, the
// operational log the new scheduler writes (migration 0435).
//
// [Welle 5c] Der Kopf nannte „129 jobs, some at minute cadence, produce
// roughly 40k rows a day". Beide Zahlen sind falsch. Nachgemessen am
// 2026-09-05, aus `JOB_REGISTRY` und den 131 Cron-Ausdrücken ausgezählt:
//
//   registrierte Jobs                                    131  (nicht 129)
//   Läufe pro Tag                                      4.053  (nicht 40.000)
//   Jobs mit einer Taktung unter fünf Minuten               1  (webhook-dispatch)
//
// „some at minute cadence" beschreibt genau einen Job. Die Hochrechnung
// war offenbar „viele Jobs im Minutentakt" und liegt um den Faktor zehn
// daneben. Die Aufräumentscheidung selbst bleibt richtig — 4.053 Zeilen am
// Tag sind über das 90-Tage-Fenster rund 365.000 Zeilen, und ohne Purge
// wächst die Tabelle weiter über alles hinaus, was sie beobachtbar machen
// soll. Aber eine Begründung mit einer zehnfach zu hohen Zahl ist keine.
// `apps/worker/tests/lib/job-catchup.test.ts` rechnet beide Werte bei
// jedem Lauf neu aus und hält diesen Kommentar daran fest.
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
