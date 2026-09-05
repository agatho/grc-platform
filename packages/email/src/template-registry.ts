// template-registry.ts — the single source of truth for e-mail template keys.
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-03]
//
// The audit measured: 27 keys in the `EmailTemplateKey` union, 27 `case`
// arms in `renderTemplate`, and 38 distinct keys actually written into
// `notification.template_key` by the cron jobs — intersection: 2. Every
// other deadline and escalation mail hit the `default: throw`, was retried
// three times, and was then excluded from the query forever by
// `retry_count < 3`. The DSGVO 72-hour warning, the HinSchG acknowledgement
// reminder and the DORA report escalation all died there silently. A
// re-count over the whole repository (worker + web + packages) finds 70
// distinct keys in use — 75 once the keys hidden inside ternaries
// (`templateKey: isOverdue ? "a" : "b"`) are counted, which a naive scan for
// `templateKey: "…"` misses. The test scans the whole expression.
//
// Two ways to close that gap: write 65 more bespoke React templates, or
// admit that most of these mails carry exactly the same payload —
// title, message, a due date, a link — and render them from one well-built
// layout with per-key subject lines and a severity accent. This module does
// the latter, and keeps every one of the 27 bespoke templates that already
// exists.
//
// The registry is what makes the guarantee testable: `EmailTemplateKey` is
// DERIVED from it, `renderTemplate` is exhaustive over it, and
// `isEmailTemplateKey()` lets the notification write path reject an unknown
// key at the point where the bug is (the cron writing it) instead of three
// retries later in the delivery job.

/** Visual/severity accent of a generic notification mail. */
export type EmailSeverity = "info" | "action" | "warning" | "critical";

export interface GenericTemplateSpec {
  severity: EmailSeverity;
  /** Subject prefix; the notification title is appended. */
  subject: { de: string; en: string };
}

/**
 * Keys with a hand-written React template in `templates/`. `renderTemplate`
 * has a dedicated `case` for each.
 */
export const DEDICATED_TEMPLATE_KEYS = [
  "task_assigned",
  "task_overdue",
  "task_reminder",
  "user_invited",
  "notification_digest",
  "dpo_assigned",
  "risk_owner_assigned",
  "data_breach_72h_warning",
  "data_breach_72h_overdue",
  "data_breach_individual_notification",
  "dsr_received",
  "dsr_deadline_warning",
  "dsr_completed",
  "ropa_review_due",
  "dpia_required",
  "crisis_activated",
  "crisis_resolved",
  "bcp_review_due",
  "exercise_reminder",
  "bia_overdue",
  "audit_plan_approved",
  "audit_finding_assigned",
  "audit_scheduled",
  "vendor_dd_questionnaire",
  "contract_expiry_notice",
  "sla_breach_alert",
  "vendor_reassessment_due",
] as const;

/**
 * Keys rendered by the shared `GenericNotification` layout. Each carries a
 * real, translated subject line and a severity — nothing here is a
 * placeholder, and none of them can throw at delivery time.
 *
 * Severity mapping follows the regulatory weight of the underlying
 * deadline: `critical` for statutory notification windows (DSGVO Art. 33,
 * HinSchG §17, NIS2, DORA, AI Act), `warning` for overdue internal
 * obligations, `action` for something the recipient must do, `info` for
 * state changes.
 */
