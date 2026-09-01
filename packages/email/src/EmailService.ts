import { Resend } from "resend";
import * as React from "react";
import type { EmailParams, EmailResult, EmailTemplateKey } from "./types";
import {
  TaskAssigned,
  getSubject as taskAssignedSubject,
} from "./templates/TaskAssigned";
import {
  TaskOverdue,
  getSubject as taskOverdueSubject,
} from "./templates/TaskOverdue";
import {
  TaskReminder,
  getSubject as taskReminderSubject,
} from "./templates/TaskReminder";
import {
  UserInvited,
  getSubject as userInvitedSubject,
} from "./templates/UserInvited";
import {
  NotificationDigest,
  getSubject as notificationDigestSubject,
} from "./templates/NotificationDigest";
import {
  DataBreach72hWarning,
  getSubject as dataBreach72hWarningSubject,
} from "./templates/DataBreach72hWarning";
import {
  DataBreach72hOverdue,
  getSubject as dataBreach72hOverdueSubject,
} from "./templates/DataBreach72hOverdue";
import {
  DataBreachIndividualNotification,
  getSubject as dataBreachIndividualNotificationSubject,
} from "./templates/DataBreachIndividualNotification";
import {
  DsrReceived,
  getSubject as dsrReceivedSubject,
} from "./templates/DsrReceived";
import {
  DsrDeadlineWarning,
  getSubject as dsrDeadlineWarningSubject,
} from "./templates/DsrDeadlineWarning";
import {
  DsrCompleted,
  getSubject as dsrCompletedSubject,
} from "./templates/DsrCompleted";
import {
  RopaReviewDue,
  getSubject as ropaReviewDueSubject,
} from "./templates/RopaReviewDue";
import {
  DpiaRequired,
  getSubject as dpiaRequiredSubject,
} from "./templates/DpiaRequired";
import {
  CrisisActivated,
  getSubject as crisisActivatedSubject,
} from "./templates/CrisisActivated";
import {
  CrisisResolved,
  getSubject as crisisResolvedSubject,
} from "./templates/CrisisResolved";
import {
  BcpReviewDue,
  getSubject as bcpReviewDueSubject,
} from "./templates/BcpReviewDue";
import {
  ExerciseReminder,
  getSubject as exerciseReminderSubject,
} from "./templates/ExerciseReminder";
import {
  BiaOverdue,
  getSubject as biaOverdueSubject,
} from "./templates/BiaOverdue";
import {
  AuditPlanApproved,
  getSubject as auditPlanApprovedSubject,
} from "./templates/AuditPlanApproved";
import {
  AuditFindingAssigned,
  getSubject as auditFindingAssignedSubject,
} from "./templates/AuditFindingAssigned";
import {
  AuditScheduled,
  getSubject as auditScheduledSubject,
} from "./templates/AuditScheduled";
import {
  VendorDdQuestionnaire,
  getSubject as vendorDdQuestionnaireSubject,
} from "./templates/VendorDdQuestionnaire";
import {
  ContractExpiryNotice,
  getSubject as contractExpiryNoticeSubject,
} from "./templates/ContractExpiryNotice";
import {
  SlaBreachAlert,
  getSubject as slaBreachAlertSubject,
} from "./templates/SlaBreachAlert";
import {
  VendorReassessmentDue,
  getSubject as vendorReassessmentDueSubject,
} from "./templates/VendorReassessmentDue";
// [WP9 · S10-03] Shared renderer for the 65 keys that had no template.
import {
  GenericNotification,
  getSubject as genericNotificationSubject,
} from "./templates/GenericNotification";
import {
  GENERIC_TEMPLATES,
  isGenericTemplateKey,
  type GenericTemplateKey,
} from "./template-registry";
import { EmailDeliveryError } from "./types";

interface RenderedTemplate {
  subject: string;
  component: React.ReactElement;
}

/**
 * [WP9 · S10-24] Keep the diagnostic value of the log line (which domain,
 * which template) without writing the personal data itself to stdout.
 */
function redactEmail(address: string): string {
  const at = address.lastIndexOf("@");
  if (at <= 0) return "<redacted>";
  const local = address.slice(0, at);
  return `${local.slice(0, 1)}***@${address.slice(at + 1)}`;
}

const RETRY_DELAYS = [1_000, 5_000, 30_000];
const MAX_ATTEMPTS = 3;

export class EmailService {
  private _resend: Resend | null = null;

