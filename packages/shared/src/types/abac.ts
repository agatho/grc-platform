// Sprint 34: ABAC + Simulation + DMN types

export type AbacAccessLevel = "read" | "write" | "none";
export type AbacDecision = "granted" | "denied";
export type SimulationStatus = "draft" | "ready" | "running" | "completed" | "error";
export type DmnStatus = "draft" | "active" | "deprecated";
export type DmnHitPolicy = "UNIQUE" | "FIRST" | "COLLECT" | "RULE_ORDER" | "ANY";

export interface AbacCondition {
  attribute: string;
  operator: "=" | "!=" | "contains" | "not_contains" | "in" | "not_in" | "starts_with" | "gt" | "lt";
  value: string | string[] | number;
}

export interface AbacPolicy {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  entityType: string;
  subjectCondition: AbacCondition;
  objectCondition: AbacCondition;
  accessLevel: AbacAccessLevel;
  priority: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AbacAccessLogEntry {
  id: string;
  orgId: string;
  userId: string;
  entityType: string;
  entityId?: string;
  accessLevel: string;
  decision: AbacDecision;
  matchedPolicyId?: string;
  evaluationDurationMs?: number;
  subjectAttributes?: Record<string, unknown>;
  objectAttributes?: Record<string, unknown>;
  createdAt: string;
}

export interface AbacTestResult {
  decision: AbacDecision;
  accessLevel: AbacAccessLevel;
  matchedPolicy?: AbacPolicy;
  evaluatedPolicies: number;
  durationMs: number;
}

export interface SimulationScenario {
  id: string;
  orgId: string;
  processId: string;
  name: string;
  description?: string;
  caseCount: number;
  timePeriodDays: number;
  resourceConfig: SimulationResource[];
  status: SimulationStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationResource {
  id: string;
  name: string;
  capacity: number;
  costPerHour: number;
}

export interface SimulationActivityParam {
  id: string;
  scenarioId: string;
  orgId: string;
  activityId: string;
  activityName?: string;
  durationMin: number;
  durationMostLikely: number;
  durationMax: number;
  costPerExecution: number;
  resourceId?: string;
  gatewayProbabilities?: Record<string, number>;
}

export interface SimulationResult {
  id: string;
  scenarioId: string;
  orgId: string;
  caseCount: number;
  avgCycleTime?: number;
  p50CycleTime?: number;
  p95CycleTime?: number;
  avgCost?: number;
  totalCost?: number;
  bottleneckActivities: BottleneckActivity[];
  costBreakdown: Record<string, number>;
  resourceUtilization: Record<string, number>;
  histogram: HistogramBin[];
  executedAt: string;
}

export interface BottleneckActivity {
  activityId: string;
  activityName: string;
  avgWaitTime: number;
  avgDuration: number;
  utilizationPct: number;
}

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
}

export interface DmnDecision {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  dmnXml: string;
  version: number;
  linkedProcessStepId?: string;
  status: DmnStatus;
  inputSchema: DmnColumn[];
  outputSchema: DmnColumn[];
  hitPolicy: DmnHitPolicy;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DmnColumn {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "date";
  description?: string;
}

export interface DmnEvaluationResult {
  matchedRules: number[];
  outputs: Record<string, unknown>[];
  hitPolicy: DmnHitPolicy;
  inputsUsed: Record<string, unknown>;
}
