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
// Sprint 4b: Catalog & Framework Layer types
// ──────────────────────────────────────────────────────────────

export type CatalogObjectType = "it_system" | "application" | "role" | "department" | "location" | "vendor" | "standard" | "regulation" | "custom";
export type MethodologyType = "iso_31000" | "coso_erm" | "fair" | "custom";
export type EnforcementLevel = "optional" | "recommended" | "mandatory";

export interface RiskCatalog {
  id: string;
  name: string;
  description?: string;
  version?: string;
  source: string;
  language: string;
  entryCount: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RiskCatalogEntry {
  id: string;
  catalogId: string;
  parentEntryId?: string;
  code: string;
  titleDe: string;
  titleEn?: string;
  descriptionDe?: string;
  descriptionEn?: string;
  level: number;
  riskCategory?: string;
  defaultLikelihood?: number;
  defaultImpact?: number;
  sortOrder: number;
  isActive: boolean;
  metadataJson?: unknown;
  createdAt: string;
}

export interface ControlCatalog {
  id: string;
  name: string;
  description?: string;
  version?: string;
  source: string;
  language: string;
  entryCount: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ControlCatalogEntry {
  id: string;
  catalogId: string;
  parentEntryId?: string;
  code: string;
  titleDe: string;
  titleEn?: string;
  descriptionDe?: string;
  descriptionEn?: string;
  implementationDe?: string;
  implementationEn?: string;
  level: number;
  controlType?: string;
  defaultFrequency?: string;
  sortOrder: number;
  isActive: boolean;
  metadataJson?: unknown;
  createdAt: string;
}

export interface GeneralCatalogEntry {
  id: string;
  orgId: string;
  objectType: CatalogObjectType;
  name: string;
  description?: string;
  status: string;
  lifecycleStart?: string;
  lifecycleEnd?: string;
  ownerId?: string;
  metadataJson?: unknown;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface OrgRiskMethodology {
  id: string;
  orgId: string;
  methodology: string;
  matrixSize: number;
  fairCurrency: string;
  fairSimulationRuns: number;
  riskAppetiteThreshold?: number;
  customLabelsJson?: unknown;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface CatalogLifecyclePhase {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  phaseName: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
}

// FAIRInput and FAIRResult are defined in fair-simulation.ts and re-exported via index.ts

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
  auditId?: string;
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

// ──────────────────────────────────────────────────────────────
// Sprint 5a: ISMS — Assets, Protection Requirements & Incidents
// ──────────────────────────────────────────────────────────────

export type ProtectionLevel = "normal" | "high" | "very_high";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "detected" | "triaged" | "contained" | "eradicated" | "recovered" | "lessons_learned" | "closed";
export type DependencyType = "uses" | "produces" | "manages" | "depends_on";
export type Criticality = "low" | "medium" | "high" | "critical";
export type VulnerabilitySeverity = "low" | "medium" | "high" | "critical";
export type ThreatCategory = string;

export interface AssetClassification {
  id: string;
  orgId: string;
  assetId: string;
  confidentialityLevel: ProtectionLevel;
  confidentialityReason?: string;
  integrityLevel: ProtectionLevel;
  integrityReason?: string;
  availabilityLevel: ProtectionLevel;
  availabilityReason?: string;
  overallProtection: ProtectionLevel;
  classifiedAt: string;
  classifiedBy: string;
  reviewDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessAsset {
  id: string;
  orgId: string;
  processId: string;
  assetId: string;
  dependencyType: DependencyType;
  criticality?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface Threat {
  id: string;
  orgId: string;
  catalogEntryId?: string;
  code?: string;
  title: string;
  description?: string;
  threatCategory?: string;
  likelihoodRating?: number;
  isSystem: boolean;
  createdAt: string;
  createdBy?: string;
}

export interface Vulnerability {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  cveReference?: string;
  affectedAssetId?: string;
  severity: string;
  status: string;
  mitigationControlId?: string;
  createdAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface RiskScenario {
  id: string;
  orgId: string;
  riskId?: string;
  threatId?: string;
  vulnerabilityId?: string;
  assetId?: string;
  description?: string;
  createdAt: string;
}

export interface SecurityIncident {
  id: string;
  orgId: string;
  elementId: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  incidentType?: string;
  detectedAt: string;
  reportedBy?: string;
  assignedTo?: string;
  affectedAssetIds: string[];
  affectedProcessIds: string[];
  isDataBreach: boolean;
  dataBreachDeadline?: string;
  rootCause?: string;
  remediationActions?: string;
  lessonsLearned?: string;
  closedAt?: string;
  workItemId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
}

export interface IncidentTimelineEntry {
  id: string;
  incidentId: string;
  orgId: string;
  actionType: string;
  description: string;
  occurredAt: string;
  addedBy: string;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────
// Sprint 5b: ISMS Assessment types
// ──────────────────────────────────────────────────────────────

export type AssessmentStatus = "planning" | "in_progress" | "review" | "completed" | "cancelled";
export type AssessmentScopeType = "full" | "department" | "asset_group" | "custom";
export type EvalResult = "effective" | "partially_effective" | "ineffective" | "not_applicable" | "not_evaluated";
export type RiskDecision = "accept" | "mitigate" | "transfer" | "avoid" | "pending";
export type SoaApplicability = "applicable" | "not_applicable" | "partially_applicable";
export type SoaImplementation = "implemented" | "partially_implemented" | "planned" | "not_implemented";
export type ReviewStatus = "planned" | "in_progress" | "completed" | "cancelled";

export interface AssessmentRun {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  status: AssessmentStatus;
  scopeType: AssessmentScopeType;
  scopeFilter?: unknown;
  framework: string;
  periodStart?: string;
  periodEnd?: string;
  leadAssessorId?: string;
  completionPercentage: number;
  completedEvaluations: number;
  totalEvaluations: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface AssessmentControlEval {
  id: string;
  orgId: string;
  assessmentRunId: string;
  controlId: string;
  assetId?: string;
  result: EvalResult;
  evidence?: string;
  notes?: string;
  evidenceDocumentIds: string[];
  currentMaturity?: number;
  targetMaturity?: number;
  assessedBy?: string;
  assessedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentRiskEval {
  id: string;
  orgId: string;
  assessmentRunId: string;
  riskScenarioId: string;
  residualLikelihood?: number;
  residualImpact?: number;
  decision: RiskDecision;
  justification?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ControlMaturity {
  id: string;
  orgId: string;
  controlId: string;
  assessmentRunId?: string;
  currentMaturity: number;
  targetMaturity: number;
  justification?: string;
  assessedBy?: string;
  assessedAt: string;
  createdAt: string;
}

export interface SoaEntry {
  id: string;
  orgId: string;
  catalogEntryId: string;
  controlId?: string;
  applicability: SoaApplicability;
  applicabilityJustification?: string;
  implementation: SoaImplementation;
  implementationNotes?: string;
  responsibleId?: string;
  lastReviewed?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagementReview {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  reviewDate: string;
  status: ReviewStatus;
  chairId?: string;
  participantIds: string[];
  changesInContext?: string;
  performanceFeedback?: string;
  riskAssessmentResults?: string;
  auditResults?: string;
  improvementOpportunities?: string;
  decisions?: unknown;
  actionItems?: unknown;
  minutes?: string;
  nextReviewDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ─── Sprint 5b: Computed / Dashboard types ───────────────────

export interface IsmsComplianceScore {
  totalControls: number;
  effective: number;
  partiallyEffective: number;
  ineffective: number;
  notEvaluated: number;
  compliancePercentage: number;
}

export interface SoaStats {
  total: number;
  applicable: number;
  notApplicable: number;
  partiallyApplicable: number;
  implemented: number;
  partiallyImplemented: number;
  planned: number;
  notImplemented: number;
  implementationPercentage: number;
}

export interface MaturityGapRow {
  controlId: string;
  controlTitle: string;
  currentMaturity: number;
  targetMaturity: number;
  gap: number;
  department?: string;
}

export interface RadarDataPoint {
  axis: string;
  current: number;
  target: number;
}

// ──────────────────────────────────────────────────────────────
// Sprint 6: Business Continuity Management System (BCMS) types
// ──────────────────────────────────────────────────────────────

export type BiaStatus = "draft" | "in_progress" | "review" | "approved" | "archived";
export type BcpStatus = "draft" | "in_review" | "approved" | "published" | "archived" | "superseded";
export type CrisisSeverity = "level_1_incident" | "level_2_emergency" | "level_3_crisis" | "level_4_catastrophe";
export type CrisisStatus = "standby" | "activated" | "resolved" | "post_mortem";
export type ExerciseType = "tabletop" | "walkthrough" | "functional" | "full_simulation";
export type ExerciseStatus = "planned" | "preparation" | "executing" | "evaluation" | "completed" | "cancelled";
export type StrategyType = "active_active" | "active_passive" | "cold_standby" | "manual_workaround" | "outsource" | "do_nothing";
export type BcpResourceType = "people" | "it_system" | "facility" | "supplier" | "equipment" | "data" | "other";
export type ExerciseResult = "successful" | "partially_successful" | "failed";
export type CrisisLogEntryType = "decision" | "communication" | "action" | "status_change" | "observation";
export type ExerciseFindingSeverity = "critical" | "major" | "minor" | "observation";

export interface BiaAssessment {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  status: BiaStatus;
  periodStart?: string;
  periodEnd?: string;
  leadAssessorId?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface BiaProcessImpact {
  id: string;
  orgId: string;
  biaAssessmentId: string;
  processId: string;
  mtpdHours?: number;
  rtoHours?: number;
  rpoHours?: number;
  impact1h?: string;
  impact4h?: string;
  impact24h?: string;
  impact72h?: string;
  impact1w?: string;
  impact1m?: string;
  impactReputation?: number;
  impactLegal?: number;
  impactOperational?: number;
  impactFinancial?: number;
  impactSafety?: number;
  criticalResources?: string;
  minimumStaff?: number;
  alternateLocation?: string;
  peakPeriods?: string;
  dependenciesJson?: unknown;
  priorityRanking?: number;
  isEssential: boolean;
  assessedBy?: string;
  assessedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BiaSupplierDependency {
  id: string;
  biaProcessImpactId: string;
  orgId: string;
  supplierName: string;
  vendorId?: string;
  service?: string;
  isCritical: boolean;
  alternativeAvailable: boolean;
  switchoverTimeHours?: number;
  notes?: string;
  createdAt: string;
}

export interface EssentialProcess {
  id: string;
  orgId: string;
  processId: string;
  biaAssessmentId?: string;
  priorityRanking: number;
  mtpdHours: number;
  rtoHours: number;
  justification?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bcp {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  description?: string;
  status: BcpStatus;
  version: number;
  scope?: string;
  processIds: string[];
  bcManagerId?: string;
  deputyManagerId?: string;
  activationCriteria?: string;
  activationAuthority?: string;
  reportDocumentId?: string;
  lastTestedDate?: string;
  nextReviewDate?: string;
  approvedBy?: string;
  approvedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface BcpProcedure {
  id: string;
  bcpId: string;
  orgId: string;
  stepNumber: number;
  title: string;
  description?: string;
  responsibleRole?: string;
  responsibleId?: string;
  estimatedDurationMinutes?: number;
  requiredResources?: string;
  prerequisites?: string;
  successCriteria?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BcpResource {
  id: string;
  bcpId: string;
  orgId: string;
  resourceType: BcpResourceType;
  name: string;
  description?: string;
  quantity: number;
  assetId?: string;
  isAvailableOffsite: boolean;
  alternativeResource?: string;
  priority: string;
  createdAt: string;
}

export interface ContinuityStrategy {
  id: string;
  orgId: string;
  processId: string;
  strategyType: StrategyType;
  name: string;
  description?: string;
  rtoTargetHours: number;
  rtoActualHours?: number;
  estimatedCostEur?: string;
  annualCostEur?: string;
  requiredStaff?: number;
  requiredSystems?: string;
  alternateLocation?: string;
  isActive: boolean;
  lastTestedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CrisisScenario {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  category: string;
  severity: CrisisSeverity;
  status: CrisisStatus;
  escalationMatrix: unknown;
  communicationTemplate?: string;
  bcpId?: string;
  activatedAt?: string;
  activatedBy?: string;
  resolvedAt?: string;
  postMortemNotes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CrisisTeamMember {
  id: string;
  crisisScenarioId: string;
  orgId: string;
  userId: string;
  role: string;
  isPrimary: boolean;
  deputyUserId?: string;
  phoneNumber?: string;
  createdAt: string;
}

export interface CrisisLog {
  id: string;
  crisisScenarioId: string;
  orgId: string;
  timestamp: string;
  entryType: CrisisLogEntryType;
  title: string;
  description?: string;
  createdBy?: string;
}

export interface BcExercise {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  description?: string;
  exerciseType: ExerciseType;
  status: ExerciseStatus;
  crisisScenarioId?: string;
  bcpId?: string;
  plannedDate: string;
  plannedDurationHours?: number;
  actualDate?: string;
  actualDurationHours?: number;
  exerciseLeadId?: string;
  participantIds: string[];
  observerIds: string[];
  objectives: unknown;
  lessonsLearned?: string;
  overallResult?: ExerciseResult;
  reportDocumentId?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface BcExerciseFinding {
  id: string;
  exerciseId: string;
  orgId: string;
  findingId?: string;
  title: string;
  description?: string;
  severity: ExerciseFindingSeverity;
  recommendation?: string;
  createdAt: string;
  createdBy?: string;
}

export interface BcmsDashboard {
  essentialProcessCount: number;
  biaCompletionPct: number;
  activeBcpCount: number;
  bcpCoveragePct: number;
  crisisScenarioCount: number;
  activeCrisisCount: number;
  exercisesCompleted: number;
  exercisesPlanned: number;
  openExerciseFindings: number;
  avgRtoHours: number | null;
}

// ──────────────────────────────────────────────────────────────
// Sprint 7: Data Protection Management System (DPMS) types
// ──────────────────────────────────────────────────────────────

export type RopaLegalBasis = "consent" | "contract" | "legal_obligation" | "vital_interest" | "public_interest" | "legitimate_interest";
export type RopaStatus = "draft" | "active" | "under_review" | "archived";
export type DpiaStatus = "draft" | "in_progress" | "completed" | "pending_dpo_review" | "approved" | "rejected";
export type DsrType = "access" | "erasure" | "restriction" | "portability" | "objection";
export type DsrStatus = "received" | "verified" | "processing" | "response_sent" | "closed" | "rejected";
export type BreachSeverity = "low" | "medium" | "high" | "critical";
export type BreachStatus = "detected" | "assessing" | "notifying_dpa" | "notifying_individuals" | "remediation" | "closed";
export type TiaLegalBasis = "adequacy" | "sccs" | "bcrs" | "derogation";
export type TiaRiskRating = "low" | "medium" | "high";

export interface RopaEntry {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  purpose: string;
  legalBasis: RopaLegalBasis;
  legalBasisDetail?: string;
  controllerOrgId?: string;
  processorName?: string;
  processingDescription?: string;
  retentionPeriod?: string;
  retentionJustification?: string;
  technicalMeasures?: string;
  organizationalMeasures?: string;
  internationalTransfer: boolean;
  transferCountry?: string;
  transferSafeguard?: string;
  status: RopaStatus;
  lastReviewed?: string;
  nextReviewDate?: string;
  responsibleId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface RopaDataCategory {
  id: string;
  orgId: string;
  ropaEntryId: string;
  category: string;
  createdAt: string;
}

export interface RopaDataSubject {
  id: string;
  orgId: string;
  ropaEntryId: string;
  subjectCategory: string;
  createdAt: string;
}

export interface RopaRecipient {
  id: string;
  orgId: string;
  ropaEntryId: string;
  recipientName: string;
  recipientType?: string;
  createdAt: string;
}

export interface Dpia {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  processingDescription?: string;
  legalBasis?: RopaLegalBasis;
  necessityAssessment?: string;
  dpoConsultationRequired: boolean;
  status: DpiaStatus;
  residualRiskSignOffId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface DpiaRisk {
  id: string;
  orgId: string;
  dpiaId: string;
  riskDescription: string;
  severity: string;
  likelihood: string;
  impact: string;
  createdAt: string;
}

export interface DpiaMeasure {
  id: string;
  orgId: string;
  dpiaId: string;
  measureDescription: string;
  implementationTimeline?: string;
  createdAt: string;
}

export interface Dsr {
  id: string;
  orgId: string;
  workItemId?: string;
  requestType: DsrType;
  status: DsrStatus;
  subjectName?: string;
  subjectEmail?: string;
  receivedAt: string;
  deadline: string;
  verifiedAt?: string;
  respondedAt?: string;
  closedAt?: string;
  handlerId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface DsrActivity {
  id: string;
  orgId: string;
  dsrId: string;
  activityType: string;
  timestamp: string;
  details?: string;
  createdBy?: string;
}

export interface DataBreach {
  id: string;
  orgId: string;
  workItemId?: string;
  incidentId?: string;
  title: string;
  description?: string;
  severity: BreachSeverity;
  status: BreachStatus;
  detectedAt: string;
  dpaNotifiedAt?: string;
  individualsNotifiedAt?: string;
  isDpaNotificationRequired: boolean;
  isIndividualNotificationRequired: boolean;
  dataCategoriesAffected?: string[];
  estimatedRecordsAffected?: number;
  affectedCountries?: string[];
  containmentMeasures?: string;
  remediationMeasures?: string;
  lessonsLearned?: string;
  dpoId?: string;
  assigneeId?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface DataBreachNotification {
  id: string;
  orgId: string;
  dataBreachId: string;
  recipientType: string;
  recipientEmail?: string;
  sentAt?: string;
  responseStatus?: string;
  createdAt: string;
}

export interface Tia {
  id: string;
  orgId: string;
  workItemId?: string;
  title: string;
  transferCountry: string;
  legalBasis: TiaLegalBasis;
  schremsIiAssessment?: string;
  riskRating: TiaRiskRating;
  supportingDocuments?: string;
  responsibleId?: string;
  assessmentDate?: string;
  nextReviewDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
}

export interface DpmsDashboard {
  ropaEntryCount: number;
  ropaByStatus: Record<RopaStatus, number>;
  activeDpiaCount: number;
  openDsrCount: number;
  dsrOverdueCount: number;
  activeBreachCount: number;
  breachesRequiringNotification: number;
  tiaCount: number;
  tiaHighRiskCount: number;
}

// ──────────────────────────────────────────────────────────────
// Sprint 8: Audit Management types
// ──────────────────────────────────────────────────────────────

export type AuditType = "internal" | "external" | "certification" | "surveillance" | "follow_up";
export type AuditStatus = "planned" | "preparation" | "fieldwork" | "reporting" | "review" | "completed" | "cancelled";
export type AuditPlanStatus = "draft" | "approved" | "active" | "completed";
export type ChecklistResult = "conforming" | "nonconforming" | "observation" | "not_applicable";
export type AuditConclusion = "conforming" | "minor_nonconformity" | "major_nonconformity" | "not_applicable";
export type UniverseEntityType = "process" | "department" | "it_system" | "vendor" | "custom";

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
