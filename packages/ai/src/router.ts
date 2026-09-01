/**
 * AI Provider Router (ADR-008)
 *
 * [ARCTOS-FULL-2026-08-31 / WP6 · S05-01, S05-02, S05-15]
 *
 * Zwei Verhaltensänderungen gegenüber dem Auditstand, die beide die
 * Produktzusage „keine US-Cloud-Abhängigkeit" betreffen:
 *
 *  1. **`claude_cli` ist nicht mehr voreingestellt verfügbar.** Vorher:
 *
 *         if (process.env.CLAUDE_CLI_ENABLED !== "false") available.push("claude_cli");
 *
 *     Eine Installation ohne eine einzige AI-Variable meldete damit
 *     `["claude_cli"]` und schickte jeden Prompt an Anthropic, ohne dass
 *     der Betreiber je etwas entschieden hätte. Jetzt muss der CLI-Pfad
 *     ausdrücklich freigeschaltet werden (`CLAUDE_CLI_ENABLED=true` oder
 *     `CLAUDE_CLI_PATH`). Ohne AI-Konfiguration ist die Liste leer und
 *     jede AI-Route scheitert sichtbar — das ist der gewollte Zustand.
 *
 *  2. **Kein stiller Cloud-Fallback für personenbezogene Daten.**
 *     `containsPersonalData: true` ohne lokales Modell wirft jetzt einen
 *     `AiPolicyViolationError`, statt auf den Cloud-Default auszuweichen.
 *     Dieselbe Regel gilt in `aiCompleteWithFailover` — die Privacy-
 *     Bedingung galt dort vorher nur für den ERSTEN Versuch (S05-15).
 *
 * Die org-bezogene Richtlinie (`packages/ai/src/policy.ts`) wird über das
 * optionale Feld `policy` am Request durchgereicht. Aufrufer, die einen
 * Org-Kontext haben, benutzen `aiCompleteGoverned()` aus `governed.ts`
 * und bekommen sie automatisch.
 */

import type {
  AiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
} from "./types";
import {
  AiPolicyViolationError,
  DEFAULT_LOCAL_REGION,
  providerPlacements,
  selectProvider,
  type OrgAiPolicySnapshot,
} from "./policy";
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

export const ALL_PROVIDERS: AiProvider[] = [
  "claude_cli",
  "claude_api",
  "openai",
  "gemini",
  "ollama",
  "lmstudio",
];

export function isAiProvider(v: unknown): v is AiProvider {
  return typeof v === "string" && (ALL_PROVIDERS as string[]).includes(v);
}

/** Region, in der die lokalen Modelle laufen (Default EU). */
export function localModelRegion(): string {
  return process.env.AI_LOCAL_REGION?.trim() || DEFAULT_LOCAL_REGION;
}

/**
 * Welche Provider hat der Betreiber ausdrücklich freigeschaltet?
 *
 * „Ausdrücklich" ist hier das ganze Design: kein Provider ist ohne eine
 * gesetzte Variable verfügbar — auch `claude_cli` nicht (S05-02).
 */
