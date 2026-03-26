// Shared TypeScript types (Sprint 1)
export type OrgType = "subsidiary" | "holding" | "joint_venture" | "branch";
export type UserRole = "admin" | "risk_manager" | "control_owner" | "auditor" | "dpo" | "viewer" | "process_owner";
export type LineOfDefense = "first" | "second" | "third";

export interface Organization {
  id: string;
  name: string;
  shortName?: string;
  type: OrgType;
  country: string;
  isEu: boolean;
  parentOrgId?: string;
}

export interface UserWithRoles {
  id: string;
  email: string;
  name: string;
  roles: { orgId: string; role: UserRole; lineOfDefense?: LineOfDefense }[];
}

export type TaskStatus = "open" | "in_progress" | "done" | "overdue" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  dueDate?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  createdAt: string;
}

// Sprint 1.4: Asset & Work Item types
export type AssetTier = "business_structure" | "primary_asset" | "supporting_asset";

export type WorkItemStatus =
  | "draft"
  | "in_evaluation"
  | "in_review"
  | "in_approval"
  | "management_approved"
  | "active"
  | "in_treatment"
  | "completed"
  | "obsolete"
  | "cancelled";

export interface Asset {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  assetTier: AssetTier;
  codeGroup?: string;
  defaultConfidentiality?: number;
  defaultIntegrity?: number;
  defaultAvailability?: number;
  defaultAuthenticity?: number;
  defaultReliability?: number;
  protectionGoalClass?: number;
  contactPerson?: string;
  dataProtectionResponsible?: string;
  dpoEmail?: string;
  latestAuditDate?: string;
  latestAuditResult?: string;
  parentAssetId?: string;
  visibleInModules: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface AssetCiaProfile {
  id: string;
  assetId: string;
  orgId: string;
  assessmentRunId?: string;
  confidentiality: number;
  integrity: number;
  availability: number;
  authenticity?: number;
  reliability?: number;
  protectionGoalClass?: number;
  isAssessmentRequired: boolean;
  overruleJustification?: string;
  validFrom: string;
  validTo?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface WorkItem {
  id: string;
  orgId: string;
  typeKey: string;
  elementId?: string;
  name: string;
  status: WorkItemStatus;
  responsibleId?: string;
  reviewerId?: string;
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;
  grcPerspective: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface WorkItemType {
  typeKey: string;
  displayNameDe: string;
  displayNameEn: string;
  icon?: string;
  colorClass?: string;
  primaryModule: string;
  secondaryModules: string[];
  hasStatusWorkflow: boolean;
  hasResponsibleUser: boolean;
  hasDueDate: boolean;
  hasPriority: boolean;
  hasLinkedAsset: boolean;
  hasCiaEvaluation: boolean;
  isCrossModule: boolean;
  elementIdPrefix?: string;
  navOrder: number;
  isActiveInPlatform: boolean;
}

export interface WorkItemLink {
  id: string;
  orgId: string;
  sourceId: string;
  targetId: string;
  linkType: string;
  linkContext?: string;
  createdAt: string;
  createdBy?: string;
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: UserRole;
  lineOfDefense?: LineOfDefense;
  token: string;
  status: InvitationStatus;
  invitedBy?: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Sprint 2: Enterprise Risk Management types
// ──────────────────────────────────────────────────────────────

export type RiskCategory = "strategic" | "operational" | "financial" | "compliance" | "cyber" | "reputational" | "esg";
export type RiskSource = "isms" | "erm" | "bcm" | "project" | "process";
export type RiskStatus = "identified" | "assessed" | "treated" | "accepted" | "closed";
export type TreatmentStrategy = "mitigate" | "accept" | "transfer" | "avoid";
export type TreatmentStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type KriAlertStatus = "green" | "yellow" | "red";
export type KriTrend = "improving" | "stable" | "worsening";
export type KriDirection = "asc" | "desc";
export type KriMeasurementFrequency = "daily" | "weekly" | "monthly" | "quarterly";
export type KriMeasurementSource = "manual" | "api_import" | "calculated";

export interface Risk {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  description?: string;
  riskCategory: RiskCategory;
  riskSource: RiskSource;
  status: RiskStatus;
  ownerId?: string;
  department?: string;
  inherentLikelihood?: number;
  inherentImpact?: number;
  residualLikelihood?: number;
  residualImpact?: number;
  riskScoreInherent?: number;
  riskScoreResidual?: number;
  treatmentStrategy?: TreatmentStrategy;
  treatmentRationale?: string;
  financialImpactMin?: string;
  financialImpactMax?: string;
  financialImpactExpected?: string;
  riskAppetiteExceeded: boolean;
  reviewDate?: string;
  // Catalog & Framework Layer hook (ADR-013)
  catalogEntryId: string | null;
  catalogSource: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface RiskTreatment {
  id: string;
  orgId: string;
  riskId: string;
  workItemId?: string;
  description?: string;
  responsibleId?: string;
  expectedRiskReduction?: string;
  costEstimate?: string;
  status: TreatmentStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface KRI {
  id: string;
  orgId: string;
  riskId?: string;
  name: string;
  description?: string;
  unit?: string;
  direction: KriDirection;
  thresholdGreen?: string;
  thresholdYellow?: string;
  thresholdRed?: string;
  currentValue?: string;
  currentAlertStatus: KriAlertStatus;
  trend: KriTrend;
  measurementFrequency: KriMeasurementFrequency;
  lastMeasuredAt?: string;
  alertEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface KRIMeasurement {
  id: string;
  kriId: string;
  orgId: string;
  value: string;
  measuredAt: string;
  source: KriMeasurementSource;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface RiskAppetite {
  id: string;
  orgId: string;
  appetiteThreshold: number;
  toleranceUpper?: string;
  toleranceLower?: string;
  description?: string;
  effectiveDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

// ──────────────────────────────────────────────────────────────
// Sprint 3: BPMN Process Modeling types
// ──────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────
// Sprint 3b: Process Governance types
// ──────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────
// Sprint 4: Internal Control System (ICS) types
// ──────────────────────────────────────────────────────────────

export type ControlType = "preventive" | "detective" | "corrective";
export type ControlFrequency = "event_driven" | "continuous" | "daily" | "weekly" | "monthly" | "quarterly" | "annually" | "ad_hoc";
export type AutomationLevel = "manual" | "semi_automated" | "fully_automated";
export type ControlStatus = "designed" | "implemented" | "effective" | "ineffective" | "retired";
export type ControlAssertion = "completeness" | "accuracy" | "obligations_and_rights" | "fraud_prevention" | "existence" | "valuation" | "presentation" | "safeguarding_of_assets";
export type TestType = "design_effectiveness" | "operating_effectiveness";
export type TestResult = "effective" | "ineffective" | "partially_effective" | "not_tested";
export type TestStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type CampaignStatus = "draft" | "active" | "completed" | "cancelled";
export type FindingSeverity = "observation" | "recommendation" | "improvement_requirement" | "insignificant_nonconformity" | "significant_nonconformity";
export type FindingStatus = "identified" | "in_remediation" | "remediated" | "verified" | "accepted" | "closed";
export type FindingSource = "control_test" | "audit" | "incident" | "self_assessment" | "external";
export type EvidenceCategory = "screenshot" | "document" | "log_export" | "email" | "certificate" | "report" | "photo" | "config_export" | "other";

export interface Control {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  description?: string;
  controlType: ControlType;
  frequency: ControlFrequency;
  automationLevel: AutomationLevel;
  status: ControlStatus;
  assertions: string[];
  ownerId?: string;
  department?: string;
  objective?: string;
  testInstructions?: string;
  reviewDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface ControlTestCampaign {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  periodStart: string;
  periodEnd: string;
  responsibleId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface ControlTest {
  id: string;
  orgId: string;
  controlId: string;
  campaignId?: string;
  taskId?: string;
  testType: TestType;
  status: TestStatus;
  todResult?: TestResult;
  toeResult?: TestResult;
  testerId?: string;
  testDate?: string;
  sampleSize?: number;
  sampleDescription?: string;
  conclusion?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface Evidence {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  category: EvidenceCategory;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  description?: string;
  uploadedBy: string;
  createdAt: string;
  deletedAt?: string;
}

export interface Finding {
  id: string;
  orgId: string;
  workItemId?: string;
  controlId?: string;
  controlTestId?: string;
  riskId?: string;
  taskId?: string;
  title: string;
  description?: string;
  severity: FindingSeverity;
  status: FindingStatus;
  source: FindingSource;
  ownerId?: string;
  remediationPlan?: string;
  remediationDueDate?: string;
  remediatedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

// ──────────────────────────────────────────────────────────────
// Sprint 4: Document Management System (DMS) types
// ──────────────────────────────────────────────────────────────

export type DocumentCategory = "policy" | "procedure" | "guideline" | "template" | "record" | "tom" | "dpa" | "bcp" | "soa" | "other";
export type DocumentStatus = "draft" | "in_review" | "approved" | "published" | "archived" | "expired";

export interface Document {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  content?: string;
  category: DocumentCategory;
  status: DocumentStatus;
  currentVersion: number;
  requiresAcknowledgment: boolean;
  tags: string[];
  ownerId?: string;
  reviewerId?: string;
  approverId?: string;
  publishedAt?: string;
  expiresAt?: string;
  reviewDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  orgId: string;
  versionNumber: number;
  content?: string;
  changeSummary?: string;
  isCurrent: boolean;
  createdBy?: string;
  createdAt: string;
}

export interface Acknowledgment {
  id: string;
  orgId: string;
  documentId: string;
  userId: string;
  versionAcknowledged: number;
  acknowledgedAt: string;
}

export interface DocumentEntityLink {
  id: string;
  orgId: string;
  documentId: string;
  entityType: string;
  entityId: string;
  linkDescription?: string;
  createdAt: string;
  createdBy?: string;
}
