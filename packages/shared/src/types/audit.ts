// Audit Management types (Sprint 8)
export type AuditType =
  | "internal"
  | "external"
  | "certification"
  | "surveillance"
  | "follow_up";
export type AuditStatus =
  | "planned"
  | "preparation"
  | "fieldwork"
  | "reporting"
  | "review"
  | "completed"
  | "cancelled";
export type AuditPlanStatus = "draft" | "approved" | "active" | "completed";
// ISO 19011 § 3.4 / ISO/IEC 17021-1 § 9.4.8 — siehe Migration 0290.
// "nonconforming" ist [DEPRECATED] und nach Minor NC gemappt — neue Inserts
// sollen minor_nonconformity oder major_nonconformity nutzen.
export type ChecklistResult =
  | "positive"
  | "conforming"
  | "opportunity_for_improvement"
  | "observation"
  | "minor_nonconformity"
  | "major_nonconformity"
  | "nonconforming"
  | "not_applicable";

export type AuditMethod =
  | "interview"
  | "document_review"
  | "observation"
  | "technical_test"
  | "sampling"
  | "walkthrough"
  | "reperformance";

export type AuditRiskRating = "low" | "medium" | "high" | "critical";
export type AuditConclusion =
  | "conforming"
  | "minor_nonconformity"
  | "major_nonconformity"
  | "not_applicable";
export type UniverseEntityType =
  | "process"
  | "department"
  | "it_system"
  | "vendor"
  | "custom";

export interface AuditUniverseEntry {
  id: string;
  orgId: string;
  name: string;
  entityType: UniverseEntityType;
  entityId?: string;
  riskScore?: number;
  lastAuditDate?: string;
  auditCycleMonths?: number;
  nextAuditDue?: string;
  priority?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface AuditPlan {
  id: string;
  orgId: string;
  name: string;
  year: number;
  description?: string;
  status: AuditPlanStatus;
  totalPlannedDays?: number;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface AuditPlanItem {
  id: string;
  orgId: string;
  auditPlanId: string;
  universeEntryId?: string;
  title: string;
  scopeDescription?: string;
  plannedStart?: string;
  plannedEnd?: string;
  estimatedDays?: number;
  leadAuditorId?: string;
  status: string;
  createdAt: string;
}

export interface Audit {
  id: string;
  orgId: string;
  workItemId?: string;
  auditPlanItemId?: string;
  title: string;
  description?: string;
  auditType: AuditType;
  status: AuditStatus;
  scopeDescription?: string;
  scopeProcesses?: string[];
  scopeDepartments?: string[];
  scopeFrameworks?: string[];
  leadAuditorId?: string;
  auditorIds?: string[];
  auditeeId?: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  findingCount?: number;
  conclusion?: AuditConclusion;
  reportDocumentId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface AuditActivity {
  id: string;
  orgId: string;
  auditId: string;
  activityType: string;
  title: string;
  description?: string;
  performedBy?: string;
  performedAt: string;
  duration?: number;
  notes?: string;
  createdAt: string;
}

export interface AuditChecklist {
  id: string;
  orgId: string;
  auditId: string;
  name: string;
  sourceType?: string;
  totalItems?: number;
  completedItems?: number;
  createdAt: string;
  createdBy?: string;
}

export interface AuditChecklistItem {
  id: string;
  orgId: string;
  checklistId: string;
  controlId?: string;
  question: string;
  expectedEvidence?: string;
  result?: ChecklistResult;
  notes?: string;
  evidenceIds?: string[];
  // ISO 19011 § 6.4.5/6.4.7 — prüfungssicheres Arbeitspapier
  criterionReference?: string | null;
  auditMethod?: AuditMethod | null;
  interviewee?: string | null;
  intervieweeRole?: string | null;
  sampleSize?: number | null;
  sampleIds?: string[] | null;
  riskRating?: AuditRiskRating | null;
  correctiveActionSuggestion?: string | null;
  /** ISO-Datum YYYY-MM-DD */
  remediationDeadline?: string | null;
  sortOrder?: number;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
}

export interface AuditEvidence {
  id: string;
  orgId: string;
  auditId: string;
  evidenceId?: string;
  title: string;
  description?: string;
  filePath?: string;
  createdAt: string;
  createdBy?: string;
}
