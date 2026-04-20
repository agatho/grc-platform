import { withAuth } from "@/lib/api";
import {
  getAvailableProviders,
  getDefaultProvider,
  DEFAULT_MODELS,
  type AiProvider,
} from "@grc/ai";

type ProviderType = "cloud" | "local" | "subscription";

interface ProviderInfo {
  key: AiProvider;
  name: string;
  type: ProviderType;
  defaultModel: string;
  configured: boolean;
  envVars: { name: string; set: boolean; hint: string }[];
  notes: string;
  homepage: string;
}

const CATALOG: Omit<ProviderInfo, "configured" | "envVars">[] = [
  {
    key: "claude_cli",
    name: "Anthropic Claude (Abo via CLI)",
    type: "subscription",
    defaultModel: DEFAULT_MODELS.claude_cli,
    notes:
      "Nutzt ein bereits eingerichtetes Claude-Abo via lokaler Claude-CLI. Kein API-Key notwendig, aber Claude-CLI muss im PATH liegen.",
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
    "Auf 'false' setzen, um den CLI-Provider komplett zu deaktivieren.",
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
  claude_cli: ["CLAUDE_CLI_ENABLED"],
  claude_api: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  gemini: ["GOOGLE_AI_API_KEY"],
  ollama: ["OLLAMA_BASE_URL", "OLLAMA_ENABLED"],
  lmstudio: ["LMSTUDIO_BASE_URL", "LMSTUDIO_ENABLED", "LMSTUDIO_DEFAULT_MODEL"],
};

export async function GET() {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const available = new Set(getAvailableProviders());
  const defaultProvider = getDefaultProvider();

  const providers: ProviderInfo[] = CATALOG.map((p) => ({
    ...p,
    configured: available.has(p.key),
    envVars: envState(PROVIDER_ENV[p.key]),
  }));

  return Response.json({
    defaultProvider,
    privacyRoutingEnabled: available.has("ollama") || available.has("lmstudio"),
    providers,
  });
}
