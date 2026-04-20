// Sprint 46: Whistleblowing Advanced Types

export interface WbInvestigation {
  id: string;
  orgId: string;
  caseId: string;
  phase:
    | "intake"
    | "triage"
    | "investigation"
    | "decision"
    | "resolution"
    | "closed";
  priority: "low" | "medium" | "high" | "critical";
  assignedInvestigatorId?: string;
  assignedTeamId?: string;
  triageDate?: string;
  investigationStart?: string;
  decisionDate?: string;
  resolutionDate?: string;
  closedDate?: string;
  decisionOutcome?:
    | "substantiated"
    | "unsubstantiated"
    | "inconclusive"
    | "partially_substantiated";
  recommendedActions?: string;
  finalReportDocumentId?: string;
}

export interface WbEvidence {
  id: string;
  investigationId: string;
  title: string;
  description?: string;
  fileUrl?: string;
  fileType?: string;
  fileSizeBytes?: number;
  sourceType:
    | "reporter_upload"
    | "investigator_upload"
    | "system_generated"
    | "interview_recording";
  tags: string[];
  accessedLog: Array<{ userId: string; accessedAt: string }>;
  isSuperseded: boolean;
  supersededBy?: string;
}

export interface WbInterview {
  id: string;
  investigationId: string;
  intervieweeReference?: string;
  interviewerId?: string;
  interviewDate: string;
  questionsAsked?: string;
  responses?: string;
  observations?: string;
  consentDocumented: boolean;
  recordingReference?: string;
}

export interface WbInvestigationLogEntry {
  id: string;
  investigationId: string;
  activityType:
    | "evidence_added"
    | "interview_conducted"
    | "status_changed"
    | "communication"
    | "decision"
    | "note";
  description?: string;
  performedBy?: string;
  createdAt: string;
}

export interface WbProtectionCase {
  id: string;
  orgId: string;
  caseId: string;
  reporterReference?: string;
  reporterUserId?: string;
  protectionStartDate: string;
  protectionStatus: "active" | "monitoring" | "concluded";
  monitoringFrequency: "monthly" | "quarterly";
  nextReviewDate?: string;
  concludedAt?: string;
  conclusionReason?: string;
}

export interface WbProtectionEvent {
  id: string;
  protectionCaseId: string;
  eventType:
    | "role_change"
    | "salary_change"
    | "performance_review"
    | "disciplinary"
    | "assignment_change"
    | "location_change"
    | "termination";
  eventDate: string;
  description?: string;
  flag: "normal" | "suspicious" | "critical";
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface WbOmbudspersonAssignment {
  id: string;
  ombudspersonUserId: string;
  caseId: string;
  scope: "full_investigation" | "consultation";
  assignedBy?: string;
  assignedAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface WbOmbudspersonActivity {
  id: string;
  ombudspersonUserId: string;
  action:
    | "case_viewed"
    | "evidence_uploaded"
    | "message_sent"
    | "status_changed";
  caseId?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  reason?: string;
}

export interface ChannelAnalytics {
  period: string;
  web_form: number;
  telephone: number;
  postal: number;
  walk_in: number;
  ombudsperson: number;
  total: number;
}

export interface HinSchGCompliance {
  caseId: string;
  acknowledgmentDeadline: string;
  acknowledgmentMet: boolean;
  feedbackDeadline: string;
  feedbackMet: boolean;
  daysToAcknowledgment?: number;
  daysToFeedback?: number;
}
