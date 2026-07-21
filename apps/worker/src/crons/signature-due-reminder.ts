// Cron Job: Signature Due Reminders + Overdue Escalation
// (W21-DMS-MULTISIGN-02, follow-up to the multi-signer workflow 0375)
//
// Pattern lineage: document-review-reminder.ts — staged reminders that
// fire once per stage, anchored on last_reminder_sent_at (migration 0376,
// @grc/shared shouldSendSignatureDueReminder). Two responsibilities:
//
//   (a) Reminders for pending signature requests with a due date:
//       stages 3 days before and on the due date. Recipients are the
//       signers whose slot is still 'pending' — for sequential requests
//       only the signer whose turn it is (lowest pending sign_order).
//   (b) One-time escalation when the request is overdue by more than
//       3 days (escalated_at marker): notify the request creator and
//       the document owner ("n of m signatures pending").
//
// Deliberately NO auto-cancel of overdue requests — the decision stays
// with the creator (cancel route POST /signature-requests/:id/cancel).

import {
  db,
  document,
  documentSignature,
  documentSignatureRequest,
  notification,
} from "@grc/db";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import {
  daysBetween,
  shouldSendSignatureDueReminder,
  shouldEscalateSignatureRequest,
} from "@grc/shared";
import { withCronInstrumentation } from "../lib/cron-instrument";

export interface SignerSlot {
  signerUserId: string;
  signOrder: number;
  status: "pending" | "signed" | "declined";
}

/**
 * Pure: which signers receive a due-date reminder.
 * Sequential ceremony → only the pending slot with the lowest
 * sign_order (it is exactly that signer's turn — everyone after them
 * cannot act yet, matching the notification behavior of the
 * signature provider on create/sign).
 */
export function selectReminderRecipients(
  slots: SignerSlot[],
  sequential: boolean,
): string[] {
  const pending = slots
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.signOrder - b.signOrder);
  if (pending.length === 0) return [];
  if (sequential) return [pending[0].signerUserId];
  return [...new Set(pending.map((s) => s.signerUserId))];
}

interface SignatureDueReminderResult {
  scanned: number;
  remindersSent: number;
  escalated: number;
  notified: number;
}

export const processSignatureDueReminders = withCronInstrumentation(
  "signature-due-reminder",
  async (): Promise<SignatureDueReminderResult> => {
    const now = new Date();
    let remindersSent = 0;
    let escalated = 0;
    let notified = 0;

    // Pending requests whose due date is within 3 days or already past.
    const candidates = await db
      .select({
        id: documentSignatureRequest.id,
        orgId: documentSignatureRequest.orgId,
        documentId: documentSignatureRequest.documentId,
        title: documentSignatureRequest.title,
        sequential: documentSignatureRequest.sequential,
        dueDate: documentSignatureRequest.dueDate,
        createdBy: documentSignatureRequest.createdBy,
        lastReminderSentAt: documentSignatureRequest.lastReminderSentAt,
        escalatedAt: documentSignatureRequest.escalatedAt,
      })
      .from(documentSignatureRequest)
      .where(
        and(
          eq(documentSignatureRequest.status, "pending"),
          isNotNull(documentSignatureRequest.dueDate),
          sql`${documentSignatureRequest.dueDate} <= NOW() + INTERVAL '3 days'`,
        ),
      );

    for (const req of candidates) {
      try {
        const dueDate = new Date(req.dueDate as unknown as string | Date);

        const slots: SignerSlot[] = await db
          .select({
            signerUserId: documentSignature.signerUserId,
            signOrder: documentSignature.signOrder,
            status: documentSignature.status,
          })
          .from(documentSignature)
          .where(eq(documentSignature.requestId, req.id))
          .orderBy(asc(documentSignature.signOrder));

        const pendingCount = slots.filter((s) => s.status === "pending").length;
        // Fully decided requests are closed by the sign/decline routes;
        // a still-'pending' request without pending slots is transient.
        if (pendingCount === 0) continue;

        const dueDateStr = dueDate.toISOString().split("T")[0];
        const daysUntilDue = daysBetween(now, dueDate);
        const isOverdue = daysUntilDue <= 0;

        // (a) Staged reminder to the pending signers (once per stage).
        if (
          shouldSendSignatureDueReminder({
            dueDate,
            lastReminderSentAt: req.lastReminderSentAt
              ? new Date(req.lastReminderSentAt)
              : null,
            now,
          })
        ) {
          const recipients = selectReminderRecipients(slots, req.sequential);
          for (const recipientId of recipients) {
            await db.insert(notification).values({
              userId: recipientId,
              orgId: req.orgId,
              type: isOverdue
                ? ("escalation" as const)
                : ("deadline_approaching" as const),
              entityType: "document",
              entityId: req.documentId,
              title: isOverdue
                ? `Signature overdue: ${req.title}`
                : `Signature due in ${daysUntilDue} day(s): ${req.title}`,
              message: `Your signature on '${req.title}' is due on ${dueDateStr}${isOverdue ? " (overdue)" : ""}.`,
              channel: "both" as const,
              templateKey: isOverdue
                ? "document_signature_overdue"
                : "document_signature_due_reminder",
              templateData: {
                requestId: req.id,
                documentId: req.documentId,
                documentTitle: req.title,
                dueDate: dueDateStr,
                daysUntilDue,
              },
              createdAt: now,
              updatedAt: now,
            });
            notified++;
          }
          if (recipients.length > 0) {
            await db
              .update(documentSignatureRequest)
              .set({ lastReminderSentAt: now, updatedAt: now })
              .where(eq(documentSignatureRequest.id, req.id));
            remindersSent++;
          }
        }

        // (b) One-time escalation to creator + document owner when the
        // request is overdue by more than 3 days. No auto-cancel.
        if (
          shouldEscalateSignatureRequest({
            dueDate,
            escalatedAt: req.escalatedAt ? new Date(req.escalatedAt) : null,
            now,
          })
        ) {
          const [doc] = await db
            .select({ ownerId: document.ownerId })
            .from(document)
            .where(eq(document.id, req.documentId));

          const escalationRecipients = [
            ...new Set(
              [req.createdBy, doc?.ownerId ?? null].filter((v): v is string =>
                Boolean(v),
              ),
            ),
          ];
          for (const recipientId of escalationRecipients) {
            await db.insert(notification).values({
              userId: recipientId,
              orgId: req.orgId,
              type: "escalation" as const,
              entityType: "document",
              entityId: req.documentId,
              title: `Signature request overdue: ${req.title}`,
              message: `Signature request '${req.title}' was due on ${dueDateStr} — ${pendingCount} of ${slots.length} signature(s) still pending. The request is not cancelled automatically; please follow up with the signers or cancel it.`,
              channel: "both" as const,
              templateKey: "document_signature_escalation",
              templateData: {
                requestId: req.id,
                documentId: req.documentId,
                documentTitle: req.title,
                dueDate: dueDateStr,
                pendingCount,
                totalCount: slots.length,
              },
              createdAt: now,
              updatedAt: now,
            });
            notified++;
          }

          await db
            .update(documentSignatureRequest)
            .set({ escalatedAt: now, updatedAt: now })
            .where(eq(documentSignatureRequest.id, req.id));
          escalated++;
        }
      } catch {
        // Wrapper logs structured error; loop continues to next request.
      }
    }

    return { scanned: candidates.length, remindersSent, escalated, notified };
  },
);