export function getAvailableProviders(): AiProvider[] {
  const available: AiProvider[] = [];

  // Claude CLI — Abo-basiert, kein API-Key. Muss deshalb explizit
  // eingeschaltet werden, sonst wäre "nichts konfiguriert" nicht von
  // "Cloud-Default" zu unterscheiden.
  if (
    process.env.CLAUDE_CLI_ENABLED === "true" ||
    (process.env.CLAUDE_CLI_PATH ?? "").trim().length > 0
  ) {
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

/** Lokale (egress-freie) Provider unter den konfigurierten. */
export function getLocalProviders(): AiProvider[] {
  const placements = providerPlacements(localModelRegion());
  return getAvailableProviders().filter((p) => placements[p].kind === "local");
}

/**
 * Der vom Betreiber gewünschte Default — oder `null`.
 *
 * Vorher endete diese Funktion mit `?? "claude_cli"`: sie lieferte auch
 * dann einen Cloud-Provider, wenn keiner konfiguriert war. Jetzt ist
 * „keiner" ein darstellbarer Zustand, den die Aufrufer behandeln müssen.
 */
export function getDefaultProvider(): AiProvider | null {
  const explicit = process.env.AI_DEFAULT_PROVIDER as AiProvider | undefined;
  const available = getAvailableProviders();
  if (explicit && isAiProvider(explicit) && available.includes(explicit)) {
    return explicit;
  }
  return available[0] ?? null;
}

/**
 * Richtlinien-Schnappschuss für Aufrufer ohne Org-Kontext (Systemjobs,
 * Health-Probe). Er wertet nur die Betreiber-Ebene aus; die Org-Ebene
 * liefert `org-policy.ts`.
 */
export function operatorPolicySnapshot(): OrgAiPolicySnapshot {
  return {
    orgId: "",
    egressMode: "any_configured",
    allowedProviders: [],
    allowUserProviderChoice: true,
    defaultProvider: null,
    dataResidency: null,
    residencyRules: [],
    localRegion: localModelRegion(),
    modeSource: "operator_default",
  };
}

/**
 * Route an AI completion request to a provider.
 *
 * Reihenfolge der Entscheidung:
 *   1. `request.policy` (Org-Richtlinie) — falls gesetzt, entscheidet
 *      ausschließlich `selectProvider()`. Der Nutzerwunsch
 *      (`request.provider`) wird dort gegen die Richtlinie geprüft.
 *   2. Ohne Richtlinie: Betreiber-Ebene, aber weiterhin fail-closed für
 *      `containsPersonalData`.
 */
export async function aiComplete(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const policy = request.policy ?? operatorPolicySnapshot();
  const selection = selectProvider({
    policy,
    configured: getAvailableProviders(),
    operatorDefault: getDefaultProvider(),
    requested: request.provider ?? null,
    containsPersonalData: request.containsPersonalData,
  });

  const fn = PROVIDER_FNS[selection.provider];
  if (!fn) {
    throw new Error(`Unknown AI provider: ${selection.provider}`);
  }

  // Der gewählte Provider wird explizit mitgegeben, damit die
  // Provider-Implementierung und die Protokollierung dasselbe sehen.
  return fn({ ...request, provider: selection.provider });
}

export { aiComplete as aiRouter };
export { AiPolicyViolationError };

// ──────────────────────────────────────────────────────────────────
// Failover wrapper (Wave-19-N2)
// ──────────────────────────────────────────────────────────────────
//
// [WP6 · S05-15] `fallbackProviders` wurde vorher ungefiltert an die
// Versuchsliste angehängt. Ein Timeout des lokalen Modells schickte
// damit genau die Inhalte an OpenAI, die das `containsPersonalData`-Flag
// schützen sollte. Die Liste läuft jetzt durch dieselbe
// Richtlinienprüfung wie der Erstversuch; unzulässige Fallbacks werden
// verworfen, nicht versucht.

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
  /** Fallbacks, die die Richtlinie ausschließt (nur zur Anzeige). */
  onRejectedFallback?: (provider: AiProvider, reasons: string[]) => void;
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

  const policy = request.policy ?? operatorPolicySnapshot();
  const configured = getAvailableProviders();

  // Der Erstversuch ist genau der, den aiComplete gewählt hätte —
  // inklusive Richtlinienprüfung. Wirft, wenn nichts zulässig ist.
  const primarySelection = selectProvider({
    policy,
    configured,
    operatorDefault: getDefaultProvider(),
    requested: request.provider ?? null,
    containsPersonalData: request.containsPersonalData,
  });
  const primary = primarySelection.provider;

  // Fallbacks müssen dieselbe Prüfung bestehen. `selectProvider` mit
  // `requested` liefert entweder genau diesen Provider oder wirft — der
  // Wurf wird hier in ein Verwerfen übersetzt.
  const permittedFallbacks: AiProvider[] = [];
  for (const candidate of fallbackProviders) {
    if (candidate === primary) continue;
    if (!configured.includes(candidate)) continue;
    try {
      selectProvider({
        policy: { ...policy, allowUserProviderChoice: true },
        configured,
        requested: candidate,
        containsPersonalData: request.containsPersonalData,
      });
      permittedFallbacks.push(candidate);
    } catch (err) {
      options.onRejectedFallback?.(
        candidate,
        err instanceof AiPolicyViolationError ? [err.message] : [String(err)],
      );
    }
  }

  const order: AiProvider[] = [primary, ...permittedFallbacks];
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
