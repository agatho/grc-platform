/**
 * AI Provider Router (ADR-008)
 *
 * Selects the appropriate AI provider based on:
 * 1. Explicit provider in request
 * 2. AI_DEFAULT_PROVIDER env var
 * 3. Privacy routing: containsPersonalData → Ollama (local)
 * 4. Fallback: first available configured provider
 */

import type {
  AiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
} from "./types";
import { callClaude } from "./providers/claude";
import { callOpenAI } from "./providers/openai";
import { callGemini } from "./providers/gemini";
import { callOllama } from "./providers/ollama";

const PROVIDER_FNS: Record<
  AiProvider,
  (req: AiCompletionRequest) => Promise<AiCompletionResponse>
> = {
  claude: callClaude,
  openai: callOpenAI,
  gemini: callGemini,
  ollama: callOllama,
};

const PROVIDER_ENV_KEYS: Record<AiProvider, string> = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GOOGLE_AI_API_KEY",
  ollama: "OLLAMA_BASE_URL",
};

/** Check which providers are configured via env vars. */
export function getAvailableProviders(): AiProvider[] {
  const available: AiProvider[] = [];
  if (process.env.ANTHROPIC_API_KEY) available.push("claude");
  if (process.env.OPENAI_API_KEY) available.push("openai");
  if (process.env.GOOGLE_AI_API_KEY) available.push("gemini");
  // Ollama is always "available" locally but check explicit config
  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_ENABLED === "true") {
    available.push("ollama");
  }
  return available;
}

/** Get the default provider from env or first available. */
export function getDefaultProvider(): AiProvider {
  const explicit = process.env.AI_DEFAULT_PROVIDER as AiProvider | undefined;
  if (explicit && PROVIDER_FNS[explicit]) return explicit;

  const available = getAvailableProviders();
  return available[0] ?? "claude";
}

/**
 * Route an AI completion request to the appropriate provider.
 *
 * Privacy routing: if containsPersonalData is true AND Ollama is available,
 * the request is routed to Ollama regardless of other settings.
 * This ensures GDPR compliance — no personal data leaves the infrastructure.
 */
export async function aiComplete(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  let provider: AiProvider;

  if (request.containsPersonalData && getAvailableProviders().includes("ollama")) {
    provider = "ollama";
  } else if (request.provider) {
    provider = request.provider;
  } else {
    provider = getDefaultProvider();
  }

  const fn = PROVIDER_FNS[provider];
  if (!fn) {
    throw new Error(`Unknown AI provider: ${provider}`);
  }

  if (provider !== "ollama" && !process.env[PROVIDER_ENV_KEYS[provider]]) {
    throw new Error(
      `AI provider '${provider}' is not configured. Set ${PROVIDER_ENV_KEYS[provider]} in .env`,
    );
  }

  return fn(request);
}

// Legacy export for backward compatibility
export { aiComplete as aiRouter };
