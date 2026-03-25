export type EmailTemplateKey =
  | "task_assigned"
  | "task_overdue"
  | "task_reminder"
  | "user_invited"
  | "notification_digest"
  | "dpo_assigned"
  | "risk_owner_assigned";

export interface EmailParams {
  to: string;
  templateKey: EmailTemplateKey;
  data: Record<string, unknown>;
  lang: "de" | "en";
}

export interface EmailResult {
  messageId: string;
}
