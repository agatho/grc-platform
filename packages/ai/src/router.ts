/**
 * AI Provider Router (ADR-008)
 */

import type {
  AiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
} from "./types";
import { callClaudeCli } from "./providers/claude-cli";
import { callClaudeApi } from "./providers/claude-api";
import { callOpenAI } from "./providers/openai";
import { callGemini } from "./providers/gemini";
import { callOllama } from "./providers/ollama";

const PROVIDER_FNS: Record<
  AiProvider,
  (req: AiCompletionRequest) => Promise<AiCompletionResponse>
> = {
  claude_cli: callClaudeCli,
  claude_api: callClaudeApi,
  openai: callOpenAI,
  gemini: callGemini,
  ollama: callOllama,
};

/** Check which providers are configured/available. */
export function getAvailableProviders(): AiProvider[] {
  const available: AiProvider[] = [];
  // Claude CLI — check if the binary exists (subscription-based, no API key)
  if (process.env.CLAUDE_CLI_ENABLED !== "false") {
    available.push("claude_cli");
  }
  if (process.env.ANTHROPIC_API_KEY) available.push("claude_api");
  if (process.env.OPENAI_API_KEY) available.push("openai");
  if (process.env.GOOGLE_AI_API_KEY) available.push("gemini");
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
  return available[0] ?? "claude_cli";
}

/**
 * Route an AI completion request to the appropriate provider.
 *
 * Privacy routing: if containsPersonalData is true AND Ollama is available,
 * the request is routed to Ollama regardless of other settings.
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

  return fn(request);
}

export { aiComplete as aiRouter };
