// Sprint 48: EAM Dashboards & Extended Assessment types

export type FunctionalFit = "perfect" | "appropriate" | "insufficient";
export type TechnicalFit = "perfect" | "appropriate" | "insufficient";
export type SixRStrategy =
  | "retain"
  | "replatform"
  | "refactor"
  | "rearchitect"
  | "rebuild"
  | "replace";
export type BusinessCriticality =
  | "mission_critical"
  | "business_critical"
  | "business_operational"
  | "administrative_service";
export type FunctionalCoverage = "full" | "partial" | "none";
export type StrategicAlignmentLevel = "aligned" | "partially" | "misaligned";
export type CapabilityLifecycleStatus =
  | "active"
  | "transforming"
  | "retiring"
  | "planned";
export type AssessmentDimension =
  | "functional_fit"
  | "technical_fit"
  | "six_r_strategy"
  | "time_classification"
  | "business_criticality"
  | "business_value"
  | "technical_condition";

export interface AssessmentHistoryEntry {
  id: string;
  orgId: string;
  applicationPortfolioId: string;
  dimension: AssessmentDimension;
  oldValue: string | null;
  newValue: string;
  changedBy: string | null;
  changedAt: string;
  justification: string | null;
}

export interface CostDashboardData {
  totalApplications: number;
  totalApplicationCost: number;
  totalComponents: number;
  totalComponentCost: number;
  costByCategory: CostCategoryRow[];
  costByProvider: CostProviderRow[];
}

export interface CostCategoryRow {
  category: string;
  appCount: number;
  totalCost: number;
}

export interface CostProviderRow {
  providerName: string;
  componentCount: number;
  totalCost: number;
}

export interface TreemapNode {
  name: string;
  value: number;
  children?: TreemapNode[];
  id?: string;
  category?: string;
}

export interface CostTrendPoint {
  month: string;
  category: string;
  totalCost: number;
}

export interface PortfolioDistributions {
  licenseType: DistributionEntry[];
  functionalFit: DistributionEntry[];
  technicalFit: DistributionEntry[];
  lifecycleStatus: DistributionEntry[];
  businessCriticality: DistributionEntry[];
  timeClassification: DistributionEntry[];
  sixRStrategy: DistributionEntry[];
}

export interface DistributionEntry {
  value: string;
  count: number;
}

export interface SixROverview {
  strategy: SixRStrategy;
  count: number;
  estimatedMonths: number;
}

export interface PortfolioHealthIndicators {
  insufficientFunctionalFitPct: number;
  approachingEolPct: number;
  unassessedPct: number;
  noSixRDecisionPct: number;
  avgAssessmentAgeDays: number;
}

export interface ApplicationAssessmentUpdate {
  functionalFit?: FunctionalFit;
  technicalFit?: TechnicalFit;
  sixRStrategy?: SixRStrategy;
  businessCriticality?: BusinessCriticality;
  timeClassification?: string;
  businessValue?: number;
  technicalCondition?: number;
  justification?: string;
}

export interface BulkAssessmentRequest {
  applicationIds: string[];
  assessment: ApplicationAssessmentUpdate;
}

export interface CapabilityAssessmentUpdate {
  functionalCoverage?: FunctionalCoverage;
  strategicAlignment?: StrategicAlignmentLevel;
  lifecycleStatus?: CapabilityLifecycleStatus;
}
