// GRC Budget, Cost Tracking & ROI types (Sprint 13)

export type BudgetStatus = "draft" | "submitted" | "approved";
export type GrcArea = "erm" | "isms" | "ics" | "dpms" | "audit" | "tprm" | "bcms" | "esg" | "general";
export type CostCategory = "personnel" | "external" | "tools" | "training" | "measures" | "certification";
export type CostType = "planned" | "actual" | "forecast";
export type RoiMethod = "ale_reduction" | "penalty_avoidance" | "incident_prevention" | "roni";

export interface GrcBudget {
  id: string;
  orgId: string;
  year: number;
  totalAmount: string;
  currency: string;
  status: BudgetStatus;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrcBudgetLine {
  id: string;
  orgId: string;
  budgetId: string;
  grcArea: GrcArea;
  costCategory: CostCategory;
  plannedAmount: string;
  q1Amount?: string;
  q2Amount?: string;
  q3Amount?: string;
  q4Amount?: string;
  notes?: string;
  createdAt: string;
}

export interface GrcCostEntry {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  costCategory: CostCategory;
  costType: CostType;
  amount: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  department?: string;
  hours?: string;
  hourlyRate?: string;
  description?: string;
  budgetId?: string;
  invoiceRef?: string;
  createdBy?: string;
  createdAt: string;
}

export interface GrcTimeEntry {
  id: string;
  orgId: string;
  userId: string;
  taskId?: string;
  entityType?: string;
  entityId?: string;
  grcArea: GrcArea;
  department?: string;
  hours: string;
  date: string;
  description?: string;
  createdAt: string;
}

export interface GrcRoiCalculation {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  investmentCost?: string;
  riskReductionValue?: string;
  roiPercent?: string;
  roniCfo?: string;
  roniCiso?: string;
  inherentAle?: string;
  residualAle?: string;
  calculationMethod?: RoiMethod;
  computedAt: string;
  createdAt: string;
}

export interface BudgetVsActual {
  grcArea: GrcArea;
  costCategory: CostCategory;
  planned: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

export interface BudgetForecast {
  grcArea: GrcArea;
  costCategory: CostCategory;
  planned: number;
  actualToDate: number;
  forecast: number;
  overUnder: number;
}

export interface RoiOverviewItem {
  entityType: string;
  entityId: string;
  investmentCost: number;
  riskReductionValue: number;
  roiPercent: number;
  calculationMethod: RoiMethod;
}

export interface RoniOverviewItem {
  entityType: string;
  entityId: string;
  roniCfo: number;
  roniCiso: number;
  inherentAle: number;
  residualAle: number;
}

export interface RoniVsRoiItem {
  entityType: string;
  entityId: string;
  investmentCost: number;
  roiPercent: number;
  roniCfo: number;
  roniCiso: number;
  inherentAle: number;
  residualAle: number;
}

export interface BudgetCutScenarioInput {
  cutPercent: number;
}

export interface BudgetCutScenarioResult {
  cutPercent: number;
  droppedTreatments: string[];
  newRoni: number;
  deltaRoni: number;
  totalBudget: number;
  cutAmount: number;
}
