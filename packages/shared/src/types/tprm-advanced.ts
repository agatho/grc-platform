// Sprint 44: TPRM Advanced Types

export interface VendorScorecard {
  id: string;
  orgId: string;
  vendorId: string;
  overallScore: number;
  tier: "strategic" | "preferred" | "approved" | "under_review" | "exit_candidate";
  dimensionScores: VendorDimensionScores;
  weights: Record<string, number>;
  computedAt: string;
  previousScore?: number;
  previousTier?: string;
}

export interface VendorDimensionScores {
  due_diligence: number;
  sla_compliance: number;
  incident_history: number;
  financial_stability: number;
  esg_rating: number;
  contract_compliance: number;
  security_posture: number;
}

export interface VendorScorecardHistory {
  id: string;
  scorecardId: string;
  overallScore: number;
  tier: string;
  dimensionScores: VendorDimensionScores;
  snapshotAt: string;
}

export interface VendorConcentrationAnalysis {
  id: string;
  analysisType: "spend" | "single_source" | "geographic" | "technology";
  analysisDate: string;
  results: Record<string, unknown>;
  hhiScore?: number;
  riskLevel?: "low" | "moderate" | "high";
}

export interface VendorSlaDefinition {
  id: string;
  vendorId: string;
  contractId?: string;
  metricName: string;
  metricType: "availability" | "response_time" | "resolution_time" | "delivery_time" | "quality" | "custom";
  targetValue: number;
  unit: string;
  measurementPeriod: "monthly" | "quarterly" | "annually";
  penaltyClause?: string;
  isActive: boolean;
}

export interface VendorSlaMeasurement {
  id: string;
  slaDefinitionId: string;
  periodStart: string;
  periodEnd: string;
  actualValue: number;
  targetValue: number;
  isMet: boolean;
  breachSeverity?: "minor" | "major" | "critical";
  evidence?: string;
}

export interface VendorExitPlan {
  id: string;
  vendorId: string;
  transitionApproach: "in_house" | "alternative_vendor" | "hybrid" | "decommission";
  dataMigrationPlan?: string;
  knowledgeTransferRequirements?: string;
  terminationNoticeDays?: number;
  estimatedTimelineMonths?: number;
  estimatedCost?: number;
  alternativeVendorIds: string[];
  keyRisks?: string;
  status: "draft" | "reviewed" | "approved";
  exitReadinessScore?: number;
  nextReviewDate?: string;
  reviewCycleMonths: number;
}

export interface VendorSubProcessor {
  id: string;
  vendorId: string;
  name: string;
  serviceDescription?: string;
  dataCategories: string[];
  hostingCountry?: string;
  isEu: boolean;
  isAdequateCountry: boolean;
  requiresTia: boolean;
  tiaId?: string;
  approvalStatus: "approved" | "pending_review" | "rejected";
}

export interface VendorSubProcessorNotification {
  id: string;
  vendorId: string;
  notificationType: "add" | "remove" | "change";
  subProcessorName: string;
  changeDescription?: string;
  receivedAt: string;
  reviewDeadline?: string;
  reviewStatus: "pending" | "approved" | "rejected" | "escalated";
}

export interface DoraOutsourcingEntry {
  vendorId: string;
  vendorName: string;
  functionDescription: string;
  classification: string;
  subContractors: string[];
  hostingLocation: string;
  contractStart?: string;
  lastRiskAssessment?: string;
  exitPlanStatus: string;
}
