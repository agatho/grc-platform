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

import type { OrgAiPolicySnapshot } from "./policy";

export type AiProvider =
  "claude_cli" | "claude_api" | "openai" | "gemini" | "ollama" | "lmstudio";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionRequest {
  messages: AiMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /**
   * Wunsch-Provider. Wird IMMER gegen die Richtlinie geprüft
   * (`policy.ts` → `selectProvider`); ein Request-Feld allein entscheidet
   * seit WP6/S05-22 nichts mehr.
   */
  provider?: AiProvider;
  /**
   * Personenbezogene Daten im Prompt. Seit WP6/S05-01 eine BEDINGUNG,
   * keine Präferenz: ohne konfiguriertes lokales Modell scheitert der
   * Aufruf, statt in die Cloud auszuweichen.
   */
  containsPersonalData?: boolean;
  /**
   * Richtlinien-Schnappschuss der Organisation. Von
   * `aiCompleteGoverned()` gesetzt; ohne ihn gilt nur die
   * Betreiber-Ebene.
   */
  policy?: OrgAiPolicySnapshot;
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
  claude_api: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
  ollama: "llama3.1:8b",
  lmstudio: "local-model",
};
