// [ARCTOS-FULL-2026-08-31 / WP6 · S05-02, S05-03]
// Der Katalog nennt jetzt für jeden Provider die Verarbeitungs-
// jurisdiktion und ob die Richtlinie DIESER Organisation ihn zulässt.
// Der `CLAUDE_CLI_ENABLED`-Hinweis ist umgedreht: der CLI-Provider ist
// nicht mehr voreingestellt aktiv, er muss eingeschaltet werden.

import { withAuth } from "@/lib/api";
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
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

type ProviderType = "cloud" | "local" | "subscription";

interface ProviderInfo {
  key: AiProvider;
  name: string;
  type: ProviderType;
  defaultModel: string;
  configured: boolean;
  /** Nach der Richtlinie dieser Organisation zulässig? */
  permitted: boolean;
  /** Weshalb nicht — leer, wenn zulässig. */
  blockedReason?: string;
  processing: "local" | "third_country";
  processingCountry: string;
  processingController: string;
  envVars: { name: string; set: boolean; hint: string }[];
  notes: string;
  homepage: string;
}

type ProviderCatalogEntry = Pick<
  ProviderInfo,
  "key" | "name" | "type" | "defaultModel" | "notes" | "homepage"
>;

const CATALOG: ProviderCatalogEntry[] = [
  {
    key: "claude_cli",
    name: "Anthropic Claude (Abo via CLI)",
    type: "subscription",
    defaultModel: DEFAULT_MODELS.claude_cli,
    notes:
      "Nutzt ein bereits eingerichtetes Claude-Abo via lokaler Claude-CLI. Kein API-Key notwendig. ACHTUNG: die Verarbeitung findet bei Anthropic (US) statt — der Prompt verlässt die Installation. Muss über CLAUDE_CLI_ENABLED=true oder CLAUDE_CLI_PATH ausdrücklich aktiviert werden.",
    homepage: "https://claude.com/claude-code",
  },
  {
    key: "claude_api",
    name: "Anthropic Claude API",
    type: "cloud",
    defaultModel: DEFAULT_MODELS.claude_api,
    notes:
      "Pro-API-Schlüssel-Abrechnung über die Anthropic-API. Empfohlen für Produktion mit hohen Anforderungen an Reasoning-Qualität.",
    homepage: "https://console.anthropic.com",
  },
  {
    key: "openai",
    name: "OpenAI (ChatGPT)",
    type: "cloud",
    defaultModel: DEFAULT_MODELS.openai,
    notes:
      "OpenAI API (GPT-4o, GPT-4-turbo). Wird aktiv wenn OPENAI_API_KEY gesetzt ist.",
    homepage: "https://platform.openai.com",
  },
  {
    key: "gemini",
    name: "Google Gemini",
    type: "cloud",
    defaultModel: DEFAULT_MODELS.gemini,
    notes:
      "Google Generative AI API (Gemini 2.0 Flash, Pro). Kostenloser Tier verfügbar.",
    homepage: "https://ai.google.dev",
  },
  {
    key: "ollama",
    name: "Ollama (lokal)",
    type: "local",
    defaultModel: DEFAULT_MODELS.ollama,
    notes:
      "Lokale Inference-Engine. Ideal für personenbezogene Daten (GDPR): der Privacy-Router bevorzugt Ollama, sobald containsPersonalData=true. Keine Daten verlassen das Netzwerk.",
    homepage: "https://ollama.com",
  },
  {
    key: "lmstudio",
    name: "LM Studio (lokal, GUI)",
    type: "local",
    defaultModel: DEFAULT_MODELS.lmstudio,
    notes:
      "Lokale Inference mit grafischer Oberfläche und OpenAI-kompatibler API. Fallback für Privacy-Routing, wenn Ollama nicht verfügbar ist.",
    homepage: "https://lmstudio.ai",
  },
];

