// Cron Job: Audit-Remediation-Deadline-Monitor
// Overnight-Session Task 10.
//
// Zwei Quellen:
//   1. audit_checklist_item.remediation_deadline — Auditor hat beim
//      Erfassen eine Frist gesetzt (Migration 0290).
//   2. finding.remediation_due_date — explizit angelegtes Finding.
//
// Für jede überfällige oder in ≤7 Tagen fällige Position wird eine
// Notification vom Typ `deadline_approaching` erzeugt. Empfänger ist der
// Lead-Auditor des Audits (bei checklist_item) oder finding.owner_id.
//
// Läuft einmal pro Tag (Default 07:00 UTC, konfigurierbar via Cron).
// ISO 27001 § 10.1 / ISO 9001 § 10.2: Nichtkonformitäten sind zu behandeln
// und der Fortschritt zu überwachen.

import {
  db,
  audit,
  auditChecklist,
  auditChecklistItem,
  finding,
  notification,
} from "@grc/db";
import { and, isNull, isNotNull, lt, eq, inArray, sql } from "drizzle-orm";

interface AuditRemediationResult {
  processed: number;
  notifiedChecklistItems: number;
  notifiedFindings: number;
}

export async function processAuditRemediationDeadlines(): Promise<AuditRemediationResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const warnUpToIso = new Date(Date.now() + 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  console.log(
    `[cron:audit-remediation-deadline-monitor] Starting at ${nowIso}`,
  );

  let notifiedChecklistItems = 0;
  let notifiedFindings = 0;

  // ── 1. Checklist-Items mit überfälliger oder baldiger Frist ──
  const overdueItems = await db
    .select({
      id: auditChecklistItem.id,
      orgId: auditChecklistItem.orgId,
      checklistId: auditChecklistItem.checklistId,
      question: auditChecklistItem.question,
      result: auditChecklistItem.result,
      remediationDeadline: auditChecklistItem.remediationDeadline,
      riskRating: auditChecklistItem.riskRating,
      // Per Checkliste → Audit → Lead-Auditor
      auditId: audit.id,
      auditTitle: audit.title,
      leadAuditorId: audit.leadAuditorId,
    })
    .from(auditChecklistItem)
    .leftJoin(
      auditChecklist,
      eq(auditChecklistItem.checklistId, auditChecklist.id),
    )
    .leftJoin(audit, eq(auditChecklist.auditId, audit.id))
    .where(
      and(
        isNotNull(auditChecklistItem.remediationDeadline),
        lt(auditChecklistItem.remediationDeadline, warnUpToIso),
        inArray(auditChecklistItem.result, [
          "major_nonconformity",
          "minor_nonconformity",
          "nonconforming",
        ]),
        isNull(audit.deletedAt),
      ),
    );

  for (const item of overdueItems) {
    if (!item.leadAuditorId) continue;
    try {
      const daysDiff = item.remediationDeadline
        ? Math.floor(
            (new Date(item.remediationDeadline).getTime() -
              new Date(today).getTime()) /
              86400000,
          )
        : 0;
      const overdue = daysDiff < 0;
      const absDays = Math.abs(daysDiff);
      const questionSnippet =
        item.question.length > 100
          ? item.question.slice(0, 97) + "..."
          : item.question;

      await db.insert(notification).values({
        userId: item.leadAuditorId,
        orgId: item.orgId,
        type: "deadline_approaching" as const,
        entityType: "audit_checklist_item",
        entityId: item.id,
        title: overdue
          ? `Korrektur überfällig: ${absDays} Tag(e)`
          : `Korrektur fällig in ${absDays} Tag(en)`,
        message: `NC-Bewertung in Audit "${item.auditTitle ?? "?"}": ${questionSnippet}`,
        channel: "both" as const,
        templateKey: "audit_remediation_deadline",
        templateData: {
          auditId: item.auditId,
          auditTitle: item.auditTitle,
          checklistItemId: item.id,
          question: item.question,
          result: item.result,
          riskRating: item.riskRating,
          remediationDeadline: item.remediationDeadline,
          daysDiff,
          overdue,
        },
        createdAt: now,
        updatedAt: now,
      });
      notifiedChecklistItems++;
    } catch (err) {
      console.error(
        `[cron:audit-remediation-deadline-monitor] Failed for checklist item ${item.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ── 2. Findings mit überfälliger oder baldiger Frist ──
  const overdueFindings = await db
    .select({
      id: finding.id,
      orgId: finding.orgId,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      ownerId: finding.ownerId,
      remediationDueDate: finding.remediationDueDate,
      auditId: finding.auditId,
    })
    .from(finding)
    .where(
      and(
        isNotNull(finding.remediationDueDate),
        lt(sql`${finding.remediationDueDate}::date`, sql`(CURRENT_DATE + 7)`),
        inArray(finding.status, ["identified", "in_remediation"]),
        isNotNull(finding.ownerId),
        isNull(finding.deletedAt),
      ),
    );

  for (const f of overdueFindings) {
    if (!f.ownerId) continue;
    try {
      const daysDiff = f.remediationDueDate
        ? Math.floor(
            (new Date(f.remediationDueDate).getTime() -
              new Date(today).getTime()) /
              86400000,
          )
        : 0;
      const overdue = daysDiff < 0;
      const absDays = Math.abs(daysDiff);

      await db.insert(notification).values({
        userId: f.ownerId,
        orgId: f.orgId,
        type: "deadline_approaching" as const,
        entityType: "finding",
        entityId: f.id,
        title: overdue
          ? `Finding überfällig: ${absDays} Tag(e)`
          : `Finding-Korrektur fällig in ${absDays} Tag(en)`,
        message: `Finding "${f.title}" (Severity: ${f.severity}) — Frist: ${f.remediationDueDate}`,
        channel: "both" as const,
        templateKey: "audit_finding_deadline",
        templateData: {
          findingId: f.id,
          title: f.title,
          severity: f.severity,
          status: f.status,
          remediationDueDate: f.remediationDueDate,
          daysDiff,
          overdue,
          auditId: f.auditId,
        },
        createdAt: now,
        updatedAt: now,
      });
      notifiedFindings++;
    } catch (err) {
      console.error(
        `[cron:audit-remediation-deadline-monitor] Failed for finding ${f.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[cron:audit-remediation-deadline-monitor] Processed ${overdueItems.length} checklist items + ${overdueFindings.length} findings → ${notifiedChecklistItems} + ${notifiedFindings} notifications created`,
  );

  return {
    processed: overdueItems.length + overdueFindings.length,
    notifiedChecklistItems,
    notifiedFindings,
  };
}
