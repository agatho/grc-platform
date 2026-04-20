// ISMS — Assets, Protection Requirements & Incidents (Sprint 5a + 5b)
export type ProtectionLevel = "normal" | "high" | "very_high";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus =
  | "detected"
  | "triaged"
  | "contained"
  | "eradicated"
  | "recovered"
  | "lessons_learned"
  | "closed";
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

// Sprint 5b: ISMS Assessment types

export type AssessmentStatus =
  | "planning"
  | "in_progress"
  | "review"
  | "completed"
  | "cancelled";
export type AssessmentScopeType =
  | "full"
  | "department"
  | "asset_group"
  | "custom";
export type EvalResult =
  | "effective"
  | "partially_effective"
  | "ineffective"
  | "not_applicable"
  | "not_evaluated";
export type RiskDecision =
  | "accept"
  | "mitigate"
  | "transfer"
  | "avoid"
  | "pending";
export type SoaApplicability =
  | "applicable"
  | "not_applicable"
  | "partially_applicable";
export type SoaImplementation =
  | "implemented"
  | "partially_implemented"
  | "planned"
  | "not_implemented";
export type ReviewStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

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

// Sprint 5b: Computed / Dashboard types

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
  // Predictive-risk radar fields (optional for ISMS maturity usage)
  entityType?: string;
  entityId?: string;
  entityName?: string;
  currentValue?: number;
  predictedValue?: number;
  riskLevel?: string;
  trendDirection?: string;
}
