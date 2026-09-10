// Retention Monitoring — Fristenüberwachung UND Fristendurchsetzung
//
// ── ARCTOS-FULL-2026-08-31 · WP8 · S07-07 (High) ─────────────────────
//
// Der Job war der EINZIGE Retention-Job über personenbezogene Daten und
// hatte zwei Defekte, die zusammen dafür sorgten, dass nichts gelöscht
// wurde:
//
//  1. Er erzeugte `deletion_request`-Tickets. `deletion_request` ist eine
//     reine Workflow-Tabelle (`deletion_started_at`, `verified_by`,
//     `evidence_description` — Felder, die ein Mensch ausfüllt), und es
//     gab keinen Verbraucher, der aus einem Ticket eine Löschung
//     abgeleitet hätte. `grep -rn "deletionRequest"` fand vier
//     Fundstellen: zwei Zählungen für den Jahresbericht, ein CRUD und
//     diesen Job.
//
//  2. Er rechnete die Frist gegen `schedule.createdAt` — das Anlagedatum
//     der REGEL, nicht das Alter der DATEN. Eine heute angelegte Regel
//     mit sechs Monaten Frist meldet in sechs Monaten "überfällig",
//     unabhängig davon, wie alt die Daten sind; eine jahrealte Regel
//     meldet jeden Tag "überfällig", obwohl die Daten von gestern sind.
//
// Die Produktdokumentation behauptete derweil "automatisierte Deletion ✅"
// und "~95 % GDPR-Readiness".
//
// Was der Job jetzt tut: er löst die Datenkategorie einer
// `retention_schedule` über `retention_binding` (Migration 0429) in
// konkrete Tabellen und Fristspalten auf und führt die Löschung über
// `retention_purge_table()` aus — fristbezogen, je Mandant, mit Nachweis
// in `retention_run_log`. Kategorien ohne Bindung erzeugen weiterhin ein
// Ticket, weil dort tatsächlich ein Mensch entscheiden muss; das ist dann
// der begründete Ausnahmefall und nicht der Normalzustand.
//
// SCHEDULER: `apps/worker/src/index.ts` gehört WP9; der
// Registrierungsbedarf steht in /work/audit/remediation/WP8.md unter
// "Bedarf an andere Pakete". Empfehlung: täglich 03:30 UTC.

import { db, retentionSchedule, deletionRequest, notification } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface MonitoringResult {
  schedulesProcessed: number;
  bindingsExecuted: number;
  rowsDeleted: number;
  ticketsCreated: number;
  categoriesWithoutBinding: string[];
}

interface BindingRow {
  id: string;
  table_name: string;
  default_retention_days: number;
}

function unwrap<T>(rows: unknown): T[] {
  return (
    Array.isArray(rows) ? rows : ((rows as { rows?: T[] }).rows ?? [])
  ) as T[];
}

export const processRetentionMonitoring = withCronInstrumentation(
  "retention-monitoring",
  async (opts?: { dryRun?: boolean }): Promise<MonitoringResult> => {
    const dryRun = opts?.dryRun === true;
    let bindingsExecuted = 0;
    let rowsDeleted = 0;
    let ticketsCreated = 0;
    const categoriesWithoutBinding = new Set<string>();
    const errors: string[] = [];

    const schedules = await db
      .select()
      .from(retentionSchedule)
      .where(eq(retentionSchedule.isActive, true));

    for (const schedule of schedules) {
      // Die Frist der Regel in Tagen. `retention_period_months` ist die
      // fachliche Angabe; 30 Tage je Monat ist die Näherung, die das
      // Produkt auch an den übrigen Stellen verwendet.
      const retentionDays = Math.max(
        1,
        Math.round(schedule.retentionPeriodMonths * 30),
      );

      let bindings: BindingRow[] = [];
      try {
        const rows = await db.execute(sql`
          SELECT id::text AS id, table_name, default_retention_days
            FROM retention_binding
           WHERE is_active
             AND data_category = ${schedule.dataCategory}
             AND (org_id IS NULL OR org_id = ${schedule.orgId}::uuid)
           ORDER BY (org_id IS NOT NULL) DESC, table_name
        `);
        bindings = unwrap<BindingRow>(rows);
      } catch (err) {
        errors.push(
          `binding lookup for ${schedule.dataCategory}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        continue;
      }

      if (bindings.length === 0) {
        // Keine technische Bindung — hier ist ein Ticket die ehrliche
        // Antwort, weil die Plattform nicht weiss, wo diese Daten liegen.
        categoriesWithoutBinding.add(schedule.dataCategory);

        const [existing] = await db
          .select()
          .from(deletionRequest)
          .where(
            and(
              eq(deletionRequest.scheduleId, schedule.id),
              eq(deletionRequest.orgId, schedule.orgId),
              sql`${deletionRequest.status} NOT IN ('closed', 'rejected')`,
            ),
          );

        if (!existing) {
          await db.insert(deletionRequest).values({
            orgId: schedule.orgId,
            scheduleId: schedule.id,
            title: `Manual deletion required: ${schedule.name}`,
            dataCategory: schedule.dataCategory,
            status: "identified",
          });
          ticketsCreated++;

          if (schedule.responsibleId) {
            await db.insert(notification).values({
              orgId: schedule.orgId,
              userId: schedule.responsibleId,
              type: "escalation",
              title: `Retention schedule without technical binding: ${schedule.name}`,
              message:
                `Data category "${schedule.dataCategory}" has a retention period of ` +
                `${schedule.retentionPeriodMonths} months but no retention_binding, so ARCTOS ` +
                `cannot enforce it automatically. Deletion has to be carried out and evidenced manually.`,
              entityType: "retention_schedule",
              entityId: schedule.id,
              templateData: {
                module: "dpms",
                priority: "high",
                subtype: "retention_no_binding",
              },
            });
          }
        }
        continue;
      }

      for (const binding of bindings) {
        try {
          const rows = await db.execute(sql`
            SELECT public.retention_purge_table(
              ${binding.id}::bigint,
              ${schedule.orgId}::uuid,
              ${retentionDays}::int,
              ${dryRun}
            ) AS n
          `);
          const n = Number(unwrap<{ n: number }>(rows)[0]?.n ?? 0);
          bindingsExecuted++;
          rowsDeleted += n;
        } catch (err) {
          // Ein Fehler in einer Tabelle darf die übrigen Fristen nicht
          // aufhalten — er wird aber gemeldet, nicht verschluckt
          // (S10-11: 39 leere catch-Blöcke im Worker).
          errors.push(
            `${schedule.dataCategory}/${binding.table_name}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }

    if (errors.length > 0) {
      // Ein Retention-Job, der bei Fehlern grün meldet, ist die
      // Doku-Drift von morgen.
      throw new Error(
        `retention-monitoring: ${errors.length} binding(s) failed — ${errors.join("; ")}`,
      );
    }

    return {
      schedulesProcessed: schedules.length,
      bindingsExecuted,
      rowsDeleted,
      ticketsCreated,
      categoriesWithoutBinding: [...categoriesWithoutBinding],
    };
  },
);
