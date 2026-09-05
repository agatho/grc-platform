// [ARCTOS-FULL-2026-08-31 / WP6] Abnahmetests der Data-Sovereignty-Zusage.
//
// Diese Datei deckt die beiden Abnahmekriterien des Arbeitspakets ab:
//   1. Org-Richtlinie „nur lokal" + kein lokales Modell → KEIN Cloud-Aufruf,
//      Request scheitert sichtbar.
//   2. Ein Nutzer kann keinen Provider wählen, den die Richtlinie ausschliesst.
//
// Es werden ausschliesslich die Provider-Funktionen gemockt; es gibt in
// dieser Datei keinen einzigen echten Netzwerkaufruf. Der Nachweis „kein
// Cloud-Aufruf" ist deshalb hart: die Mocks zählen die Aufrufe.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callOllamaMock = vi.fn();
const callLmStudioMock = vi.fn();
const callOpenAIMock = vi.fn();
const callClaudeCliMock = vi.fn();
const callClaudeApiMock = vi.fn();
const callGeminiMock = vi.fn();

vi.mock("../src/providers/ollama", () => ({
  callOllama: (...a: unknown[]) => callOllamaMock(...a),
}));
vi.mock("../src/providers/lmstudio", () => ({
  callLmStudio: (...a: unknown[]) => callLmStudioMock(...a),
}));
vi.mock("../src/providers/openai", () => ({
  callOpenAI: (...a: unknown[]) => callOpenAIMock(...a),
}));
vi.mock("../src/providers/claude-cli", () => ({
  callClaudeCli: (...a: unknown[]) => callClaudeCliMock(...a),
}));
vi.mock("../src/providers/claude-api", () => ({
  callClaudeApi: (...a: unknown[]) => callClaudeApiMock(...a),
}));
vi.mock("../src/providers/gemini", () => ({
  callGemini: (...a: unknown[]) => callGeminiMock(...a),
}));

import {
  defaultPolicySnapshot,
  evaluateProvider,
  modeFromDataResidency,
  selectProvider,
  type OrgAiPolicySnapshot,
} from "../src/policy";

const AI_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "OLLAMA_BASE_URL",
  "OLLAMA_ENABLED",
  "LMSTUDIO_BASE_URL",
  "LMSTUDIO_ENABLED",
  "CLAUDE_CLI_ENABLED",
  "CLAUDE_CLI_PATH",
  "AI_DEFAULT_PROVIDER",
  "AI_LOCAL_REGION",
];

const ORIGINAL: Record<string, string | undefined> = {};

function resetEnv() {
  for (const k of AI_ENV_KEYS) delete process.env[k];
}

function policy(over: Partial<OrgAiPolicySnapshot> = {}): OrgAiPolicySnapshot {
  return { ...defaultPolicySnapshot("org-a"), ...over };
}

function allProviderMocks() {
  return [
    callOllamaMock,
    callLmStudioMock,
    callOpenAIMock,
    callClaudeCliMock,
    callClaudeApiMock,
    callGeminiMock,
  ];
}

function cloudProviderMocks() {
  return [callOpenAIMock, callClaudeCliMock, callClaudeApiMock, callGeminiMock];
}

beforeEach(() => {
  for (const k of AI_ENV_KEYS) ORIGINAL[k] = process.env[k];
  resetEnv();
  for (const m of allProviderMocks()) {
    m.mockReset().mockResolvedValue({
      text: "ok",
      provider: "mock",
      model: "mock",
    });
  }
});

afterEach(() => {
  resetEnv();
  for (const [k, v] of Object.entries(ORIGINAL)) {
    if (v !== undefined) process.env[k] = v;
  }
  vi.resetModules();
});

