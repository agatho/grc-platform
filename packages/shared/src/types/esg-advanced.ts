// Sprint 45: ESG Advanced Types

export interface MaterialityAssessment {
  id: string;
  orgId: string;
  reportingPeriodYear: number;
  status: "draft" | "stakeholder_engagement" | "assessment" | "finalized";
  financialThreshold: { scoreThreshold: number };
  impactThreshold: { scoreThreshold: number };
  finalizedBy?: string;
  finalizedAt?: string;
}

export interface MaterialityIro {
  id: string;
  assessmentId: string;
  esrsTopic: string;
  iroType: "impact" | "risk" | "opportunity";
  title: string;
  description?: string;
  affectedStakeholders: string[];
  valueChainStage?: "own_operations" | "upstream" | "downstream";
  timeHorizon?: "short_term" | "medium_term" | "long_term";
  financialMagnitude?: string;
  financialLikelihood?: string;
  impactScale?: string;
  impactScope?: string;
  impactIrremediable?: string;
  isPositiveImpact: boolean;
  financialMaterialityScore?: number;
  impactMaterialityScore?: number;
  isMaterial?: boolean;
}

export interface MaterialityStakeholderEngagement {
  id: string;
  assessmentId: string;
  stakeholderGroup: string;
  engagementMethod: string;
  keyConcerns?: string;
  participantCount?: number;
  engagementDate?: string;
  linkedIroIds: string[];
}

export interface EmissionSource {
  id: string;
  orgId: string;
  scope: 1 | 2 | 3;
  scope3Category?: number;
  sourceName: string;
  sourceType: string;
  fuelType?: string;
  facilityName?: string;
  isActive: boolean;
}

export interface EmissionActivityData {
  id: string;
  sourceId: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  quantity: number;
  unit: string;
  dataQuality: "measured" | "calculated" | "estimated";
  emissionFactorId?: string;
  computedCo2eTonnes?: number;
  computationMethod?: "location_based" | "market_based";
}

export interface EmissionFactor {
  id: string;
  factorSource: string;
  activityType: string;
  fuelType?: string;
  unit: string;
  co2eFactor: number;
  validYear: number;
  country?: string;
  isCustom: boolean;
}

export interface CarbonDashboard {
  scope1Total: number;
  scope2LocationBased: number;
  scope2MarketBased: number;
  scope3Total: number;
  scope3ByCategory: Record<number, number>;
  grandTotal: number;
  intensityPerRevenue?: number;
  intensityPerFTE?: number;
  yoyChange?: number;
}

export interface EsgCollectionCampaign {
  id: string;
  orgId: string;
  title: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  deadline: string;
  status: "draft" | "active" | "closed" | "archived";
}

export interface EsgCollectionAssignment {
  id: string;
  campaignId: string;
  metricId: string;
  assigneeId: string;
  reviewerId?: string;
  status: "pending" | "submitted" | "in_review" | "approved" | "rejected";
  submittedValue?: number;
  submittedUnit?: string;
  previousPeriodValue?: number;
  validationWarnings: Array<{ type: string; message: string }>;
  validationErrors: Array<{ type: string; message: string }>;
}

export interface SupplierEsgAssessment {
  id: string;
  vendorId: string;
  assessmentDate: string;
  environmentalScore?: number;
  socialScore?: number;
  governanceScore?: number;
  overallScore?: number;
  riskClassification?: "low" | "medium" | "high" | "critical";
  industryRiskFactor?: number;
  geographicRiskFactor?: number;
}

export interface SupplierEsgCorrectiveAction {
  id: string;
  assessmentId: string;
  vendorId: string;
  finding: string;
  correctiveAction: string;
  status: "open" | "in_progress" | "verified" | "closed";
  deadline?: string;
}

export interface LksgDueDiligence {
  id: string;
  vendorId: string;
  reportingYear: number;
  riskAnalysisStatus: "not_started" | "in_progress" | "completed";
  documentationStatus: "complete" | "incomplete";
  overallCompliance?: "compliant" | "partially_compliant" | "non_compliant";
}

export interface EsrsDisclosureTemplate {
  id: string;
  orgId: string;
  standard: string;
  disclosureRequirement: string;
  title: string;
  description?: string;
  content?: string;
  status: "not_started" | "in_progress" | "draft" | "reviewed" | "final";
}
