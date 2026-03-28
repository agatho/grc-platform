// Sprint 39: ERM Advanced Types

export interface BowtieElement {
  id: string;
  riskId: string;
  type: "cause" | "consequence" | "barrier";
  title: string;
  description?: string;
  controlId?: string;
  effectiveness?: "effective" | "degraded" | "failed";
  likelihood?: number;
  impact?: number;
  sortOrder: number;
}

export interface BowtiePath {
  id: string;
  riskId: string;
  sourceElementId: string;
  targetElementId: string;
  barrierIds: string[];
  sortOrder: number;
}

export interface BowtieData {
  riskId: string;
  elements: BowtieElement[];
  paths: BowtiePath[];
}

export interface TreatmentMilestone {
  id: string;
  treatmentId: string;
  title: string;
  description?: string;
  deadline: string;
  responsibleId?: string;
  status: "planned" | "in_progress" | "completed" | "overdue" | "cancelled";
  percentComplete: number;
  plannedEffortHours?: number;
  actualEffortHours?: number;
  dependsOnMilestoneId?: string;
  completedAt?: string;
}

export interface RiskInterconnection {
  id: string;
  sourceRiskId: string;
  targetRiskId: string;
  correlationType: "amplifies" | "triggers" | "shares_cause" | "shares_consequence";
  strength: "weak" | "moderate" | "strong";
  direction: "unidirectional" | "bidirectional";
  description?: string;
}

export interface EmergingRisk {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  category: string;
  timeHorizon: "1y" | "3y" | "5y" | "10y";
  potentialImpact: string;
  probabilityTrend: "increasing" | "stable" | "decreasing";
  monitoringTriggers?: string;
  responsibleId?: string;
  nextReviewDate?: string;
  status: "monitoring" | "escalating" | "materializing" | "promoted" | "archived";
  promotedToRiskId?: string;
}

export interface RiskEvent {
  id: string;
  orgId: string;
  riskId?: string;
  title: string;
  description?: string;
  eventDate: string;
  eventType: "materialized" | "near_miss";
  actualImpactEur?: number;
  actualImpactQualitative?: string;
  rootCause?: string;
  responseActions?: string;
  durationDays?: number;
  category?: string;
  lessons?: RiskEventLesson[];
}

export interface RiskEventLesson {
  id: string;
  eventId: string;
  lesson: string;
  category?: string;
  linkedRiskIds?: string[];
  linkedControlIds?: string[];
}

export interface CascadeSimulationResult {
  originRiskId: string;
  affectedRisks: Array<{
    riskId: string;
    riskTitle: string;
    depth: number;
    correlationType: string;
    strength: string;
  }>;
}

export interface InterconnectionHeatmapData {
  risks: Array<{ id: string; title: string }>;
  connections: Array<{
    sourceIdx: number;
    targetIdx: number;
    strength: string;
    type: string;
  }>;
}
