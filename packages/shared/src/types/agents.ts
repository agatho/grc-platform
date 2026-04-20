// Sprint 35: GRC Monitoring Agents types

export type AgentType =
  | "evidence_review"
  | "compliance_monitor"
  | "vendor_signal"
  | "sla_monitor";
export type AgentStatus = "idle" | "running" | "error" | "disabled";
export type AgentPhase = "observe" | "evaluate" | "recommend" | "complete";
export type RecommendationSeverity = "info" | "warning" | "critical";
export type RecommendationStatus = "pending" | "accepted" | "dismissed";
export type SuggestedAction =
  | "create_task"
  | "create_finding"
  | "update_score"
  | "escalate"
  | "notify";

export interface AgentConfig {
  scanFrequencyMinutes: number;
  thresholds: Record<string, number>;
  scope?: string[];
  enabled?: boolean;
}

export interface AgentRegistration {
  id: string;
  orgId: string;
  agentType: AgentType;
  name: string;
  description?: string;
  config: AgentConfig;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  status: AgentStatus;
  errorMessage?: string;
  totalRunCount: number;
  totalRecommendations: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentExecutionLog {
  id: string;
  agentId: string;
  orgId: string;
  phase: AgentPhase;
  observedData?: Record<string, unknown>;
  evaluation?: Record<string, unknown>;
  recommendations: AgentRecommendationData[];
  actionsCreated: CreatedAction[];
  itemsFound: number;
  recommendationsGenerated: number;
  durationMs?: number;
  aiTokensUsed: number;
  errorMessage?: string;
  executedAt: string;
}

export interface AgentRecommendationData {
  action: SuggestedAction;
  severity: RecommendationSeverity;
  entity?: string;
  reasoning: string;
}

export interface CreatedAction {
  type: string;
  id: string;
}

export interface AgentRecommendation {
  id: string;
  agentId: string;
  orgId: string;
  severity: RecommendationSeverity;
  title: string;
  reasoning: string;
  suggestedAction?: SuggestedAction;
  entityType?: string;
  entityId?: string;
  status: RecommendationStatus;
  dismissReason?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface AgentDashboard {
  activeAgents: number;
  totalAgents: number;
  lastScanAt?: string;
  pendingRecommendations: number;
  criticalAlerts: number;
  agents: AgentRegistration[];
}
