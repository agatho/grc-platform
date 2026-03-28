// Sprint 27: Compliance Culture Index (CCI) types

export type CCITrend = "up" | "down" | "stable";

export type CCIFactorKey =
  | "task_compliance"
  | "policy_ack_rate"
  | "training_completion"
  | "incident_response_time"
  | "audit_finding_closure"
  | "self_assessment_participation";

export type CCIFactorWeights = Record<CCIFactorKey, number>;
export type CCIFactorScores = Record<CCIFactorKey, number>;

export interface CCIRawMetricDetail {
  total: number;
  successful: number;
}

export type CCIRawMetrics = Record<CCIFactorKey, CCIRawMetricDetail>;

export interface CCISnapshot {
  id: string;
  orgId: string;
  orgEntityId?: string | null;
  period: string;
  overallScore: number;
  factorScores: CCIFactorScores;
  factorWeights: CCIFactorWeights;
  rawMetrics: CCIRawMetrics;
  trend?: CCITrend | null;
  createdAt: string;
}

export interface CCIConfiguration {
  id: string;
  orgId: string;
  factorWeights: CCIFactorWeights;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface CCICurrentResponse {
  snapshot: CCISnapshot | null;
  previousSnapshot: CCISnapshot | null;
  trend: CCITrend | null;
  delta: number | null;
}

export interface CCIHistoryEntry {
  period: string;
  overallScore: number;
  factorScores: CCIFactorScores;
  trend: CCITrend | null;
}

export interface CCIDepartmentEntry {
  orgEntityId: string;
  departmentName: string;
  overallScore: number;
  factorScores: CCIFactorScores;
  trend: CCITrend | null;
}

export interface CCIFactorDetail {
  key: CCIFactorKey;
  score: number;
  weight: number;
  weightedContribution: number;
  rawMetric: CCIRawMetricDetail;
  trend: CCITrend | null;
  previousScore: number | null;
}

export interface CCIFactorsResponse {
  factors: CCIFactorDetail[];
  overallScore: number;
  period: string;
}

export interface CCICalculationResult {
  overall: number;
  factors: CCIFactorScores;
  weights: CCIFactorWeights;
  rawMetrics: CCIRawMetrics;
  trend: CCITrend | null;
}

// Performance Admin types

export interface CacheStatsEntry {
  key: string;
  hitCount: number;
  missCount: number;
  hitRate: number;
  avgLatencyMs: number;
  sizeBytes: number;
  lastAccessed: string;
}

export interface CacheStatsResponse {
  totalKeys: number;
  totalHits: number;
  totalMisses: number;
  overallHitRate: number;
  memoryUsedMb: number;
  entries: CacheStatsEntry[];
}

export interface SlowQueryEntry {
  query: string;
  avgDurationMs: number;
  callCount: number;
  tables: string[];
  indexRecommended: boolean;
}

export interface SlowQueriesResponse {
  queries: SlowQueryEntry[];
  totalSlowQueries: number;
  threshold: number;
}