  private get resend(): Resend {
    if (!this._resend) {
      const key = process.env.RESEND_API_KEY;
      if (!key || key === "re_test_placeholder") {
        // Return a dummy Resend instance that won't be used (send() checks EMAIL_ENABLED)
        this._resend = new Resend("re_dummy_key_for_dev");
      } else {
        this._resend = new Resend(key);
      }
    }
    return this._resend;
  }

  constructor(_apiKey?: string) {
    // Lazy init — Resend client created on first use, not at import time
    if (_apiKey) {
      this._resend = new Resend(_apiKey);
    }
  }

  /**
   * Send a transactional email via Resend.
   *
   * Contract (tightened for S10-04):
   *   * returns `{ messageId }` ONLY when the provider accepted the message
   *     and gave us an id;
   *   * returns `null` when e-mail delivery is switched off — this means
   *     "NOT sent", and callers must not record a delivery timestamp;
   *   * THROWS `EmailDeliveryError` on any provider or network failure,
   *     after up to 3 attempts with backoff.
   *
   * Callers that recorded `emailSentAt` for a `null` result were the second
   * half of the defect: with the compose default `EMAIL_ENABLED=false`, the
   * platform marked every notification as delivered without sending
   * anything, and `isNull(emailSentAt)` then excluded those rows forever.
   */
  async send(params: EmailParams): Promise<EmailResult | null> {
    if (process.env.EMAIL_ENABLED !== "true") {
      // [S10-24] The recipient address is personal data and this is the
      // DEFAULT path in production (`EMAIL_ENABLED:-false`), so it used to
      // write every recipient to stdout, from where ADR-017 phase 2 ships
      // logs to a third party. The template key and the domain are enough
      // to diagnose a misconfiguration.
      console.log(
        `[EmailService] disabled, skipping: ${params.templateKey} -> ${redactEmail(params.to)}`,
      );
      return null;
    }

    const template = this.renderTemplate(
      params.templateKey,
      params.data,
      params.lang,
    );

    const fromName = process.env.RESEND_FROM_NAME || "ARCTOS GRC Platform";
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@arctos.cws.de";
    const from = `${fromName} <${fromEmail}>`;

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.resend.emails.send({
          from,
          to: params.to,
          subject: template.subject,
          react: template.component,
        });

        // [S10-04 A] The SDK reports failures as a RETURN VALUE, never as a
        // thrown error. Without this branch a 422 ("domain not verified"),
        // a 429, a 401 or a DNS outage all produced `{ messageId: "" }` and
        // were counted as delivered.
        const providerError = (
          (result ?? {}) as {
            error?: { name?: string; message?: string } | null;
          }
        ).error;
        if (providerError) {
          throw new EmailDeliveryError(
            `Resend rejected the message: ${providerError.message ?? providerError.name ?? "unknown error"}`,
            providerError.name,
          );
        }
        const messageId = result?.data?.id;
        if (!messageId) {
          throw new EmailDeliveryError(
            "Resend returned neither a message id nor an error — treating as not delivered",
          );
        }
        return { messageId };
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS - 1) {
          await this.delay(RETRY_DELAYS[attempt]);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new EmailDeliveryError(String(lastError));
  }

