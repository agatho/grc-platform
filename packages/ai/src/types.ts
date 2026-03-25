/**
 * AI Provider Abstraction Layer (ADR-008)
 *
 * Supports multiple AI providers with automatic routing:
 * - Claude API (Anthropic) — default for reasoning tasks
 * - OpenAI (GPT-4o, GPT-4-turbo) — alternative cloud provider
 * - Google Gemini — alternative cloud provider
 * - Ollama — local models for privacy-sensitive data (GDPR)
 *
 * Provider selection priority:
 * 1. Explicit provider param in request
 * 2. Org-level AI_PROVIDER setting
 * 3. Privacy router: personal data → Ollama, else → configured default
 * 4. Fallback: Claude API
 */

export type AiProvider = "claude" | "openai" | "gemini" | "ollama";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionRequest {
  messages: AiMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  provider?: AiProvider;
  containsPersonalData?: boolean;
}

export interface AiCompletionResponse {
  text: string;
  provider: AiProvider;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AiProviderConfig {
  provider: AiProvider;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  enabled: boolean;
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  claude: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
  ollama: "llama3.1:8b",
};
