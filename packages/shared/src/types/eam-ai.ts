// Sprint 51: EAM AI Assistant types

export type LLMProviderId =
  | "openai"
  | "anthropic"
  | "azure_openai"
  | "ollama"
  | "mistral"
  | "custom";
export type AIValidationStatus = "valid" | "invalid" | "untested";
export type TranslationStatus =
  | "untranslated"
  | "ai_translated"
  | "human_reviewed";
export type SuggestionReason =
  | "eol_approaching"
  | "open_cves"
  | "unassessed"
  | "recently_modified"
  | "in_department";

export interface LLMProviderConfig {
  provider: LLMProviderId;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  organizationId?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
  model: string;
  finishReason?: string;
}

export interface AIConfigResponse {
  id: string;
  provider: LLMProviderId;
  model: string;
  isActive: boolean;
  validationStatus: AIValidationStatus;
  lastValidatedAt: string | null;
  maskedApiKey?: string;
}

export interface AIProviderStatus {
  configured: boolean;
  provider?: LLMProviderId;
  model?: string;
  validationStatus?: AIValidationStatus;
}

export interface PromptTemplate {
  id: string;
  orgId: string | null;
  templateKey: string;
  templateText: string;
  variables: EamPromptVariable[];
  version: number;
  isActive: boolean;
  isCustom: boolean;
}

export interface EamPromptVariable {
  name: string;
  type: string;
  description?: string;
}

export interface ObjectSuggestion {
  name: string;
  description: string;
  keywords?: string[];
}

export interface GenerateParams {
  objectType: string;
  industry: string;
  count: number;
  existingObjects?: string[];
  language?: string;
}

export interface DescriptionGenerateParams {
  entityId: string;
  language?: string;
  tone?: string;
}

export interface TranslateParams {
  entityId: string;
  entityType: string;
  fieldName: string;
  sourceText: string;
  targetLanguage: string;
}

export interface ChatRequest {
  question: string;
  sessionId?: string;
}

export interface ChatResponse {
  answer: string;
  references: ChatReference[];
  sessionId: string;
  provider: string;
  model: string;
}

export interface ChatReference {
  entityId: string;
  entityType: string;
  name: string;
  link: string;
}

export interface EamTranslationEntry {
  id: string;
  orgId: string;
  entityId: string;
  entityType: string;
  fieldName: string;
  language: string;
  translatedText: string;
  status: TranslationStatus;
  translatedBy: string | null;
  translatedAt: string;
}

export interface SuggestionEntry {
  id: string;
  entityId: string;
  entityType: string;
  entityName?: string;
  reason: SuggestionReason;
  priority: number;
  dismissed: boolean;
}
