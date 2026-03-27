// BPMN Process Modeling types (Sprint 3 + 3b)
export type ProcessNotation = "bpmn" | "value_chain" | "epc";
export type ProcessStatus = "draft" | "in_review" | "approved" | "published" | "archived";
export type StepType = "task" | "gateway" | "event" | "subprocess" | "call_activity";

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
  createdBy?: string;
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
