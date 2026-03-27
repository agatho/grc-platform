// CCM + AI Intelligence types (Sprint 11)
export type CesTrend = "improving" | "stable" | "declining";

export interface ControlEffectivenessScore {
  id: string;
  orgId: string;
  controlId: string;
  score: number;
  testScoreAvg: number | null;
  overduePenalty: number | null;
  findingPenalty: number | null;
  automationBonus: number | null;
  openFindingsCount: number;
  lastTestAt: string | null;
  lastComputedAt: string;
  trend: CesTrend;
  previousScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FindingSlaConfig {
  id: string;
  orgId: string;
  severity: string;
  slaDays: number;
}

export interface RegulatoryFeedItem {
  id: string;
  source: string;
  title: string;
  summary: string | null;
  url: string | null;
  publishedAt: string;
  category: string | null;
  jurisdictions: string[] | null;
  frameworks: string[] | null;
  fetchedAt: string;
}

export interface RegulatoryRelevanceScore {
  id: string;
  feedItemId: string;
  orgId: string;
  relevanceScore: number;
  reasoning: string | null;
  affectedModules: string[] | null;
  isNotified: boolean;
  computedAt: string;
}

export interface AiPromptLog {
  id: string;
  orgId: string;
  userId: string;
  promptTemplate: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
  costUsd: string | null;
  cachedResult: boolean;
  createdAt: string;
}

export interface ExecutiveKpiSnapshot {
  id: string;
  orgId: string;
  snapshotDate: string;
  kpis: ExecutiveKpis;
  createdAt: string;
}

export interface ExecutiveKpis {
  avgCES: number;
  totalControls: number;
  controlsBelowThreshold: number;
  openFindings: number;
  findingSlaCompliance: number;
  riskScoreAvg: number;
  risksAboveAppetite: number;
  auditSlaCompliance: number;
  dsrSlaCompliance: number;
  esgCompleteness: number;
}

export interface CesComputeResult {
  score: number;
  testScoreAvg: number;
  overduePenalty: number;
  findingPenalty: number;
  automationBonus: number;
}

export interface CesOverviewItem {
  controlId: string;
  controlTitle: string;
  score: number;
  trend: CesTrend;
  lastTestAt: string | null;
  openFindingsCount: number;
}

export interface AiUsageSummary {
  totalPrompts: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byModel: Record<string, { prompts: number; tokens: number; cost: number }>;
  byTemplate: Record<string, { prompts: number; tokens: number; cost: number }>;
}
