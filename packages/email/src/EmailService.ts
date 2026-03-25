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

interface RenderedTemplate {
  subject: string;
  component: React.ReactElement;
}

const RETRY_DELAYS = [1_000, 5_000, 30_000];
const MAX_ATTEMPTS = 3;

export class EmailService {
  private resend: Resend;

  constructor(apiKey?: string) {
    this.resend = new Resend(apiKey ?? process.env.RESEND_API_KEY);
  }

  /**
   * Send a transactional email via Resend.
   *
   * When EMAIL_ENABLED !== 'true', logs the call and returns null (dev/test no-op).
   * Retries up to 3 times with exponential backoff (1s, 5s, 30s).
   */
  async send(params: EmailParams): Promise<EmailResult | null> {
    if (process.env.EMAIL_ENABLED !== "true") {
      console.log(
        `[EmailService] disabled, skipping: ${params.templateKey} -> ${params.to}`
      );
      return null;
    }

    const template = this.renderTemplate(
      params.templateKey,
      params.data,
      params.lang
    );

    const fromName = process.env.RESEND_FROM_NAME || "ARCTOS GRC Platform";
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "noreply@arctos.cws.de";
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
        return { messageId: result.data?.id ?? "" };
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS - 1) {
          await this.delay(RETRY_DELAYS[attempt]);
        }
      }
    }

    throw lastError;
  }

  /**
   * Map a template key + data + lang to a rendered React Email component and subject line.
   */
  renderTemplate(
    key: EmailTemplateKey,
    data: Record<string, unknown>,
    lang: "de" | "en"
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
            lang === "de"
              ? "DPO-Zuweisung: ARCTOS"
              : "DPO Assignment: ARCTOS",
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

      default: {
        const _exhaustive: never = key;
        throw new Error(`Unknown email template key: ${_exhaustive}`);
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
