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
}

export const processDocumentRetentionPurge = withCronInstrumentation(
  "document-retention-purge",
  async (): Promise<DocumentRetentionPurgeResult> => {
    const now = new Date();
    let purged = 0;
    let filesDeleted = 0;

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
          // 1. Audit-log entry BEFORE deletion (raw SQL — chain_seq /
          //    hash chain are assigned by DB defaults + triggers).
          await tx.execute(sql`
            INSERT INTO audit_log
              (org_id, user_id, user_email, user_name,
               entity_type, entity_id, entity_title,
               action, action_detail, metadata)
            VALUES
              (${doc.orgId}, NULL, NULL, 'system:document-retention-purge',
               'document', ${doc.id}, ${doc.title},
               'delete', 'retention_purge',
               ${JSON.stringify({
                 reason: "Retention period elapsed",
                 retentionUntil: doc.retentionUntil,
                 retentionPolicyId: doc.retentionPolicyId,
                 status: doc.status,
                 currentVersion: doc.currentVersion,
                 purgedFiles: [...filePaths],
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

        // 3. Physical files (best effort, after commit)
        const storage = getFileStorage();
        for (const relPath of filePaths) {
          try {
            if (await storage.delete(relPath)) {
              filesDeleted++;
            }
          } catch {
            // Already gone or not accessible — nothing to do.
          }
        }
      } catch {
        // Wrapper logs structured error; loop continues.
      }
    }

    return { scanned: candidates.length, purged, filesDeleted };
  },
);