describe("Verfügbarkeit — kein Provider ohne Betreiberentscheidung (S05-02)", () => {
  it("meldet OHNE jede AI-Variable eine LEERE Providerliste", async () => {
    const { getAvailableProviders, getDefaultProvider } =
      await import("../src/router");
    // Auditstand: ["claude_cli"] — jeder Prompt ging ohne Betreiber-
    // entscheidung an Anthropic.
    expect(getAvailableProviders()).toEqual([]);
    expect(getDefaultProvider()).toBeNull();
  });

  it("aktiviert claude_cli nur bei ausdrücklicher Freischaltung", async () => {
    const { getAvailableProviders } = await import("../src/router");
    process.env.CLAUDE_CLI_ENABLED = "true";
    expect(getAvailableProviders()).toContain("claude_cli");

    resetEnv();
    process.env.CLAUDE_CLI_PATH = "/opt/claude/bin/claude";
    expect(getAvailableProviders()).toContain("claude_cli");

    resetEnv();
    // Der alte Schalter "nicht false" reicht ausdrücklich NICHT mehr.
    process.env.CLAUDE_CLI_ENABLED = "yes";
    expect(getAvailableProviders()).not.toContain("claude_cli");
  });

  it("scheitert sichtbar, wenn gar kein Provider konfiguriert ist", async () => {
    const { aiComplete } = await import("../src/router");
    await expect(
      aiComplete({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({
      name: "AiPolicyViolationError",
      code: "no_provider_configured",
    });
    for (const m of allProviderMocks()) expect(m).not.toHaveBeenCalled();
  });
});

describe("Abnahmekriterium 1 — local_only ohne lokales Modell schlägt fehl", () => {
  it("macht KEINEN Cloud-Aufruf und wirft", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GOOGLE_AI_API_KEY = "g-test";
    process.env.CLAUDE_CLI_ENABLED = "true";
    // Kein OLLAMA_*, kein LMSTUDIO_* → kein lokales Modell.

    const { aiComplete } = await import("../src/router");

    await expect(
      aiComplete({
        messages: [{ role: "user", content: "Art.-30-Verzeichnistext" }],
        policy: policy({ egressMode: "local_only" }),
      }),
      // Kein `toBeInstanceOf`: `vi.resetModules()` erzeugt je Test eine
      // frische Modulinstanz, die Klassenidentität ist damit nicht stabil.
    ).rejects.toMatchObject({
      name: "AiPolicyViolationError",
      code: "no_permitted_provider",
    });

    for (const m of cloudProviderMocks()) {
      expect(m).not.toHaveBeenCalled();
    }
    expect(callOllamaMock).not.toHaveBeenCalled();
    expect(callLmStudioMock).not.toHaveBeenCalled();
  });

  it("nennt den Grund und die Richtlinie im Fehler", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { aiComplete } = await import("../src/router");
    const err = await aiComplete({
      messages: [{ role: "user", content: "x" }],
      policy: policy({ egressMode: "local_only" }),
    }).catch((e) => e);

    expect(err.name).toBe("AiPolicyViolationError");
    expect(err.code).toBe("no_permitted_provider");
    expect(err.egressMode).toBe("local_only");
    expect(String(err.message)).toContain("local_only");
  });

  it("routet mit lokalem Modell wieder normal", async () => {
    process.env.OLLAMA_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test";
    const { aiComplete } = await import("../src/router");
    await aiComplete({
      messages: [{ role: "user", content: "x" }],
      policy: policy({ egressMode: "local_only" }),
    });
    expect(callOllamaMock).toHaveBeenCalledOnce();
    expect(callOpenAIMock).not.toHaveBeenCalled();
  });
});

describe("S05-01 — containsPersonalData fällt nicht mehr still in die Cloud", () => {
  it("wirft statt auf den Cloud-Default auszuweichen", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { aiComplete } = await import("../src/router");

    // Auditstand (Szenario 6 der Egress-Matrix):
    //   containsPersonalData=true -> claude_api  <-- VERLAESST DIE INSTALLATION
    await expect(
      aiComplete({
        messages: [{ role: "user", content: "ROPA-Text" }],
        containsPersonalData: true,
      }),
    ).rejects.toMatchObject({ code: "no_local_provider" });

    expect(callClaudeApiMock).not.toHaveBeenCalled();
  });

  it("wirft auch dann, wenn der Aufrufer einen Cloud-Provider erzwingen will", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { aiComplete } = await import("../src/router");
    await expect(
      aiComplete({
        messages: [{ role: "user", content: "DSFA-Inhalt" }],
        containsPersonalData: true,
        provider: "openai",
        policy: policy({ allowUserProviderChoice: true }),
      }),
    ).rejects.toMatchObject({ code: "no_local_provider" });
    expect(callOpenAIMock).not.toHaveBeenCalled();
  });

  it("nutzt das lokale Modell, sobald eines konfiguriert ist", async () => {
    process.env.OLLAMA_ENABLED = "true";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { aiComplete } = await import("../src/router");
    await aiComplete({
      messages: [{ role: "user", content: "ROPA" }],
      containsPersonalData: true,
    });
    expect(callOllamaMock).toHaveBeenCalledOnce();
    expect(callClaudeApiMock).not.toHaveBeenCalled();
  });
});

