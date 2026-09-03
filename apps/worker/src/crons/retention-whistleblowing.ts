// Retention: Hinweisgeber-Dokumentation (HinSchG § 11 Abs. 5)
//
// ── ARCTOS-FULL-2026-08-31 · WP8 · S07-12 (Medium) ───────────────────
//
// Befund: § 11 Abs. 5 HinSchG verlangt die Löschung der Dokumentation
// drei Jahre nach Abschluss des Verfahrens. Die Plattform bot dafür
// weder eine Funktion noch einen Job noch ein Fristfeld. Kein
// Worker-Job berührte Whistleblowing-Daten löschend
// (`wb-deadline-monitor` benachrichtigt nur über Fristen).
// `wb_report.token_expires_at` liess allein den ZUGANGSTOKEN verfallen;
// die Zeile mit `description`, `contact_email`, `ip_hash` und `category`
// blieb unbefristet bestehen, ebenso `wb_case`, `wb_case_message`,
// `wb_case_evidence`, `wb_investigation*`, `wb_interview` und
// `wb_protection_*`.
//
// Dieser Job führt beide Löschpfade aus Migration 0429/0433 aus:
//   * `whistleblowing_retention_purge()`      — abgeschlossene Fälle
//   * `whistleblowing_orphan_report_purge()`  — Meldungen ohne Fall
//
// Mit gelöscht wird die Fallhistorie im vertraulichen
// `whistleblowing_audit_log`. Das ist die bewusste Entscheidung, der
// gesetzlichen Löschpflicht Vorrang vor der Append-only-Eigenschaft des
// Fachlogs zu geben: die Kette wird je `case_id` geführt, die übrigen
// Fälle bleiben also unberührt und verifizierbar. Die Begründung steht
// in docs/compliance/gdpr-erasure-vs-immutability.md.
//
// Die Beweismittel-Dateien im Objektspeicher gehen mit — sonst bliebe
// nach der Löschung des Datenbankeintrags eine Datei zurück, die danach
// weder auffindbar noch löschbar ist (derselbe Defekt, den S07-15 für
// den Dokument-Purge beschreibt).
//
// SCHEDULER: Registrierung in `apps/worker/src/index.ts` (WP9) nötig.
// Empfehlung: täglich 04:00 UTC.

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { getFileStorage } from "@grc/shared/lib/file-storage";
import { withCronInstrumentation } from "../lib/cron-instrument";

import { log } from "../lib/logger";
/** HinSchG § 11 Abs. 5: drei Jahre nach Abschluss des Verfahrens. */
const HINSCHG_RETENTION_DAYS = 1095;

interface WbRetentionResult {
  casesPurged: number;
  rowsPurged: number;
  orphanReportsPurged: number;
  filesDeleted: number;
  filesFailed: number;
  retentionDays: number;
  dryRun: boolean;
}

function unwrap<T>(rows: unknown): T[] {
  return (
    Array.isArray(rows) ? rows : ((rows as { rows?: T[] }).rows ?? [])
  ) as T[];
}

export const processRetentionWhistleblowing = withCronInstrumentation(
  "retention-whistleblowing",
  async (opts?: {
    dryRun?: boolean;
    retentionDays?: number;
    orgId?: string | null;
  }): Promise<WbRetentionResult> => {
    const dryRun = opts?.dryRun === true;
    const retentionDays = opts?.retentionDays ?? HINSCHG_RETENTION_DAYS;
    const orgId = opts?.orgId ?? null;

    // 1. Dateipfade der betroffenen Beweismittel SAMMELN, bevor die
    //    Zeilen verschwinden.
    const cutoffFiles = unwrap<{ storage_path: string }>(
      await db.execute(sql`
        SELECT e.storage_path
          FROM wb_case_evidence e
          JOIN wb_case c ON c.id = e.case_id
         WHERE (${orgId}::uuid IS NULL OR c.org_id = ${orgId}::uuid)
           AND c.closed_at IS NOT NULL
           AND c.closed_at < now() - make_interval(days => ${retentionDays}::int)
           AND e.storage_path IS NOT NULL
      `),
    );

    // 2. Abgeschlossene Fälle
    const caseResult = unwrap<{ cases_purged: number; rows_purged: number }>(
      await db.execute(sql`
        SELECT * FROM public.whistleblowing_retention_purge(
          ${orgId}::uuid, ${retentionDays}::int, ${dryRun}
        )
      `),
    );

    // 3. Meldungen ohne Fall
    const orphanResult = unwrap<{ whistleblowing_orphan_report_purge: number }>(
      await db.execute(sql`
        SELECT public.whistleblowing_orphan_report_purge(
          ${orgId}::uuid, ${retentionDays}::int, ${dryRun}
        )
      `),
    );

    // 4. Dateien — nach dem Commit, best effort, aber gezählt statt
    //    verschluckt.
    let filesDeleted = 0;
    let filesFailed = 0;
    if (!dryRun && cutoffFiles.length > 0) {
      const storage = getFileStorage();
      for (const f of cutoffFiles) {
        try {
          if (await storage.delete(f.storage_path)) filesDeleted++;
        } catch (err) {
          filesFailed++;
          log.error(
            "[retention-whistleblowing] evidence file could not be deleted",
            {
              storagePath: f.storage_path,
              err,
            },
          );
        }
      }
    }

    if (filesFailed > 0) {
      // Eine nicht gelöschte Datei ist eine nicht erfüllte Löschpflicht.
      // Der Lauf meldet das als Fehler, damit es auffällt.
      throw new Error(
        `retention-whistleblowing: ${filesFailed} evidence file(s) could not be deleted from object storage`,
      );
    }

    return {
      casesPurged: Number(caseResult[0]?.cases_purged ?? 0),
      rowsPurged: Number(caseResult[0]?.rows_purged ?? 0),
      orphanReportsPurged: Number(
        orphanResult[0]?.whistleblowing_orphan_report_purge ?? 0,
      ),
      filesDeleted,
      filesFailed,
      retentionDays,
      dryRun,
    };
  },
);
