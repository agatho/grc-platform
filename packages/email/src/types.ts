export type EmailTemplateKey =
  | "task_assigned"
  | "task_overdue"
  | "task_reminder"
  | "user_invited"
  | "notification_digest"
  | "dpo_assigned"
  | "risk_owner_assigned"
  | "data_breach_72h_warning"
  | "data_breach_72h_overdue"
  | "data_breach_individual_notification"
  | "dsr_received"
  | "dsr_deadline_warning"
  | "dsr_completed"
  | "ropa_review_due"
  | "dpia_required"
  | "crisis_activated"
  | "crisis_resolved"
  | "bcp_review_due"
  | "exercise_reminder"
  | "bia_overdue"
  | "audit_plan_approved"
  | "audit_finding_assigned"
  | "audit_scheduled"
  | "vendor_dd_questionnaire"
  | "contract_expiry_notice"
  | "sla_breach_alert"
  | "vendor_reassessment_due";

export interface EmailParams {
  to: string;
  templateKey: EmailTemplateKey;
  data: Record<string, unknown>;
  lang: "de" | "en";
}

export interface EmailResult {
  messageId: string;
}
