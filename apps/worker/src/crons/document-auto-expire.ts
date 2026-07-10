// Cron Job: Document Auto-Expire (DMS Paket D2)
//
// Published documents whose expires_at has passed transition
// automatically to 'expired' (matching VALID_DOCUMENT_TRANSITIONS:
// published → expired). The linked work item goes to 'obsolete' (same
// mapping as the manual status route) and the owner is notified.

import { db, document, workItem, notification } from "@grc/db";
import { and, isNull, isNotNull, eq, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface DocumentAutoExpireResult {
  scanned: number;
  expired: number;
  notified: number;
}

export const processDocumentAutoExpire = withCronInstrumentation(
  "document-auto-expire",
  async (): Promise<DocumentAutoExpireResult> => {
    const now = new Date();
    let expired = 0;
    let notified = 0;

    const candidates = await db
      .select({
        id: document.id,
        orgId: document.orgId,
        title: document.title,
        ownerId: document.ownerId,
        workItemId: document.workItemId,
        expiresAt: document.expiresAt,
      })
      .from(document)
      .where(
        and(
          eq(document.status, "published"),
          isNotNull(document.expiresAt),
          isNull(document.deletedAt),
          sql`${document.expiresAt} < NOW()`,
        ),
      );

    for (const doc of candidates) {
      try {
        await db
          .update(document)
          .set({ status: "expired", updatedAt: now })
          .where(and(eq(document.id, doc.id), eq(document.status, "published")));

        if (doc.workItemId) {
          await db
            .update(workItem)
            .set({ status: "obsolete", updatedAt: now })
            .where(eq(workItem.id, doc.workItemId));
        }

        expired++;

        if (doc.ownerId) {
          const expiresStr = doc.expiresAt
            ? new Date(doc.expiresAt).toISOString().split("T")[0]
            : "";
          await db.insert(notification).values({
            userId: doc.ownerId,
            orgId: doc.orgId,
            type: "status_change" as const,
            entityType: "document",
            entityId: doc.id,
            title: `Document expired: ${doc.title}`,
            message: `Document "${doc.title}" reached its expiry date (${expiresStr}) and was automatically set to 'expired'.`,
            channel: "both" as const,
            templateKey: "document_auto_expired",
            templateData: {
              documentId: doc.id,
              documentTitle: doc.title,
              expiresAt: expiresStr,
            },
            createdAt: now,
            updatedAt: now,
          });
          notified++;
        }
      } catch {
        // Wrapper logs structured error; loop continues.
      }
    }

    return { scanned: candidates.length, expired, notified };
  },
);
