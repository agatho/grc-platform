// Retention: Zugriffs-, Sitzungs- und Telemetrieprotokolle
//
// ── ARCTOS-FULL-2026-08-31 · WP8 · S07-24 (Low), S07-23 (Low) ────────
//
// Befund S07-24: Tabellen mit IP-Adresse und/oder User-Agent —
// `access_log`, `audit_log`, `audit_sign_off`, `consent_record`,
// `data_export_log`, `dd_session.ip_address_log`, `document_signature`,
// `mobile_session`, `policy_acknowledgment`, `portal_audit_trail`,
// `portal_session`, `process_sign_off`, `sovereignty_audit_log`,
// `vendor_sign_off` — unterlagen keiner Löschfrist. Kein einziger
// Worker-Job berührte eine davon löschend. `access_log` hält zusätzlich
// `email_attempted`, `geo_location` und `failure_reason`, also auch
// fehlgeschlagene Anmeldeversuche mit E-Mail-Adresse, unbefristet.
//
// Dieser Job setzt die Fristen der PLATTFORM-Vorgaben durch (die Zeilen
// mit `org_id IS NULL` in `retention_binding`, Migration 0429), also
// unabhängig davon, ob ein Mandant eine `retention_schedule` gepflegt
// hat. Eine mandantenspezifische Frist übersteuert die Vorgabe;
// `retention-monitoring` führt diesen Fall aus.
//
// Bewusst NICHT hier: `audit_log` und die Sign-off-Tabellen. Der
// Audit-Trail ist append-only und trägt die Nachweisfunktion des
// Produkts; sein Personenbezug wird durch Redaktion beendet
// (`gdpr_erase_subject`, Migration 0434), nicht durch Löschung. Das ist
// der Zielkonflikt aus S07-28 und die Stelle, an der er aufgelöst wird —
// siehe docs/compliance/gdpr-erasure-vs-immutability.md.
//
// SCHEDULER: Registrierung in `apps/worker/src/index.ts` (WP9) nötig.
// Empfehlung: täglich 03:45 UTC.

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface RetentionAccessLogResult {
  bindings: number;
  rowsDeleted: number;
  perTable: { table: string; rows: number }[];
  dryRun: boolean;
}

interface BindingRow {
  id: string;
  table_name: string;
  data_category: string;
  default_retention_days: number;
}

function unwrap<T>(rows: unknown): T[] {
  return (
    Array.isArray(rows) ? rows : ((rows as { rows?: T[] }).rows ?? [])
  ) as T[];
}

/** Kategorien, die dieser Job durchsetzt. */
const CATEGORIES = [
  "access_log",
  "session",
  "export_log",
  "notification",
  "training",
];

export const processRetentionAccessLogs = withCronInstrumentation(
  "retention-access-logs",
  async (opts?: {
    dryRun?: boolean;
    categories?: string[];
  }): Promise<RetentionAccessLogResult> => {
    const dryRun = opts?.dryRun === true;
    const categories = opts?.categories ?? CATEGORIES;

    const bindings = unwrap<BindingRow>(
      await db.execute(sql`
        SELECT id::text AS id, table_name, data_category, default_retention_days
          FROM retention_binding
         WHERE is_active
           AND org_id IS NULL
           AND data_category = ANY(${categories}::text[])
         ORDER BY data_category, table_name
      `),
    );

    const perTable: { table: string; rows: number }[] = [];
    const errors: string[] = [];
    let rowsDeleted = 0;

    for (const b of bindings) {
      try {
        // org_id = NULL → über alle Mandanten. Die Altersbedingung
        // bestimmt die Datenbankfunktion, nicht dieser Job.
        const rows = await db.execute(sql`
          SELECT public.retention_purge_table(
            ${b.id}::bigint, NULL::uuid, NULL::int, ${dryRun}
          ) AS n
        `);
        const n = Number(unwrap<{ n: number }>(rows)[0]?.n ?? 0);
        rowsDeleted += n;
        perTable.push({ table: b.table_name, rows: n });
      } catch (err) {
        errors.push(
          `${b.table_name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `retention-access-logs: ${errors.length} table(s) failed — ${errors.join("; ")}`,
      );
    }

    return { bindings: bindings.length, rowsDeleted, perTable, dryRun };
  },
);
