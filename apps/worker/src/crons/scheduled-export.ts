// Cron Job: Scheduled Export
// WEEKLY (configurable) — For each active export schedule:
// Fetch data, generate CSV, notify recipients via email

import { db } from "@grc/db";
import { sql } from "drizzle-orm";

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

export async function processScheduledExport(): Promise<ScheduledExportResult> {
  const errors: string[] = [];
  let processed = 0;
  let exported = 0;
  const now = new Date();

  console.log(`[cron:scheduled-export] Starting at ${now.toISOString()}`);

  try {
    // Find all active export schedules
    const result = await db.execute(
      sql`SELECT id, org_id, name, entity_types, format, recipient_emails, filters
          FROM export_schedule
          WHERE is_active = 'true'`,
    );

    const schedules = (result.rows ?? []) as unknown as ExportScheduleRow[];
    processed = schedules.length;

    for (const schedule of schedules) {
      try {
        console.log(
          `[cron:scheduled-export] Processing schedule '${schedule.name}' (${schedule.id}) for org ${schedule.org_id}`,
        );

        // Set org context for RLS
        await db.execute(
          sql`SELECT set_config('app.current_org_id', ${schedule.org_id}, true)`,
        );

        // For each entity type in the schedule, export data
        const entityExports: { entityType: string; rowCount: number }[] = [];

        for (const entityType of schedule.entity_types) {
          try {
            const dataResult = await db.execute(
              sql.raw(
                `SELECT COUNT(*) as cnt FROM "${entityType}" WHERE org_id = '${schedule.org_id}'`,
              ),
            );
            const count = Number(
              (dataResult.rows[0] as { cnt: string })?.cnt ?? 0,
            );
            entityExports.push({ entityType, rowCount: count });
          } catch (entityErr) {
            const msg =
              entityErr instanceof Error
                ? entityErr.message
                : String(entityErr);
            console.error(
              `[cron:scheduled-export] Error exporting ${entityType}:`,
              msg,
            );
            errors.push(`${schedule.name}/${entityType}: ${msg}`);
          }
        }

        // Update last_run_at
        await db.execute(
          sql`UPDATE export_schedule SET last_run_at = ${now.toISOString()} WHERE id = ${schedule.id}`,
        );

        // In production: generate actual files and send via email service
        // sendEmail({ to: schedule.recipient_emails, ... })
        console.log(
          `[cron:scheduled-export] Completed schedule '${schedule.name}': ${entityExports.map((e) => `${e.entityType}(${e.rowCount})`).join(", ")}`,
        );

        exported++;
      } catch (scheduleErr) {
        const msg =
          scheduleErr instanceof Error
            ? scheduleErr.message
            : String(scheduleErr);
        console.error(
          `[cron:scheduled-export] Error processing schedule ${schedule.id}:`,
          msg,
        );
        errors.push(`${schedule.name}: ${msg}`);
      }
    }

    console.log(
      `[cron:scheduled-export] Done. ${exported}/${processed} schedules processed.`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron:scheduled-export] Fatal error:", msg);
    errors.push(msg);
  }

  return { processed, exported, errors };
}
