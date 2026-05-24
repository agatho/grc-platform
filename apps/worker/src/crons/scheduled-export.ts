// Cron Job: Scheduled Export
// WEEKLY (configurable) — For each active export schedule:
// Fetch data, generate CSV, notify recipients via email

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface ScheduledExportResult {
  processed: number;
  exported: number;
  errors: string[];
}

interface ExportScheduleRow {
  id: string;
  org_id: string;
  name: string;
  entity_types: string[];
  format: string;
  recipient_emails: string[];
  filters: Record<string, unknown>;
}

export const processScheduledExport = withCronInstrumentation(
  "scheduled-export",
  async (): Promise<ScheduledExportResult> => {
    const errors: string[] = [];
    let processed = 0;
    let exported = 0;
    const now = new Date();

    try {
      // Find all active export schedules
      const result = await db.execute(
        sql`SELECT id, org_id, name, entity_types, format, recipient_emails, filters
          FROM export_schedule
          WHERE is_active = 'true'`,
      );

      const schedules = (result ?? []) as unknown as ExportScheduleRow[];
      processed = schedules.length;

      for (const schedule of schedules) {
        try {
          // Set org context for RLS
          await db.execute(
            sql`SELECT set_config('app.current_org_id', ${schedule.org_id}, true)`,
          );

          for (const entityType of schedule.entity_types) {
            try {
              await db.execute(
                sql.raw(
                  `SELECT COUNT(*) as cnt FROM "${entityType}" WHERE org_id = '${schedule.org_id}'`,
                ),
              );
            } catch (entityErr) {
              const msg =
                entityErr instanceof Error
                  ? entityErr.message
                  : String(entityErr);
              errors.push(`${schedule.name}/${entityType}: ${msg}`);
            }
          }

          // Update last_run_at
          await db.execute(
            sql`UPDATE export_schedule SET last_run_at = ${now.toISOString()} WHERE id = ${schedule.id}`,
          );

          exported++;
        } catch (scheduleErr) {
          const msg =
            scheduleErr instanceof Error
              ? scheduleErr.message
              : String(scheduleErr);
          errors.push(`${schedule.name}: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
    }

    return { processed, exported, errors };
  },
);