function envState(keys: string[]): ProviderInfo["envVars"] {
  return keys.map((k) => {
    const value = process.env[k];
    return {
      name: k,
      set: !!(value && value.length > 0 && value !== "sk-ant-placeholder"),
      hint: HINT[k] ?? "",
    };
  });
}

const HINT: Record<string, string> = {
  CLAUDE_CLI_ENABLED:
    "Auf 'true' setzen, um den CLI-Provider zu AKTIVIEREN. Ohne diese Variable (oder CLAUDE_CLI_PATH) ist er aus — eine Installation ohne AI-Konfiguration ruft keinen Provider auf.",
  ANTHROPIC_API_KEY: "Anthropic API-Schlüssel (beginnt mit sk-ant-).",
  OPENAI_API_KEY: "OpenAI API-Schlüssel (beginnt mit sk-).",
  GOOGLE_AI_API_KEY: "Google Generative AI API-Schlüssel.",
  OLLAMA_BASE_URL: "Typisch http://localhost:11434",
  OLLAMA_ENABLED:
    "Alternativ zu OLLAMA_BASE_URL — 'true' genügt für localhost.",
  LMSTUDIO_BASE_URL: "Typisch http://localhost:1234",
  LMSTUDIO_ENABLED: "'true' genügt, wenn localhost:1234 genutzt wird.",
  LMSTUDIO_DEFAULT_MODEL: "Default-Modellname, den LM Studio ausliefert.",
  AI_DEFAULT_PROVIDER:
    "Welcher Provider standardmäßig angesprochen wird, wenn keiner explizit gewählt ist.",
};

const PROVIDER_ENV: Record<AiProvider, string[]> = {
  claude_cli: ["CLAUDE_CLI_ENABLED", "CLAUDE_CLI_PATH"],
  claude_api: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  gemini: ["GOOGLE_AI_API_KEY"],
  ollama: ["OLLAMA_BASE_URL", "OLLAMA_ENABLED"],
  lmstudio: ["LMSTUDIO_BASE_URL", "LMSTUDIO_ENABLED", "LMSTUDIO_DEFAULT_MODEL"],
};

export const GET = withErrorHandler(async function GET() {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const policy = await loadOrgAiPolicy(ctx.orgId);
  const configuredList = getAvailableProviders();
  const available = new Set(configuredList);
  const placements = providerPlacements(localModelRegion());

  const providers: ProviderInfo[] = CATALOG.map((p) => {
    const configured = available.has(p.key);
    let permitted = false;
    let blockedReason: string | undefined;
    if (configured) {
      try {
        selectProvider({
          policy: { ...policy, allowUserProviderChoice: true },
          configured: configuredList,
          requested: p.key,
        });
        permitted = true;
      } catch (err) {
        blockedReason = err instanceof Error ? err.message : String(err);
      }
    }
    return {
      ...p,
      configured,
      permitted,
      blockedReason,
      processing: placements[p.key].kind,
      processingCountry: placements[p.key].country,
      processingController: placements[p.key].controller,
      envVars: envState(PROVIDER_ENV[p.key]),
    };
  });

  let effectiveProvider: AiProvider | null = null;
  let effectiveReason: string | null = null;
  try {
    effectiveProvider = selectProvider({
      policy,
      configured: configuredList,
      operatorDefault: getDefaultProvider(),
    }).provider;
  } catch (err) {
    effectiveReason = err instanceof Error ? err.message : String(err);
  }

  return Response.json({
    // Der Betreiber-Default ist nur noch informativ; entscheidend ist der
    // effektive Provider nach der Richtlinie der Organisation.
    operatorDefaultProvider: getDefaultProvider(),
    effectiveProvider,
    effectiveProviderBlockedReason: effectiveReason,
    egressMode: policy.egressMode,
    policySource: policy.modeSource,
    localModelsConfigured: available.has("ollama") || available.has("lmstudio"),
    providers,
  });
});
