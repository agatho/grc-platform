// Sprint 14: Risk & Control Self-Assessment (RCSA) types

export type RcsaCampaignStatus = "draft" | "active" | "closed" | "archived";
export type RcsaCampaignFrequency = "quarterly" | "semi_annual" | "annual";
export type RcsaAssignmentStatus = "pending" | "in_progress" | "submitted" | "overdue";
export type RcsaEntityType = "risk" | "control";
export type RcsaRiskTrend = "increasing" | "stable" | "decreasing";
export type RcsaControlEffectiveness = "effective" | "partially_effective" | "ineffective";
export type RcsaDiscrepancyType = "overconfident" | "underconfident";

export interface RcsaTargetScope {
  departments?: string[];
  orgIds?: string[];
  roles?: string[];
}

export interface RcsaCampaign {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  frequency: RcsaCampaignFrequency;
  status: RcsaCampaignStatus;
  targetScope: RcsaTargetScope;
  questionSetId?: string;
  reminderDaysBefore: number;
  cesWeight: number;
  createdBy?: string;
  launchedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RcsaCampaignWithStats extends RcsaCampaign {
  totalAssignments: number;
  completedCount: number;
  completionRate: number;
  participantCount: number;
}

export interface RcsaAssignment {
  id: string;
  campaignId: string;
  orgId: string;
  userId: string;
  entityType: RcsaEntityType;
  entityId: string;
  status: RcsaAssignmentStatus;
  deadline: string;
  submittedAt?: string;
  remindersSent: number;
  createdAt: string;
  updatedAt: string;
}

export interface RcsaAssignmentWithEntity extends RcsaAssignment {
  entityTitle?: string;
  entityDepartment?: string;
  entityCategory?: string;
  campaignName?: string;
  userName?: string;
  userEmail?: string;
}

export interface RcsaResponse {
  id: string;
  assignmentId: string;
  orgId: string;
  // Risk fields
  riskStillRelevant?: boolean;
  likelihoodAssessment?: number;
  impactAssessment?: number;
  riskTrend?: RcsaRiskTrend;
  // Control fields
  controlEffectiveness?: RcsaControlEffectiveness;
  controlOperating?: boolean;
  controlWeaknesses?: string;
  // Common
  comment?: string;
  evidenceIds?: string[];
  confidence?: number;
  respondedAt: string;
}

export interface RcsaResult {
  id: string;
  campaignId: string;
  orgId: string;
  totalAssignments: number;
  completedCount: number;
  completionRate: string;
  avgLikelihood?: string;
  avgImpact?: string;
  risksIncreasing: number;
  risksStable: number;
  risksDecreasing: number;
  controlsEffective: number;
  controlsPartial: number;
  controlsIneffective: number;
  discrepancyCount: number;
  discrepancies: RcsaDiscrepancy[];
  computedAt: string;
}

export interface RcsaDiscrepancy {
  entityType: RcsaEntityType;
  entityId: string;
  entityTitle?: string;
  rcsaRating: string;
  auditRating: string;
  type: RcsaDiscrepancyType;
}

export interface RcsaHeatmapCell {
  department: string;
  category: string;
  avgScore: number;
  count: number;
}

export interface RcsaTrendComparison {
  current: RcsaResult;
  previous?: RcsaResult;
  deltas: {
    completionRate: number;
    avgLikelihood: number;
    avgImpact: number;
    controlsEffective: number;
    discrepancyCount: number;
  };
}

export interface RcsaCompletionEntry {
  userId: string;
  userName: string;
  userEmail: string;
  department?: string;
  assignedCount: number;
  completedCount: number;
  overdueCount: number;
  lastActivity?: string;
}
