/**
 * AI Provider Abstraction Layer (ADR-008)
 *
 * Supported providers:
 * - Claude (via CLI) — uses Claude subscription (Pro/Team/Enterprise)
 * - OpenAI (GPT-4o, GPT-4-turbo)
 * - Google Gemini (free tier available)
 * - Ollama — local models for privacy-sensitive data (GDPR)
 *
 * Provider selection priority:
 * 1. Explicit provider param in request
 * 2. AI_DEFAULT_PROVIDER env var
 * 3. Privacy router: personal data → Ollama, else → configured default
 * 4. Fallback: first available provider
 */

export type AiProvider = "claude_cli" | "openai" | "gemini" | "ollama";

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
  claude_cli: "claude-subscription",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
  ollama: "llama3.1:8b",
};
