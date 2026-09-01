// Cron Job: Document Retention Purge (DMS Paket D3)
//
// Hard-deletes documents whose retention deadline has passed:
//   retention_until < now AND legal_hold = false AND
//   status IN ('archived', 'expired')
// (selection rule shared with the unit tests via @grc/shared
// isRetentionPurgeEligible).
//
// Order of operations per document:
//   1. audit_log entry (BEFORE deletion, so the purge is traceable)
//   2. DB hard delete — document row; versions, acknowledgments,
//      entity links, approval steps and file rows go via FK cascade
//   3. physical files via the FileStorage abstraction (after commit —
//      a failed delete must not resurrect the DB rows). Local FS or
//      S3, depending on STORAGE_BACKEND (keys = file_path column).

import { db, document, documentFile } from "@grc/db";
import { and, isNotNull, inArray, eq, sql } from "drizzle-orm";
import { isRetentionPurgeEligible } from "@grc/shared";
import { getFileStorage } from "@grc/shared/lib/file-storage";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface DocumentRetentionPurgeResult {
  scanned: number;
  purged: number;
  filesDeleted: number;
  filesFailed: number;
  auditEntriesRedacted: number;
  redactionFailures: number;
  purgeFailures: number;
}

export const processDocumentRetentionPurge = withCronInstrumentation(
  "document-retention-purge",
  async (): Promise<DocumentRetentionPurgeResult> => {
    const now = new Date();
    let purged = 0;
    let filesDeleted = 0;
    let filesFailed = 0;
    let auditEntriesRedacted = 0;
    let redactionFailures = 0;
    let purgeFailures = 0;

    const candidates = await db
      .select()
      .from(document)
      .where(
        and(
          isNotNull(document.retentionUntil),
          eq(document.legalHold, false),
          inArray(document.status, ["archived", "expired"]),
          sql`${document.retentionUntil} < NOW()`,
        ),
      );

    for (const doc of candidates) {
      // Defense in depth: re-check the shared eligibility rule in JS
      // so the SQL filter and the tested logic can never drift apart.
      if (
        !isRetentionPurgeEligible(
          {
            retentionUntil: doc.retentionUntil,
            legalHold: doc.legalHold,
            status: doc.status,
          },
          now,
        )
      ) {
        continue;
      }

      try {
        // Collect physical file paths before the rows disappear
        const fileRows = await db
          .select({ filePath: documentFile.filePath })
          .from(documentFile)
          .where(
            and(
              eq(documentFile.documentId, doc.id),
              eq(documentFile.orgId, doc.orgId),
            ),
          );
        const filePaths = new Set<string>(fileRows.map((f) => f.filePath));
        if (doc.filePath) filePaths.add(doc.filePath);

        await db.transaction(async (tx) => {
          // 1. Audit-log entry BEFORE deletion.
          //
          // [ARCTOS-FULL-2026-08-31 / WP4 · S03-05 — audit call only;
          //  this cron belongs to WP7/WP8]
          // The comment that used to stand here said the chain was
          // "assigned by DB defaults + triggers". It was not: audit_log
          // carried exactly one trigger, a BEFORE UPDATE guard, and the
          // column defaults left entry_hash NULL, previous_hash_scope
          // NULL and hash_version 1. Every hard-deleted document's
          // retention record therefore sat outside the hash chain and
          // outside the external anchor — the record of what was deleted
          // was the least protected record in the system.
          //
          // Migration 0401 makes the comment true: audit_log now carries
          // a BEFORE INSERT trigger that assigns scope, previous_hash,
          // the content commitment and entry_hash for every insert,
          // whatever wrote it.
          //
          // [WP8 · S07-15] Zwei Änderungen an genau dieser Anweisung:
          //
          //  (a) `purgedFiles` — die Dateipfade, die den ursprünglichen
          //      DATEINAMEN enthalten — standen in `metadata`. `metadata`
          //      ist unter v4 eine direkte Eingabe von
          //      `compute_audit_hash_v4()` und damit die einzige
          //      PII-tragende Spalte, die eine spätere Art.-17-Redaktion
          //      NICHT anfassen kann, ohne die Kette zu brechen. Sie
          //      wandern nach `changes`, das über das Content-Commitment
          //      geht und redigierbar ist. In `metadata` bleiben nur
          //      Zählwerte.
          //
          //  (b) `entity_title` trug den Dokumenttitel (bei einem
          //      Personaldokument regelmäßig ein Klarname). Die Spalte ist
          //      seit Migration 0428 redigierbar; der Titel bleibt hier
          //      stehen, weil die Löschung ohne ihn nicht nachvollziehbar
          //      wäre, und wird unten zusammen mit dem Rest tombstoniert,
          //      sobald die Aufbewahrung des NACHWEISES abgelaufen ist.
          await tx.execute(sql`
            INSERT INTO audit_log
              (org_id, user_id, user_email, user_name,
               entity_type, entity_id, entity_title,
               action, action_detail, changes, metadata)
            VALUES
              (${doc.orgId}, NULL, NULL, 'system:document-retention-purge',
               'document', ${doc.id}, ${doc.title},
               'delete', 'retention_purge',
               ${JSON.stringify({
                 purged: {
                   title: doc.title,
                   files: [...filePaths],
                 },
               })}::jsonb,
               ${JSON.stringify({
                 reason: "Retention period elapsed",
                 retentionUntil: doc.retentionUntil,
                 retentionPolicyId: doc.retentionPolicyId,
                 status: doc.status,
                 currentVersion: doc.currentVersion,
                 purgedFileCount: filePaths.size,
               })}::jsonb)
          `);

          // 2. Hard delete (versions/acks/links/steps/files cascade)
          await tx.execute(sql`
            SELECT set_config('app.current_org_id', ${doc.orgId}, true)
          `);
          await tx.delete(document).where(eq(document.id, doc.id));

          if (doc.workItemId) {
            await tx.execute(sql`
              UPDATE work_item
              SET deleted_at = NOW(), updated_at = NOW()
              WHERE id = ${doc.workItemId} AND deleted_at IS NULL
            `);
          }
        });

        purged++;

        // 3. [WP8 · S07-15] Der Zielkonflikt in seiner allgemeinen Form:
        //    das DELETE auf `document` erzeugt über den generischen
        //    `audit_trigger` eine VOLLSTÄNDIGE Kopie der gelöschten Zeile
        //    in `audit_log.changes` — und dort ist sie append-only. Die
        //    Aufbewahrungsfrist hob sich damit selbst auf: gelöscht war
        //    nur die Originalzeile, der Inhalt blieb.
        //
        //    Auflösung: der Audit-Trail behält, DASS und WANN gelöscht
        //    wurde (Zeile, Zeitpunkt, Aktion, Kettenposition bleiben
        //    unverändert), der INHALT wird redigiert. Das Content-
        //    Commitment aus WP4 bleibt erhalten, die Kette verifiziert
        //    danach weiter. `tombstone_audit_entries_for_entity` ist der
        //    Mengen-Einstiegspunkt aus Migration 0428.
        try {
          const redacted = await db.execute(sql`
            SELECT public.tombstone_audit_entries_for_entity(
              ${doc.orgId}::uuid, 'document', ${doc.id}::uuid, 'retention_purge'
            ) AS n
          `);
          const list = (
            Array.isArray(redacted)
              ? redacted
              : ((redacted as unknown as { rows?: unknown[] }).rows ?? [])
          ) as { n: number }[];
          auditEntriesRedacted += Number(list[0]?.n ?? 0);
        } catch (err) {
          console.error(
            "[document-retention-purge] audit redaction failed for",
            doc.id,
            err instanceof Error ? err.message : String(err),
          );
          redactionFailures++;
        }

        // 4. Physical files (best effort, after commit)
        const storage = getFileStorage();
        for (const relPath of filePaths) {
          try {
            if (await storage.delete(relPath)) {
              filesDeleted++;
            }
          } catch (err) {
            // #WP8-S07-15 (Nebenbefund): der leere `catch` liess eine
            // Datei zurück, die nach dem Verschwinden der DB-Zeile weder
            // auffindbar noch löschbar ist — eine Datei ohne Eigentümer
            // und ohne Löschpfad. Sie wird jetzt gezählt und gemeldet.
            filesFailed++;
            console.error(
              "[document-retention-purge] file could not be deleted:",
              relPath,
              err instanceof Error ? err.message : String(err),
            );
          }
        }
      } catch (err) {
        // #WP8 (S10-11-Klasse): der leere `catch` liess einen
        // fehlgeschlagenen Purge als Erfolg durchgehen. Der Lauf zählt
        // ihn jetzt und meldet ihn am Ende.
        purgeFailures++;
        console.error(
          "[document-retention-purge] purge failed for",
          doc.id,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    if (purgeFailures > 0 || filesFailed > 0) {
      console.error(
        `[document-retention-purge] ${purgeFailures} purge failure(s), ` +
          `${filesFailed} file(s) left behind in object storage`,
      );
    }

    if (redactionFailures > 0) {
      // Eine nicht redigierte Kopie ist eine nicht vollzogene Löschung.
      throw new Error(
        `document-retention-purge: ${redactionFailures} document(s) purged but their audit copies could not be redacted`,
      );
    }

    return {
      scanned: candidates.length,
      purged,
      filesDeleted,
      filesFailed,
      auditEntriesRedacted,
      redactionFailures,
      purgeFailures,
    };
  },
);
