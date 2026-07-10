// BPMN Process Modeling types (Sprint 3 + 3b)
export type ProcessNotation = "bpmn" | "value_chain" | "epc";
export type ProcessStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "archived";
export type StepType =
  | "task"
  | "gateway"
  | "event"
  | "subprocess"
  | "call_activity";
/** Prozesslandkarte: value-chain band (management / core / support) */
export type ProcessMapCategory = "management" | "core" | "support";

export interface Process {
  id: string;
  orgId: string;
  parentProcessId?: string;
  name: string;
  description?: string;
  level: number;
  notation: ProcessNotation;
  status: ProcessStatus;
  processOwnerId?: string;
  reviewerId?: string;
  department?: string;
  currentVersion: number;
  isEssential: boolean;
  /** Prozesslandkarte: null = inherits the parent's band on the map */
  mapCategory?: ProcessMapCategory | null;
  publishedAt?: string;
  // Review cycle (Gap 2)
  reviewDate?: string;
  reviewCycleDays?: number;
  lastReviewedAt?: string;
  lastReviewedBy?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
}

export type ProcessVersionType = "working" | "released";

export interface ProcessVersion {
  id: string;
  processId: string;
  orgId: string;
  versionNumber: number;
  bpmnXml?: string;
  diagramJson?: unknown;
  changeSummary?: string;
  diffSummaryJson?: unknown;
  isCurrent: boolean;
  /** B2.4: 'working' = editable copy of a published process */
  versionType?: ProcessVersionType;
  createdBy?: string;
  /** B3.3: display name of the creator (joined in the versions API) */
  createdByName?: string;
  createdAt: string;
}

// B2.1: multi-stage approval chain (process_approval_step)
export type ProcessApprovalStepType = "review" | "approval" | "acknowledgment";
export type ProcessApprovalStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "rejected"
  | "skipped";

export interface ProcessApprovalStep {
  id: string;
  processId: string;
  versionNumber: number;
  stepOrder: number;
  stepType: ProcessApprovalStepType;
  assigneeUserId?: string | null;
  assigneeUserName?: string | null;
  assigneeRole?: string | null;
  status: ProcessApprovalStepStatus;
  decision?: string | null;
  comment?: string | null;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decidedByName?: string | null;
  dueDate?: string | null;
  createdAt: string;
}

export interface ProcessStep {
  id: string;
  processId: string;
  orgId: string;
  bpmnElementId: string;
  name?: string;
  description?: string;
  stepType: StepType;
  responsibleRole?: string;
  sequenceOrder: number;
  // Call-Activity Drill-Down: linked child process (call_activity/subprocess)
  calledProcessId?: string | null;
  calledProcessName?: string | null;
  calledProcessStatus?: ProcessStatus | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Sprint 3b: Process Governance types

export interface ProcessComment {
  id: string;
  orgId: string;
  processId: string;
  entityType: "process" | "process_step";
  entityId: string;
  content: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  parentCommentId?: string;
  mentionedUserIds: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  deletedAt?: string;
}

export interface ProcessReviewSchedule {
  id: string;
  orgId: string;
  processId: string;
  reviewIntervalMonths: number;
  nextReviewDate: string;
  lastReminderSentAt?: string;
  assignedReviewerId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface BpmnValidationResult {
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  issues: BpmnValidationIssue[];
}

export interface BpmnValidationIssue {
  elementId: string;
  rule: string;
  category: "error" | "warning";
  message: string;
}

export interface VersionComparison {
  processId: string;
  versionA: number;
  versionB: number;
  diff: BpmnDiff;
  details: ElementDiffDetail[];
}

export interface BpmnDiff {
  added: string[];
  removed: string[];
  modified: string[];
  stats: { added: number; removed: number; modified: number };
}

export interface ElementDiffDetail {
  elementId: string;
  elementName: string | null;
  elementType: string;
  changes: Array<{
    attribute: string;
    oldValue: string | null;
    newValue: string | null;
  }>;
}

export interface GovernanceDashboard {
  totalProcesses: number;
  byStatus: Record<ProcessStatus, number>;
  overdueReviews: number;
  upcomingReviews: number;
  unresolvedComments: number;
  recentActivity: GovernanceActivityItem[];
}

export interface GovernanceActivityItem {
  id: string;
  processId: string;
  processName: string;
  action: string;
  performedBy: string;
  performedAt: string;
}

export interface GovernanceRoadmapItem {
  processId: string;
  processName: string;
  currentStatus: ProcessStatus;
  nextReviewDate?: string;
  processOwnerId?: string;
  processOwnerName?: string;
  department?: string;
  isOverdue: boolean;
}

export interface BulkOperationResult {
  totalRequested: number;
  succeeded: number;
  failed: number;
  errors: Array<{
    processId: string;
    error: string;
  }>;
}
