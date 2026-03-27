// Enterprise Risk Management types (Sprint 2)
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
