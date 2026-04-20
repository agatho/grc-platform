// Sprint 43: Audit Advanced Types

export interface AuditWpFolder {
  id: string;
  orgId: string;
  auditId: string;
  parentFolderId?: string;
  code: string;
  title: string;
  sortOrder: number;
  children?: AuditWpFolder[];
}

export interface AuditWorkingPaper {
  id: string;
  orgId: string;
  auditId: string;
  folderId: string;
  reference: string;
  title: string;
  objective?: string;
  scope?: string;
  procedurePerformed?: string;
  results?: string;
  conclusion?: string;
  evidenceDocumentIds: string[];
  crossReferenceWpIds: string[];
  crossReferenceFindingIds: string[];
  status: "draft" | "in_review" | "needs_revision" | "reviewed" | "approved";
  preparedBy?: string;
  preparedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface AuditWpReviewNote {
  id: string;
  workingPaperId: string;
  section:
    | "objective"
    | "scope"
    | "procedure"
    | "results"
    | "conclusion"
    | "general";
  noteText: string;
  severity: "informational" | "requires_action" | "blocking";
  status: "open" | "addressed" | "closed";
  createdBy?: string;
  replies?: AuditWpReviewNoteReply[];
}

export interface AuditWpReviewNoteReply {
  id: string;
  reviewNoteId: string;
  replyText: string;
  createdBy?: string;
  createdAt: string;
}

export interface AuditorProfile {
  id: string;
  orgId: string;
  userId: string;
  seniority: "staff" | "senior" | "manager" | "director" | "cae";
  certifications: AuditorCertification[];
  skills: string[];
  availableHoursYear: number;
  hourlyRate?: number;
  team?: string;
}

export interface AuditorCertification {
  name: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
}

export interface AuditResourceAllocation {
  id: string;
  auditId: string;
  auditorId: string;
  role: "lead" | "team_member" | "specialist" | "observer";
  plannedHours: number;
  actualHours: number;
  startDate?: string;
  endDate?: string;
}

export interface AuditTimeEntry {
  id: string;
  auditorId: string;
  auditId: string;
  workDate: string;
  hours: number;
  description?: string;
}

export interface ContinuousAuditRule {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  ruleType: "builtin" | "custom_sql" | "api_check";
  dataSource: Record<string, unknown>;
  condition: Record<string, unknown>;
  schedule: "daily" | "weekly" | "monthly";
  severity: "low" | "medium" | "high" | "critical";
  riskArea?: string;
  isActive: boolean;
  lastExecutedAt?: string;
}

export interface ContinuousAuditResult {
  id: string;
  ruleId: string;
  resultStatus: "pass" | "exceptions_found" | "error";
  exceptionCount: number;
  executionTimeMs?: number;
  errorMessage?: string;
  executedAt: string;
}

export interface ContinuousAuditException {
  id: string;
  resultId: string;
  ruleId: string;
  description: string;
  entityType?: string;
  entityId?: string;
  detail: Record<string, unknown>;
  status: "new" | "acknowledged" | "escalated" | "false_positive";
  acknowledgedBy?: string;
  acknowledgmentJustification?: string;
  escalatedFindingId?: string;
  falsePositiveApprovedBy?: string;
}

export interface AuditQaReview {
  id: string;
  auditId: string;
  reviewerId: string;
  status: "assigned" | "in_review" | "completed";
  overallScore?: number;
  rating?: "green" | "yellow" | "red";
  observations?: string;
  checklistItems?: AuditQaChecklistItem[];
}

export interface AuditQaChecklistItem {
  id: string;
  qaReviewId: string;
  section:
    | "planning"
    | "fieldwork"
    | "reporting"
    | "communication"
    | "documentation";
  itemNumber: number;
  itemText: string;
  compliance?:
    | "compliant"
    | "partially_compliant"
    | "non_compliant"
    | "not_applicable";
  weight: number;
  reviewerComment?: string;
}

export interface ExternalAuditorShare {
  id: string;
  externalUserId: string;
  entityType: "audit_report" | "working_paper" | "finding" | "document";
  entityId: string;
  accessLevel: "read_only" | "read_comment";
  expiresAt: string;
  isActive: boolean;
}

export interface ExternalAuditorActivity {
  id: string;
  externalUserId: string;
  action: "viewed" | "downloaded" | "commented";
  entityType: string;
  entityId: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface CapacityDashboardEntry {
  auditorId: string;
  auditorName: string;
  availableHours: number;
  plannedHours: number;
  actualHours: number;
  utilizationPercent: number;
  isOverAllocated: boolean;
  isUnderAllocated: boolean;
}

export interface SkillGapEntry {
  skill: string;
  required: number;
  available: number;
  gap: number;
}