  /**
   * Map a template key + data + lang to a rendered React Email component and subject line.
   */
  renderTemplate(
    key: EmailTemplateKey,
    data: Record<string, unknown>,
    lang: "de" | "en",
  ): RenderedTemplate {
    switch (key) {
      case "task_assigned":
        return {
          subject: taskAssignedSubject(data, lang),
          component: React.createElement(TaskAssigned, {
            lang,
            taskTitle: (data.taskTitle as string) || "",
            taskDescription: data.taskDescription as string | undefined,
            assigneeName: (data.assigneeName as string) || "",
            dueDate: (data.dueDate as string) || "",
            priority: (data.priority as string) || "medium",
            taskUrl: (data.taskUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "task_overdue":
        return {
          subject: taskOverdueSubject(data, lang),
          component: React.createElement(TaskOverdue, {
            lang,
            taskTitle: (data.taskTitle as string) || "",
            dueDate: (data.dueDate as string) || "",
            daysOverdue: (data.daysOverdue as number) || 0,
            taskUrl: (data.taskUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "task_reminder":
        return {
          subject: taskReminderSubject(data, lang),
          component: React.createElement(TaskReminder, {
            lang,
            taskTitle: (data.taskTitle as string) || "",
            dueDate: (data.dueDate as string) || "",
            customMessage: data.customMessage as string | undefined,
            taskUrl: (data.taskUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "user_invited":
        return {
          subject: userInvitedSubject(data, lang),
          component: React.createElement(UserInvited, {
            lang,
            orgName: (data.orgName as string) || "",
            roleName: (data.roleName as string) || "",
            inviterName: (data.inviterName as string) || "",
            acceptUrl: (data.acceptUrl as string) || "",
          }),
        };

      case "notification_digest":
        return {
          subject: notificationDigestSubject(data, lang),
          component: React.createElement(NotificationDigest, {
            lang,
            notifications:
              (data.notifications as Array<{
                type: string;
                title: string;
                timestamp: string;
                url?: string;
              }>) || [],
            platformUrl: (data.platformUrl as string) || "",
            orgName: data.orgName as string | undefined,
            digestDate: (data.digestDate as string) || "",
          }),
        };

      case "dpo_assigned":
        // Reuses user_invited template structure with DPO-specific subject
        return {
          subject:
            lang === "de" ? "DPO-Zuweisung: ARCTOS" : "DPO Assignment: ARCTOS",
          component: React.createElement(UserInvited, {
            lang,
            orgName: (data.orgName as string) || "",
            roleName: "dpo",
            inviterName: (data.assignedBy as string) || "",
            acceptUrl: (data.platformUrl as string) || "",
          }),
        };

      case "risk_owner_assigned":
        // Reuses task_assigned template structure with risk-specific subject
        return {
          subject:
            lang === "de"
              ? `Risiko zugewiesen: ${(data.riskTitle as string) || ""}`
              : `Risk assigned: ${(data.riskTitle as string) || ""}`,
          component: React.createElement(TaskAssigned, {
            lang,
            taskTitle: (data.riskTitle as string) || "",
            taskDescription: data.riskDescription as string | undefined,
            assigneeName: (data.assigneeName as string) || "",
            dueDate: (data.dueDate as string) || "",
            priority: (data.priority as string) || "medium",
            taskUrl: (data.riskUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "data_breach_72h_warning":
        return {
          subject: dataBreach72hWarningSubject(data, lang),
          component: React.createElement(DataBreach72hWarning, {
            lang,
            breachTitle: (data.breachTitle as string) || "",
            detectedAt: (data.detectedAt as string) || "",
            deadlineAt: (data.deadlineAt as string) || "",
            hoursRemaining: (data.hoursRemaining as number) || 0,
            affectedRecords: data.affectedRecords as number | undefined,
            recipientName: (data.recipientName as string) || "",
            breachUrl: (data.breachUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "data_breach_72h_overdue":
        return {
          subject: dataBreach72hOverdueSubject(data, lang),
          component: React.createElement(DataBreach72hOverdue, {
            lang,
            breachTitle: (data.breachTitle as string) || "",
            detectedAt: (data.detectedAt as string) || "",
            deadlineAt: (data.deadlineAt as string) || "",
            hoursOverdue: (data.hoursOverdue as number) || 0,
            recipientName: (data.recipientName as string) || "",
            breachUrl: (data.breachUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "data_breach_individual_notification":
        return {
          subject: dataBreachIndividualNotificationSubject(data, lang),
          component: React.createElement(DataBreachIndividualNotification, {
            lang,
            breachTitle: (data.breachTitle as string) || "",
            orgName: (data.orgName as string) || "",
            whatHappened: (data.whatHappened as string) || "",
            dataAffected: (data.dataAffected as string) || "",
            measuresTaken: (data.measuresTaken as string) || "",
            contactInfo: (data.contactInfo as string) || "",
          }),
        };

      case "dsr_received":
        return {
          subject: dsrReceivedSubject(data, lang),
          component: React.createElement(DsrReceived, {
            lang,
            dsrType: (data.dsrType as string) || "",
            dsrId: (data.dsrId as string) || "",
            dataSubjectName: (data.dataSubjectName as string) || "",
            receivedAt: (data.receivedAt as string) || "",
            deadlineAt: (data.deadlineAt as string) || "",
            handlerName: (data.handlerName as string) || "",
            dsrUrl: (data.dsrUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "dsr_deadline_warning":
        return {
          subject: dsrDeadlineWarningSubject(data, lang),
          component: React.createElement(DsrDeadlineWarning, {
            lang,
            dsrId: (data.dsrId as string) || "",
            dsrType: (data.dsrType as string) || "",
            daysRemaining: (data.daysRemaining as number) || 0,
            deadlineAt: (data.deadlineAt as string) || "",
            handlerName: (data.handlerName as string) || "",
            dsrUrl: (data.dsrUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "dsr_completed":
        return {
          subject: dsrCompletedSubject(data, lang),
          component: React.createElement(DsrCompleted, {
            lang,
            dsrId: (data.dsrId as string) || "",
            dsrType: (data.dsrType as string) || "",
            completedAt: (data.completedAt as string) || "",
            dataSubjectEmail: (data.dataSubjectEmail as string) || "",
            dsrUrl: (data.dsrUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "ropa_review_due":
        return {
          subject: ropaReviewDueSubject(data, lang),
          component: React.createElement(RopaReviewDue, {
            lang,
            ropaTitle: (data.ropaTitle as string) || "",
            lastReviewed: (data.lastReviewed as string) || "",
            recipientName: (data.recipientName as string) || "",
            ropaUrl: (data.ropaUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "dpia_required":
        return {
          subject: dpiaRequiredSubject(data, lang),
          component: React.createElement(DpiaRequired, {
            lang,
            processingName: (data.processingName as string) || "",
            triggerCriteria: (data.triggerCriteria as string[]) || [],
            recipientName: (data.recipientName as string) || "",
            dpiaUrl: (data.dpiaUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "crisis_activated":
        return {
          subject: crisisActivatedSubject(data, lang),
          component: React.createElement(CrisisActivated, {
            lang,
            crisisName: (data.crisisName as string) || "",
            severity: (data.severity as string) || "",
            activatedAt: (data.activatedAt as string) || "",
            activatedBy: (data.activatedBy as string) || "",
            teamRole: (data.teamRole as string) || "",
            recipientName: (data.recipientName as string) || "",
            crisisUrl: (data.crisisUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "crisis_resolved":
        return {
          subject: crisisResolvedSubject(data, lang),
          component: React.createElement(CrisisResolved, {
            lang,
            crisisName: (data.crisisName as string) || "",
            resolvedAt: (data.resolvedAt as string) || "",
            duration: (data.duration as string) || "",
            recipientName: (data.recipientName as string) || "",
            crisisUrl: (data.crisisUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "bcp_review_due":
        return {
          subject: bcpReviewDueSubject(data, lang),
          component: React.createElement(BcpReviewDue, {
            lang,
            bcpTitle: (data.bcpTitle as string) || "",
            lastReviewed: (data.lastReviewed as string) || "",
            nextReviewDate: (data.nextReviewDate as string) || "",
            recipientName: (data.recipientName as string) || "",
            bcpUrl: (data.bcpUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "exercise_reminder":
        return {
          subject: exerciseReminderSubject(data, lang),
          component: React.createElement(ExerciseReminder, {
            lang,
            exerciseTitle: (data.exerciseTitle as string) || "",
            exerciseType: (data.exerciseType as string) || "",
            plannedDate: (data.plannedDate as string) || "",
            recipientName: (data.recipientName as string) || "",
            exerciseUrl: (data.exerciseUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "bia_overdue":
        return {
          subject: biaOverdueSubject(data, lang),
          component: React.createElement(BiaOverdue, {
            lang,
            processName: (data.processName as string) || "",
            biaName: (data.biaName as string) || "",
            recipientName: (data.recipientName as string) || "",
            biaUrl: (data.biaUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "audit_plan_approved":
        return {
          subject: auditPlanApprovedSubject(data, lang),
          component: React.createElement(AuditPlanApproved, {
            lang,
            planName: (data.planName as string) || "",
            year: (data.year as string) || "",
            auditCount: (data.auditCount as number) || 0,
            approvedBy: (data.approvedBy as string) || "",
            recipientName: (data.recipientName as string) || "",
            planUrl: (data.planUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "audit_finding_assigned":
        return {
          subject: auditFindingAssignedSubject(data, lang),
          component: React.createElement(AuditFindingAssigned, {
            lang,
            findingTitle: (data.findingTitle as string) || "",
            findingId: (data.findingId as string) || "",
            severity: (data.severity as string) || "",
            auditName: (data.auditName as string) || "",
            dueDate: (data.dueDate as string) || "",
            recipientName: (data.recipientName as string) || "",
            findingUrl: (data.findingUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "audit_scheduled":
        return {
          subject: auditScheduledSubject(data, lang),
          component: React.createElement(AuditScheduled, {
            lang,
            auditName: (data.auditName as string) || "",
            auditType: (data.auditType as string) || "",
            plannedStart: (data.plannedStart as string) || "",
            plannedEnd: (data.plannedEnd as string) || "",
            leadAuditor: (data.leadAuditor as string) || "",
            recipientName: (data.recipientName as string) || "",
            auditUrl: (data.auditUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "vendor_dd_questionnaire":
        return {
          subject: vendorDdQuestionnaireSubject(data, lang),
          component: React.createElement(VendorDdQuestionnaire, {
            lang,
            vendorName: (data.vendorName as string) || "",
            requestingOrgName: (data.requestingOrgName as string) || "",
            deadline: (data.deadline as string) || "",
            questionnaireUrl: (data.questionnaireUrl as string) || "",
            contactEmail: (data.contactEmail as string) || "",
          }),
        };

      case "contract_expiry_notice":
        return {
          subject: contractExpiryNoticeSubject(data, lang),
          component: React.createElement(ContractExpiryNotice, {
            lang,
            contractTitle: (data.contractTitle as string) || "",
            vendorName: (data.vendorName as string) || "",
            expirationDate: (data.expirationDate as string) || "",
            daysRemaining: (data.daysRemaining as number) || 0,
            noticePeriodDays: (data.noticePeriodDays as number) || 0,
            totalValue: (data.totalValue as string) || "",
            recipientName: (data.recipientName as string) || "",
            contractUrl: (data.contractUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "sla_breach_alert":
        return {
          subject: slaBreachAlertSubject(data, lang),
          component: React.createElement(SlaBreachAlert, {
            lang,
            contractTitle: (data.contractTitle as string) || "",
            vendorName: (data.vendorName as string) || "",
            metricName: (data.metricName as string) || "",
            targetValue: (data.targetValue as string) || "",
            actualValue: (data.actualValue as string) || "",
            unit: (data.unit as string) || "",
            measurementPeriod: (data.measurementPeriod as string) || "",
            recipientName: (data.recipientName as string) || "",
            contractUrl: (data.contractUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      case "vendor_reassessment_due":
        return {
          subject: vendorReassessmentDueSubject(data, lang),
          component: React.createElement(VendorReassessmentDue, {
            lang,
            vendorName: (data.vendorName as string) || "",
            tier: (data.tier as string) || "",
            lastAssessment: (data.lastAssessment as string) || "",
            nextAssessment: (data.nextAssessment as string) || "",
            daysOverdue: data.daysOverdue as number | undefined,
            recipientName: (data.recipientName as string) || "",
            vendorUrl: (data.vendorUrl as string) || "",
            orgName: data.orgName as string | undefined,
          }),
        };

      // [WP9 · S10-03] Every remaining registry key renders through the
      // shared layout. Before this arm existed, 36 of the 38 keys the crons
      // actually wrote fell into `default: throw` — the mail was retried
      // three times and then permanently excluded by `retry_count < 3`.
      default: {
        if (!isGenericTemplateKey(key)) {
          // Unreachable for a key from the registry; kept as a real guard
          // because `notification.template_key` is a varchar column and a
          // stale row can still carry an obsolete value.
          throw new Error(`Unknown email template key: ${String(key)}`);
        }
        const spec = GENERIC_TEMPLATES[key as GenericTemplateKey];
        const headline = spec.subject[lang];
        const title =
          (data.notificationTitle as string) || (data.title as string) || "";
        const message =
          (data.notificationMessage as string) ||
          (data.message as string) ||
          undefined;
        const facts = Array.isArray(data.facts)
          ? (data.facts as Array<{ label: string; value: string }>)
          : undefined;
        return {
          subject: genericNotificationSubject(
            { ...data, __headline: headline },
            lang,
          ),
          component: React.createElement(GenericNotification, {
            lang,
            headline,
            severity: spec.severity,
            title,
            message,
            facts,
            actionUrl: (data.actionUrl as string) || (data.url as string),
            recipientName: data.recipientName as string | undefined,
            orgName: data.orgName as string | undefined,
          }),
        };
      }
    }
  }

  /** Utility: async delay for retry backoff. */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Singleton instance for use across the application. */
export const emailService = new EmailService();
