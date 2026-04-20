// Sprint 67: GRC Copilot Enterprise Chat Types

export type CopilotLanguage = "de" | "en" | "fr" | "es";
export type CopilotMessageRole = "user" | "assistant" | "system";
export type CopilotContentType = "text" | "markdown" | "chart" | "table";
export type CopilotActionType =
  | "create_task"
  | "create_finding"
  | "update_risk"
  | "navigate"
  | "export";
export type CopilotActionStatus =
  | "suggested"
  | "accepted"
  | "dismissed"
  | "executed";
export type PromptCategory =
  | "risk"
  | "control"
  | "compliance"
  | "general"
  | "audit"
  | "process";
export type RagSourceType =
  | "risk"
  | "control"
  | "process"
  | "document"
  | "policy"
  | "finding";

export interface CopilotConversation {
  id: string;
  orgId: string;
  userId: string;
  title?: string;
  language: CopilotLanguage;
  contextModule?: string;
  contextEntityType?: string;
  contextEntityId?: string;
  isPinned: boolean;
  isArchived: boolean;
  messageCount: number;
  totalTokensUsed: number;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CopilotMessage {
  id: string;
  conversationId: string;
  orgId: string;
  role: CopilotMessageRole;
  content: string;
  contentType: CopilotContentType;
  ragSources: RagReference[];
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  templateKey?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RagReference {
  entityType: string;
  entityId: string;
  title: string;
  relevance: number;
}

export interface CopilotPromptTemplate {
  id: string;
  orgId?: string;
  key: string;
  name: string;
  description?: string;
  systemPrompt: string;
  userPromptTemplate: string;
  category: PromptCategory;
  moduleKey?: string;
  variables: PromptVariable[];
  isActive: boolean;
  version: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVariable {
  name: string;
  type: "string" | "number" | "boolean" | "date";
  required: boolean;
  description?: string;
}

export interface CopilotRagSource {
  id: string;
  orgId: string;
  sourceType: RagSourceType;
  entityId?: string;
  title: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  lastIndexedAt: string;
  createdAt: string;
}

export interface CopilotSuggestedAction {
  id: string;
  conversationId: string;
  orgId: string;
  messageId?: string;
  actionType: CopilotActionType;
  label: string;
  description?: string;
  payload: Record<string, unknown>;
  status: CopilotActionStatus;
  executedAt?: string;
  executedBy?: string;
  createdAt: string;
}

export interface CopilotFeedback {
  id: string;
  messageId: string;
  orgId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface CopilotUsageStats {
  orgId: string;
  totalConversations: number;
  uniqueUsers: number;
  totalMessages: number;
  totalTokens: number;
  activeConversations7d: number;
  avgFeedbackRating: number;
}

export interface CopilotDashboard {
  stats: CopilotUsageStats;
  recentConversations: CopilotConversation[];
  popularTemplates: Array<{ key: string; name: string; usageCount: number }>;
  feedbackSummary: { positive: number; negative: number; total: number };
}
