// GET /api/v1/ai/router/health
//
// #WAVE21-B1: Wave-21 QA verified that there's no public health probe
// for the AI router. CLAUDE.md mentions a multi-provider router but
// callers had no way to know which providers are reachable, what the
// privacy-tier routing looks like, or when the last failover happened.
//
// Returns provider availability + a privacy-tier routing map +
// last-failover timestamp (best-effort from in-process state). The
// response is read-only; a deeper "synthesise a 1-token completion"
// liveness probe lives behind a `?probe=true` query string and runs
// against each available provider, returning latency or the error
// string per provider.
//
// Auth: any authenticated user can read. The route does not expose
// API keys or secrets — only configured/healthy/degraded labels.

import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import {
  getAvailableProviders,
  getDefaultProvider,
  DEFAULT_MODELS,
  type AiProvider,
} from "@grc/ai";

interface ProviderStatus {
  name: AiProvider;
  configured: boolean;
  status: "healthy" | "degraded" | "unconfigured" | "unknown";
  model: string;
  latencyMs?: number;
  error?: string;
}

// Privacy-tier routing matrix mirrors packages/ai/src/router.ts —
// confidential / restricted route to a local model when available.
function tierRouting(available: Set<AiProvider>): Record<string, AiProvider> {
  const localPreferred: AiProvider[] = ["ollama", "lmstudio"];
  const cloudPreferred: AiProvider[] = [
    "claude_cli",
    "claude_api",
    "openai",
    "gemini",
  ];
  const local = localPreferred.find((p) => available.has(p)) ?? "ollama";
  const cloud = cloudPreferred.find((p) => available.has(p)) ?? "claude_cli";
  return {
    public: cloud,
    internal: cloud,
    confidential: local,
    restricted: local,
  };
}

// In-process last-failover timestamp. The failover wrapper in
// packages/ai/src/router.ts can write here on every fall-back; for
// now we just expose a static field so the response shape is stable.
// A future PR can wire the wrapper's onAttempt callback to update it.
const lastFailover: { at: string | null } = { at: null };

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const available = new Set(getAvailableProviders());
  const defaultProvider = getDefaultProvider();
  const url = new URL(req.url);
  const probe = url.searchParams.get("probe") === "true";

  const ALL: AiProvider[] = [
    "claude_cli",
    "claude_api",
    "openai",
    "gemini",
    "ollama",
    "lmstudio",
  ];

  const providers: ProviderStatus[] = ALL.map((p) => ({
    name: p,
    configured: available.has(p),
    // Without an active probe, "configured" is the closest we can get
    // to "healthy" — env-var presence implies the provider should work.
    // The deep ?probe=true variant overrides this with an actual call.
    status: available.has(p) ? "healthy" : "unconfigured",
    model: DEFAULT_MODELS[p],
  }));

  if (probe) {
    // Optional liveness probe — run a 1-token completion per provider
    // and time it. Wrapped in Promise.allSettled so one slow provider
    // doesn't gate the response. Each probe carries a hard 5s timeout.
    const { aiCompleteWithFailover } = await import("@grc/ai");
    await Promise.allSettled(
      providers
        .filter((p) => p.configured)
        .map(async (p) => {
          const start = Date.now();
          try {
            await aiCompleteWithFailover(
              {
                messages: [{ role: "user", content: "ping" }],
                provider: p.name,
                maxTokens: 1,
              },
              { timeoutMs: 5_000 },
            );
            p.latencyMs = Date.now() - start;
            p.status = p.latencyMs > 2_000 ? "degraded" : "healthy";
          } catch (err) {
            p.status = "degraded";
            p.error = err instanceof Error ? err.message : String(err);
            p.latencyMs = Date.now() - start;
          }
        }),
    );
  }

  return Response.json({
    data: {
      asOf: new Date().toISOString(),
      defaultProvider,
      privacyRoutingEnabled:
        available.has("ollama") || available.has("lmstudio"),
      privacyTierRouting: tierRouting(available),
      providers,
      lastFailover: lastFailover.at,
      probe,
    },
  });
});