describe("Abnahmekriterium 2 — Nutzer kann die Richtlinie nicht umgehen (S05-22)", () => {
  it("lehnt jede Providerwahl ab, solange sie nicht freigegeben ist", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GOOGLE_AI_API_KEY = "g-test";
    const { aiComplete } = await import("../src/router");

    await expect(
      aiComplete({
        messages: [{ role: "user", content: "Prozessbeschreibung" }],
        provider: "gemini",
        policy: policy({ allowUserProviderChoice: false }),
      }),
    ).rejects.toMatchObject({ code: "user_choice_forbidden" });

    expect(callGeminiMock).not.toHaveBeenCalled();
  });

  it("lehnt einen freigegebenen, aber richtlinienwidrigen Provider ab", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OLLAMA_ENABLED = "true";
    const { aiComplete } = await import("../src/router");

    await expect(
      aiComplete({
        messages: [{ role: "user", content: "x" }],
        provider: "openai",
        policy: policy({
          allowUserProviderChoice: true,
          egressMode: "eu_only",
        }),
      }),
    ).rejects.toMatchObject({ code: "provider_not_permitted" });

    expect(callOpenAIMock).not.toHaveBeenCalled();
  });

  it("lehnt einen Provider ausserhalb der Org-Allowlist ab", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GOOGLE_AI_API_KEY = "g-test";
    const { aiComplete } = await import("../src/router");

    await expect(
      aiComplete({
        messages: [{ role: "user", content: "x" }],
        provider: "gemini",
        policy: policy({
          allowUserProviderChoice: true,
          allowedProviders: ["openai"],
        }),
      }),
    ).rejects.toMatchObject({ code: "provider_not_permitted" });
    expect(callGeminiMock).not.toHaveBeenCalled();
  });

  it("lässt eine zulässige Wahl durch", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { aiComplete } = await import("../src/router");
    await aiComplete({
      messages: [{ role: "user", content: "x" }],
      provider: "openai",
      policy: policy({ allowUserProviderChoice: true }),
    });
    expect(callOpenAIMock).toHaveBeenCalledOnce();
  });
});

describe("S05-03 — data_residency und data_residency_rule werden ausgewertet", () => {
  it("leitet aus einem EU-Ländercode den Modus eu_only ab", () => {
    expect(modeFromDataResidency("DE")).toEqual({
      mode: "eu_only",
      source: "data_residency",
    });
    expect(modeFromDataResidency("FR").mode).toBe("eu_only");
    expect(modeFromDataResidency("CH").mode).toBe("eu_only");
    expect(modeFromDataResidency("US").mode).toBe("any_configured");
    expect(modeFromDataResidency(null).mode).toBe("any_configured");
  });

  it("blockiert Drittlandprovider unter eu_only, lässt lokale zu", () => {
    const p = policy({ egressMode: "eu_only" });
    expect(evaluateProvider("openai", p).allowed).toBe(false);
    expect(evaluateProvider("claude_api", p).allowed).toBe(false);
    expect(evaluateProvider("gemini", p).allowed).toBe(false);
    expect(evaluateProvider("claude_cli", p).allowed).toBe(false);
    expect(evaluateProvider("ollama", p).allowed).toBe(true);
    expect(evaluateProvider("lmstudio", p).allowed).toBe(true);
  });

  it("wertet eine processing-Regel mit deniedRegions aus (Szenario der französischen Tochter)", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GOOGLE_AI_API_KEY = "g-test";
    const { aiComplete } = await import("../src/router");

    const p = policy({
      egressMode: "any_configured",
      residencyRules: [
        {
          name: "Keine Verarbeitung ausserhalb der EU",
          allowedRegions: [],
          deniedRegions: ["us_east"],
          isEnforced: true,
          violationAction: "block",
        },
      ],
    });

    await expect(
      aiComplete({ messages: [{ role: "user", content: "x" }], policy: p }),
    ).rejects.toMatchObject({ code: "no_permitted_provider" });
    expect(callOpenAIMock).not.toHaveBeenCalled();
    expect(callGeminiMock).not.toHaveBeenCalled();
  });

  it("ignoriert eine Regel mit isEnforced = false", () => {
    const p = policy({
      residencyRules: [
        {
          name: "Entwurf",
          allowedRegions: [],
          deniedRegions: ["us_east"],
          isEnforced: false,
          violationAction: "block",
        },
      ],
    });
    expect(evaluateProvider("openai", p).allowed).toBe(true);
  });

  it("meldet violation_action <> block als Warnung statt als Ablehnung", () => {
    const p = policy({
      residencyRules: [
        {
          name: "Nur protokollieren",
          allowedRegions: [],
          deniedRegions: ["us_east"],
          isEnforced: true,
          violationAction: "warn",
        },
      ],
    });
    const verdict = evaluateProvider("openai", p);
    expect(verdict.allowed).toBe(true);
    expect(verdict.warnings.join(" ")).toContain("Nur protokollieren");
  });

  it("schaltet KI-Funktionen für egress_mode = disabled vollständig ab", async () => {
    process.env.OLLAMA_ENABLED = "true";
    const { aiComplete } = await import("../src/router");
    await expect(
      aiComplete({
        messages: [{ role: "user", content: "x" }],
        policy: policy({ egressMode: "disabled" }),
      }),
    ).rejects.toMatchObject({ code: "ai_disabled" });
    expect(callOllamaMock).not.toHaveBeenCalled();
  });
});