export const GENERIC_TEMPLATES = {
  // ── Statutory deadlines ────────────────────────────────────────────
  breach_72h_warning: {
    severity: "critical",
    subject: {
      de: "Fristwarnung Datenschutzverletzung (Art. 33 DSGVO)",
      en: "Deadline warning: personal data breach (GDPR Art. 33)",
    },
  },
  breach_dpo_notification: {
    severity: "critical",
    subject: {
      de: "Meldung an den Datenschutzbeauftragten",
      en: "Notification to the Data Protection Officer",
    },
  },
  dsr_sla_warning: {
    severity: "critical",
    subject: {
      de: "Frist Betroffenenanfrage läuft ab (Art. 12 DSGVO)",
      en: "Data subject request deadline approaching (GDPR Art. 12)",
    },
  },
  wb_acknowledge_reminder: {
    severity: "critical",
    subject: {
      de: "Eingangsbestätigung Hinweis überfällig (§17 HinSchG)",
      en: "Whistleblower acknowledgement overdue (HinSchG §17)",
    },
  },
  wb_response_reminder: {
    severity: "critical",
    subject: {
      de: "Rückmeldung an hinweisgebende Person fällig (§17 HinSchG)",
      en: "Whistleblower response due (HinSchG §17)",
    },
  },
  wb_sla_breach_ack: {
    severity: "critical",
    subject: {
      de: "Frist überschritten: Eingangsbestätigung Hinweis",
      en: "Deadline missed: whistleblower acknowledgement",
    },
  },
  wb_sla_breach_response: {
    severity: "critical",
    subject: {
      de: "Frist überschritten: Rückmeldung Hinweis",
      en: "Deadline missed: whistleblower response",
    },
  },
  dora_report_overdue: {
    severity: "critical",
    subject: {
      de: "DORA-Meldung überfällig",
      en: "DORA incident report overdue",
    },
  },
  ai_act_incident_deadline: {
    severity: "critical",
    subject: {
      de: "Meldefrist KI-Vorfall (EU AI Act)",
      en: "AI incident reporting deadline (EU AI Act)",
    },
  },
  // ── Overdue internal obligations ───────────────────────────────────
  isms_cap_overdue: {
    severity: "warning",
    subject: {
      de: "Korrekturmaßnahme (ISMS) überfällig",
      en: "ISMS corrective action overdue",
    },
  },
  audit_finding_deadline: {
    severity: "warning",
    subject: { de: "Frist Prüfungsfeststellung", en: "Audit finding deadline" },
  },
  audit_remediation_deadline: {
    severity: "warning",
    subject: {
      de: "Frist Maßnahmenumsetzung (Audit)",
      en: "Audit remediation deadline",
    },
  },
  policy_overdue: {
    severity: "warning",
    subject: { de: "Richtlinie überfällig", en: "Policy overdue" },
  },
  policy_escalation: {
    severity: "warning",
    subject: { de: "Eskalation Richtlinie", en: "Policy escalation" },
  },
  policy_reminder: {
    severity: "action",
    subject: { de: "Erinnerung Richtlinie", en: "Policy reminder" },
  },
  policy_distribution: {
    severity: "action",
    subject: { de: "Richtlinie zur Kenntnisnahme", en: "Policy distributed" },
  },
  treatment_overdue_reminder: {
    severity: "warning",
    subject: { de: "Risikomaßnahme überfällig", en: "Risk treatment overdue" },
  },
  vendor_reassessment_overdue: {
    severity: "warning",
    subject: {
      de: "Lieferanten-Neubewertung überfällig",
      en: "Vendor reassessment overdue",
    },
  },
  programme_step_overdue: {
    severity: "warning",
    subject: { de: "Programmschritt überfällig", en: "Programme step overdue" },
  },
  calendar_overdue_escalation: {
    severity: "warning",
    subject: {
      de: "Eskalation überfälliger Termin",
      en: "Overdue item escalated",
    },
  },
  document_signature_escalation: {
    severity: "warning",
    subject: {
      de: "Eskalation ausstehende Signatur",
      en: "Signature escalation",
    },
  },
  rcsa_escalation: {
    severity: "warning",
    subject: { de: "Eskalation RCSA", en: "RCSA escalation" },
  },
  document_auto_expired: {
    severity: "warning",
    subject: {
      de: "Dokument automatisch abgelaufen",
      en: "Document auto-expired",
    },
  },
  contract_expired: {
    severity: "warning",
    subject: { de: "Vertrag abgelaufen", en: "Contract expired" },
  },
  contract_notice_period: {
    severity: "warning",
    subject: { de: "Kündigungsfrist Vertrag", en: "Contract notice period" },
  },
  risk_appetite_exceeded: {
    severity: "warning",
    subject: {
      de: "Risikoappetit überschritten",
      en: "Risk appetite exceeded",
    },
  },
  risk_alert: {
    severity: "warning",
    subject: { de: "Risikowarnung", en: "Risk alert" },
  },
  kri_alert: {
    severity: "warning",
    subject: {
      de: "KRI-Schwellenwert überschritten",
      en: "KRI threshold breached",
    },
  },
  kri_overdue_measurement: {
    severity: "warning",
    subject: { de: "KRI-Messung überfällig", en: "KRI measurement overdue" },
  },
  esg_completeness_low: {
    severity: "warning",
    subject: {
      de: "ESG-Datenvollständigkeit zu niedrig",
      en: "ESG data incomplete",
    },
  },
  risk_acceptance_expired: {
    severity: "warning",
    subject: {
      de: "Risikoakzeptanz abgelaufen",
      en: "Risk acceptance expired",
    },
  },
  // ── Something to do ────────────────────────────────────────────────
  risk_review_reminder: {
    severity: "action",
    subject: { de: "Risikoüberprüfung fällig", en: "Risk review due" },
  },
  ropa_review_reminder: {
    severity: "action",
    subject: { de: "VVT-Überprüfung fällig", en: "RoPA review due" },
  },
  process_review_reminder: {
    severity: "action",
    subject: { de: "Prozessüberprüfung fällig", en: "Process review due" },
  },
  process_review_requested: {
    severity: "action",
    subject: { de: "Prozessprüfung angefragt", en: "Process review requested" },
  },
  process_approval_step_assigned: {
    severity: "action",
    subject: {
      de: "Prozessfreigabe zugewiesen",
      en: "Process approval assigned",
    },
  },
  process_acknowledgment_requested: {
    severity: "action",
    subject: {
      de: "Kenntnisnahme Prozess erforderlich",
      en: "Process acknowledgement required",
    },
  },
  document_review_requested: {
    severity: "action",
    subject: {
      de: "Dokumentprüfung angefragt",
      en: "Document review requested",
    },
  },
  document_review_reminder: {
    severity: "action",
    subject: {
      de: "Erinnerung Dokumentprüfung",
      en: "Document review reminder",
    },
  },
  document_review_overdue: {
    severity: "warning",
    subject: {
      de: "Dokumentprüfung überfällig",
      en: "Document review overdue",
    },
  },
  document_signature_due_reminder: {
    severity: "action",
    subject: { de: "Signatur fällig", en: "Signature due" },
  },
  document_signature_overdue: {
    severity: "warning",
    subject: { de: "Signatur überfällig", en: "Signature overdue" },
  },
  process_review_overdue: {
    severity: "warning",
    subject: {
      de: "Prozessüberprüfung überfällig",
      en: "Process review overdue",
    },
  },
  document_approval_step_assigned: {
    severity: "action",
    subject: {
      de: "Dokumentfreigabe zugewiesen",
      en: "Document approval assigned",
    },
  },
  document_signature_requested: {
    severity: "action",
    subject: { de: "Signatur angefordert", en: "Signature requested" },
  },
  document_owner_assigned: {
    severity: "action",
    subject: {
      de: "Dokument-Eigentümerschaft zugewiesen",
      en: "Document owner assigned",
    },
  },
  control_owner_assigned: {
    severity: "action",
    subject: {
      de: "Kontroll-Eigentümerschaft zugewiesen",
      en: "Control owner assigned",
    },
  },
  finding_owner_assigned: {
    severity: "action",
    subject: { de: "Feststellung zugewiesen", en: "Finding assigned" },
  },
  rcsa_invitation: {
    severity: "action",
    subject: { de: "Einladung zur RCSA", en: "RCSA invitation" },
  },
  rcsa_reminder: {
    severity: "action",
    subject: { de: "Erinnerung RCSA", en: "RCSA reminder" },
  },
  dd_session_reminder: {
    severity: "action",
    subject: {
      de: "Erinnerung Due-Diligence-Sitzung",
      en: "Due diligence session reminder",
    },
  },
  sla_measurement_due: {
    severity: "action",
    subject: { de: "SLA-Messung fällig", en: "SLA measurement due" },
  },
  dpia_auto_created: {
    severity: "action",
    subject: { de: "DSFA automatisch angelegt", en: "DPIA auto-created" },
  },
  // ── State changes / confirmations ──────────────────────────────────
  task_completed: {
    severity: "info",
    subject: { de: "Aufgabe abgeschlossen", en: "Task completed" },
  },
  calendar_weekly_digest: {
    severity: "info",
    subject: { de: "Wochenübersicht", en: "Weekly digest" },
  },
  contract_auto_renewed: {
    severity: "info",
    subject: {
      de: "Vertrag automatisch verlängert",
      en: "Contract auto-renewed",
    },
  },
  control_status_changed: {
    severity: "info",
    subject: { de: "Kontrollstatus geändert", en: "Control status changed" },
  },
  finding_status_changed: {
    severity: "info",
    subject: {
      de: "Status Feststellung geändert",
      en: "Finding status changed",
    },
  },
  risk_status_changed: {
    severity: "info",
    subject: { de: "Risikostatus geändert", en: "Risk status changed" },
  },
  risk_acceptance_recorded: {
    severity: "info",
    subject: { de: "Risikoakzeptanz erfasst", en: "Risk acceptance recorded" },
  },
  document_status_changed: {
    severity: "info",
    subject: { de: "Dokumentstatus geändert", en: "Document status changed" },
  },
  document_approved: {
    severity: "info",
    subject: { de: "Dokument freigegeben", en: "Document approved" },
  },
  document_approval_completed: {
    severity: "info",
    subject: {
      de: "Dokumentfreigabe abgeschlossen",
      en: "Document approval completed",
    },
  },
  document_approval_rejected: {
    severity: "info",
    subject: {
      de: "Dokumentfreigabe abgelehnt",
      en: "Document approval rejected",
    },
  },
  document_signature_completed: {
    severity: "info",
    subject: { de: "Signatur abgeschlossen", en: "Signature completed" },
  },
  document_signature_declined: {
    severity: "info",
    subject: { de: "Signatur abgelehnt", en: "Signature declined" },
  },
  document_signature_cancelled: {
    severity: "info",
    subject: { de: "Signatur abgebrochen", en: "Signature cancelled" },
  },
  process_approved: {
    severity: "info",
    subject: { de: "Prozess freigegeben", en: "Process approved" },
  },
  process_rejected: {
    severity: "info",
    subject: { de: "Prozess abgelehnt", en: "Process rejected" },
  },
  process_comment_notification: {
    severity: "info",
    subject: { de: "Neuer Kommentar zum Prozess", en: "New process comment" },
  },
  esg_target_status_change: {
    severity: "info",
    subject: { de: "ESG-Zielstatus geändert", en: "ESG target status changed" },
  },
} as const satisfies Record<string, GenericTemplateSpec>;

export type DedicatedTemplateKey = (typeof DEDICATED_TEMPLATE_KEYS)[number];
export type GenericTemplateKey = keyof typeof GENERIC_TEMPLATES;

/** Every key the platform may write into `notification.template_key`. */
export type EmailTemplateKey = DedicatedTemplateKey | GenericTemplateKey;

const ALL_KEYS: ReadonlySet<string> = new Set<string>([
  ...DEDICATED_TEMPLATE_KEYS,
  ...Object.keys(GENERIC_TEMPLATES),
]);

/** All known keys, for tests and tooling. */
export function allEmailTemplateKeys(): string[] {
  return [...ALL_KEYS].sort();
}

/**
 * Type guard used by the notification write path (worker `notify.ts`) so an
 * unknown key is caught where it is produced instead of three retries later.
 */
export function isEmailTemplateKey(key: string): key is EmailTemplateKey {
  return ALL_KEYS.has(key);
}

export function isGenericTemplateKey(
  key: EmailTemplateKey,
): key is GenericTemplateKey {
  return key in GENERIC_TEMPLATES;
}
