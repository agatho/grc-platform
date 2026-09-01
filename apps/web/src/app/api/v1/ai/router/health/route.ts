// GET /api/v1/ai/router/health
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-14, S05-10]
//
// Drei Defekte des Auditstands:
//
//  1. **Die angezeigte Privacy-Matrix war erfunden.** `tierRouting()`
//     hatte `?? "ollama"` als Fallback: war Ollama NICHT konfiguriert,
//     meldete die Antwort dem Administrator trotzdem
//     `confidential: "ollama"`, während `aiComplete()` für dieselbe
//     Anfrage in die Cloud routete. Der Administrator sah eine
//     Schutzmassnahme, die es nicht gab. Die Matrix wird jetzt aus
//     `selectProvider()` abgeleitet — derselben Funktion, die im
//     Ernstfall entscheidet — und meldet ausdrücklich `null` plus den
//     Ablehnungsgrund, wenn eine Stufe nicht bedient werden kann.
//
//  2. **`?probe=true` war ein unlimitierter Kostenhebel.** Die Route war
//     mit `withAuth()` ohne Rollenliste geschützt (jeder Nutzer inkl.
//     `viewer`) und löste pro Aufruf eine Completion gegen JEDEN
//     konfigurierten Provider aus. Der Probe ist jetzt auf `admin`
//     beschränkt und hat einen eigenen Rate-Limit-Eimer.
//
//  3. **Provider-Fehlertexte an jeden Nutzer.** `p.error = err.message`
//     enthielt Ziel-URLs und interne Pfade („Claude CLI not found at
//     '/opt/…'"). Der Rohtext geht nur noch an `admin`; alle anderen
//     sehen den Status.

import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import {
  getAvailableProviders,
  getDefaultProvider,
  loadOrgAiPolicy,
  selectProvider,
  providerPlacements,
  localModelRegion,
  DEFAULT_MODELS,
  type AiProvider,
} from "@grc/ai";
import { aiRateLimit } from "../../_shared/ai-route";

interface ProviderStatus {
  name: AiProvider;
  configured: boolean;
  /** Nach der Richtlinie dieser Organisation zulässig? */
  permitted: boolean;
  placement: "local" | "third_country";
  country: string;
  status: "healthy" | "degraded" | "unconfigured" | "blocked" | "unknown";
  model: string;
  latencyMs?: number;
  error?: string;
}

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const probeRequested = url.searchParams.get("probe") === "true";
  const isAdmin = (ctx.roles ?? []).includes("admin");

  const policy = await loadOrgAiPolicy(ctx.orgId);
  const configured = new Set(getAvailableProviders());
  const configuredList = [...configured];
  const placements = providerPlacements(localModelRegion());

  const ALL: AiProvider[] = [
    "claude_cli",
    "claude_api",
    "openai",
    "gemini",
    "ollama",
    "lmstudio",
  ];

  const permit = (p: AiProvider, personalData = false): boolean => {
    if (!configured.has(p)) return false;
    try {
      selectProvider({
        policy: { ...policy, allowUserProviderChoice: true },
        configured: configuredList,
        requested: p,
        containsPersonalData: personalData,
      });
      return true;
    } catch {
      return false;
    }
  };

  const providers: ProviderStatus[] = ALL.map((p) => {
    const isConfigured = configured.has(p);
    const isPermitted = permit(p);
    return {
      name: p,
      configured: isConfigured,
      permitted: isPermitted,
      placement: placements[p].kind,
      country: placements[p].country,
      status: !isConfigured
        ? "unconfigured"
        : isPermitted
          ? "healthy"
          : "blocked",
      model: DEFAULT_MODELS[p],
    };
  });

  // Die Stufenmatrix wird AUS DER ENTSCHEIDUNGSFUNKTION abgeleitet.
  // `null` heisst: diese Stufe kann derzeit nicht bedient werden — was
  // fachlich korrekt ist und vorher als "ollama" gemeldet wurde.
  const tier = (personalData: boolean) => {
    try {
      const sel = selectProvider({
        policy,
        configured: configuredList,
        operatorDefault: getDefaultProvider(),
        containsPersonalData: personalData,
      });
      return { provider: sel.provider, placement: sel.placement.kind };
    } catch (err) {
      return {
        provider: null,
        placement: null,
        blockedReason: err instanceof Error ? err.message : String(err),
      };
    }
  };

  const publicTier = tier(false);
  const confidentialTier = tier(true);

  if (probeRequested && !isAdmin) {
    return Response.json(
      {
        error:
          "Die Liveness-Probe löst kostenpflichtige Modellaufrufe aus und ist Administratoren vorbehalten.",
      },
      { status: 403 },
    );
  }

  const probe = probeRequested && isAdmin;
  if (probe) {
    const limited = await aiRateLimit(ctx.userId, {
      bucket: "router-probe",
      capacity: 3,
      windowSeconds: 300,
    });
    if (limited) return limited;

    const { aiCompleteWithFailover } = await import("@grc/ai");
    await Promise.allSettled(
      providers
        .filter((p) => p.configured && p.permitted)
        .map(async (p) => {
          const start = Date.now();
          try {
            await aiCompleteWithFailover(
              {
                messages: [{ role: "user", content: "ping" }],
                provider: p.name,
                maxTokens: 1,
                policy: { ...policy, allowUserProviderChoice: true },
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
      egressMode: policy.egressMode,
      policySource: policy.modeSource,
      dataResidency: policy.dataResidency,
      providerChoiceAllowed: policy.allowUserProviderChoice,
      effectiveRouting: {
        // "public"/"internal": normale Fachdaten
        standard: publicTier,
        // "confidential"/"restricted": containsPersonalData = true
        personalData: confidentialTier,
      },
      privacyRoutingEffective: confidentialTier.provider !== null,
      providers,
      probe,
    },
  });
});
