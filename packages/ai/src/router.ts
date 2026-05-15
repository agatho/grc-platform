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
import { callLmStudio } from "./providers/lmstudio";

const PROVIDER_FNS: Record<
  AiProvider,
  (req: AiCompletionRequest) => Promise<AiCompletionResponse>
> = {
  claude_cli: callClaudeCli,
  claude_api: callClaudeApi,
  openai: callOpenAI,
  gemini: callGemini,
  ollama: callOllama,
  lmstudio: callLmStudio,
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
  if (
    process.env.LMSTUDIO_BASE_URL ||
    process.env.LMSTUDIO_ENABLED === "true"
  ) {
    available.push("lmstudio");
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

  if (request.containsPersonalData) {
    // Privacy routing: prefer local models for personal data (GDPR Art. 5(1)(f))
    const available = getAvailableProviders();
    if (available.includes("ollama")) {
      provider = "ollama";
    } else if (available.includes("lmstudio")) {
      provider = "lmstudio";
    } else if (request.provider) {
      provider = request.provider;
    } else {
      provider = getDefaultProvider();
    }
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

// ──────────────────────────────────────────────────────────────────
// Failover wrapper (Wave-19-N2)
// ──────────────────────────────────────────────────────────────────
//
// `aiComplete` itself is single-provider — it picks one and returns
// whatever that provider returns (or throws). Wave-19 spec asks for
// multi-provider failover: if the primary provider times out or
// errors, automatically retry against a fallback list. This wrapper
// adds that without changing the existing aiComplete contract — old
// callers keep their behavior; new callers opt in.
//
// Usage:
//   await aiCompleteWithFailover(req, {
//     fallbackProviders: ["openai", "gemini", "ollama"],
//     timeoutMs: 30_000,
//   })
//
// Audit-log: each attempt is reported via the optional `onAttempt`
// callback so the route handler can persist per-attempt provider +
// outcome to the AI audit table (separate from this package).

export interface FailoverOptions {
  /** Providers to try in order if the primary attempt fails. */
  fallbackProviders?: AiProvider[];
  /** Per-attempt timeout in milliseconds. */
  timeoutMs?: number;
  /** Notification hook fired on every attempt — for audit-log. */
  onAttempt?: (event: {
    provider: AiProvider;
    attempt: number;
    success: boolean;
    error?: string;
    elapsedMs: number;
  }) => void | Promise<void>;
}

export class AllProvidersFailedError extends Error {
  constructor(
    public readonly attempts: Array<{
      provider: AiProvider;
      error: string;
    }>,
  ) {
    super(
      `All ${attempts.length} AI providers failed: ${attempts.map((a) => `${a.provider}=${a.error}`).join(", ")}`,
    );
    this.name = "AllProvidersFailedError";
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`provider timeout after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function aiCompleteWithFailover(
  request: AiCompletionRequest,
  options: FailoverOptions = {},
): Promise<AiCompletionResponse> {
  const { fallbackProviders = [], timeoutMs, onAttempt } = options;

  // Build the ordered attempt list: primary first, then fallbacks.
  // Primary is whatever aiComplete would have picked — we resolve it
  // explicitly so the audit trail records the actual provider name
  // even if the request didn't specify one.
  let primary: AiProvider;
  if (request.containsPersonalData) {
    const av = getAvailableProviders();
    primary = av.includes("ollama")
      ? "ollama"
      : av.includes("lmstudio")
        ? "lmstudio"
        : (request.provider ?? getDefaultProvider());
  } else {
    primary = request.provider ?? getDefaultProvider();
  }

  const order: AiProvider[] = [
    primary,
    ...fallbackProviders.filter((p) => p !== primary),
  ];

  const attempts: Array<{ provider: AiProvider; error: string }> = [];

  for (let i = 0; i < order.length; i++) {
    const provider = order[i];
    const fn = PROVIDER_FNS[provider];
    if (!fn) {
      attempts.push({ provider, error: "unknown_provider" });
      continue;
    }
    const start = Date.now();
    try {
      const reqWithProvider = { ...request, provider };
      const result = timeoutMs
        ? await withTimeout(fn(reqWithProvider), timeoutMs)
        : await fn(reqWithProvider);
      await onAttempt?.({
        provider,
        attempt: i + 1,
        success: true,
        elapsedMs: Date.now() - start,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push({ provider, error: msg });
      await onAttempt?.({
        provider,
        attempt: i + 1,
        success: false,
        error: msg,
        elapsedMs: Date.now() - start,
      });
      // Continue to the next provider in the fallback chain.
    }
  }

  throw new AllProvidersFailedError(attempts);
}