describe("S05-15 — Failover hängt keine unzulässigen Provider an", () => {
  it("verwirft Cloud-Fallbacks bei containsPersonalData", async () => {
    process.env.OLLAMA_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GOOGLE_AI_API_KEY = "g-test";

    callOllamaMock.mockRejectedValue(new Error("provider timeout after 100ms"));

    const { aiCompleteWithFailover } = await import("../src/router");
    const rejected: string[] = [];

    await expect(
      aiCompleteWithFailover(
        {
          messages: [{ role: "user", content: "personenbezogene Daten" }],
          containsPersonalData: true,
        },
        {
          // Genau die Beispielverwendung aus dem Kommentar des Auditstands.
          fallbackProviders: ["openai", "gemini", "ollama"],
          onRejectedFallback: (p) => rejected.push(p),
        },
      ),
    ).rejects.toThrow(/All 1 AI providers failed/);

    expect(callOpenAIMock).not.toHaveBeenCalled();
    expect(callGeminiMock).not.toHaveBeenCalled();
    expect(rejected.sort()).toEqual(["gemini", "openai"]);
  });

  it("nutzt einen zulässigen Fallback weiterhin", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GOOGLE_AI_API_KEY = "g-test";
    callOpenAIMock.mockRejectedValue(new Error("503"));

    const { aiCompleteWithFailover } = await import("../src/router");
    await aiCompleteWithFailover(
      {
        messages: [{ role: "user", content: "x" }],
        provider: "openai",
        policy: policy({ allowUserProviderChoice: true }),
      },
      { fallbackProviders: ["gemini"] },
    );
    expect(callGeminiMock).toHaveBeenCalledOnce();
  });
});

describe("selectProvider — Auswahlreihenfolge", () => {
  it("bevorzugt lokale Modelle, wenn kein Default gesetzt ist", () => {
    const sel = selectProvider({
      policy: policy(),
      configured: ["openai", "ollama"],
    });
    expect(sel.provider).toBe("ollama");
    expect(sel.reason).toBe("only_permitted");
  });

  it("respektiert den Org-Default vor dem Betreiber-Default", () => {
    const sel = selectProvider({
      policy: policy({ defaultProvider: "gemini" }),
      configured: ["openai", "gemini"],
      operatorDefault: "openai",
    });
    expect(sel.provider).toBe("gemini");
    expect(sel.reason).toBe("policy_default");
  });

  it("liefert die Jurisdiktion des gewählten Providers mit", () => {
    const sel = selectProvider({
      policy: policy(),
      configured: ["openai"],
    });
    expect(sel.placement.kind).toBe("third_country");
    expect(sel.placement.country).toBe("US");
    expect(sel.placement.controller).toContain("OpenAI");
  });

  it("erklärt lokale Modelle als egress-frei", () => {
    const sel = selectProvider({ policy: policy(), configured: ["ollama"] });
    expect(sel.placement.kind).toBe("local");
    expect(sel.placement.regions).toEqual(["eu_central"]);
  });
});
