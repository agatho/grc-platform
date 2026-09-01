// Privacy-Router edge-case tests.
//
// The existing router.test.ts covers getAvailableProviders() and
// getDefaultProvider(). What's NOT covered is the actual aiComplete()
// routing logic for personal data — the GDPR-critical branch (ADR-008).
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-01, S05-02, S05-22]
// Der Vertrag hat sich an drei Stellen geaendert; diese Datei zieht nach:
//   - containsPersonalData=true → ollama → lmstudio → SONST FEHLER.
//     Vorher fiel der Router still auf den Cloud-Default zurueck; genau
//     das war S05-01 (High).
//   - containsPersonalData=false → Wunschprovider NUR, wenn die
//     Richtlinie die Wahl freigibt (S05-22).
//   - kein konfigurierter Provider → Fehler statt claude_cli (S05-02).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callOllamaMock = vi.fn();
const callLmStudioMock = vi.fn();
const callOpenAIMock = vi.fn();
const callClaudeCliMock = vi.fn();
const callClaudeApiMock = vi.fn();
const callGeminiMock = vi.fn();

vi.mock("../src/providers/ollama", () => ({
  callOllama: (...args: unknown[]) => callOllamaMock(...args),
}));
vi.mock("../src/providers/lmstudio", () => ({
  callLmStudio: (...args: unknown[]) => callLmStudioMock(...args),
}));
vi.mock("../src/providers/openai", () => ({
  callOpenAI: (...args: unknown[]) => callOpenAIMock(...args),
}));
vi.mock("../src/providers/claude-cli", () => ({
  callClaudeCli: (...args: unknown[]) => callClaudeCliMock(...args),
}));
vi.mock("../src/providers/claude-api", () => ({
  callClaudeApi: (...args: unknown[]) => callClaudeApiMock(...args),
}));
vi.mock("../src/providers/gemini", () => ({
  callGemini: (...args: unknown[]) => callGeminiMock(...args),
}));

const ORIGINAL_ENV = { ...process.env };
function resetEnv() {
  for (const k of Object.keys(process.env)) {
    if (
      k.startsWith("ANTHROPIC_") ||
      k.startsWith("OPENAI_") ||
      k.startsWith("GOOGLE_") ||
      k.startsWith("OLLAMA_") ||
      k.startsWith("LMSTUDIO_") ||
      k.startsWith("CLAUDE_") ||
      k === "AI_DEFAULT_PROVIDER"
    ) {
      delete process.env[k];
    }
  }
}

const okResp = { text: "ok", provider: "ollama" as const };

describe("aiComplete privacy routing", () => {
  beforeEach(() => {
    callOllamaMock.mockReset().mockResolvedValue(okResp);
    callLmStudioMock
      .mockReset()
      .mockResolvedValue({ ...okResp, provider: "lmstudio" });
    callOpenAIMock
      .mockReset()
      .mockResolvedValue({ ...okResp, provider: "openai" });
    callClaudeCliMock
      .mockReset()
      .mockResolvedValue({ ...okResp, provider: "claude_cli" });
    callClaudeApiMock
      .mockReset()
      .mockResolvedValue({ ...okResp, provider: "claude_api" });
    callGeminiMock
      .mockReset()
      .mockResolvedValue({ ...okResp, provider: "gemini" });
  });

  afterEach(() => {
    resetEnv();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("routes personal data to ollama when ollama is available", async () => {
    resetEnv();
    process.env.OLLAMA_ENABLED = "true";
    process.env.CLAUDE_CLI_ENABLED = "true";
    // CLI ist freigeschaltet — ollama muss fuer personenbezogene Daten gewinnen
    const { aiComplete } = await import("../src/router");
    await aiComplete({
      messages: [{ role: "user", content: "patient John Doe" }],
      containsPersonalData: true,
    });
    expect(callOllamaMock).toHaveBeenCalledOnce();
    expect(callClaudeCliMock).not.toHaveBeenCalled();
    expect(callOpenAIMock).not.toHaveBeenCalled();
  });

  it("falls back to lmstudio when ollama is not available but lmstudio is", async () => {
    resetEnv();
    process.env.LMSTUDIO_ENABLED = "true";
    process.env.CLAUDE_CLI_ENABLED = "false";
    const { aiComplete } = await import("../src/router");
    await aiComplete({
      messages: [{ role: "user", content: "data subject Alice" }],
      containsPersonalData: true,
    });
    expect(callLmStudioMock).toHaveBeenCalledOnce();
    expect(callOllamaMock).not.toHaveBeenCalled();
  });

  it("BLOCKIERT statt auf einen ausdruecklich gewuenschten Cloud-Provider auszuweichen", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-test";
    // Auditstand: der Router blockierte NICHT, er bevorzugte nur lokal.
    // Genau daran ist S05-01 haengen geblieben.
    const { aiComplete } = await import("../src/router");
    await expect(
      aiComplete({
        messages: [{ role: "user", content: "personenbezogene daten" }],
        containsPersonalData: true,
        provider: "openai",
      }),
    ).rejects.toMatchObject({ name: "AiPolicyViolationError" });
    expect(callOpenAIMock).not.toHaveBeenCalled();
    expect(callOllamaMock).not.toHaveBeenCalled();
  });

  it("BLOCKIERT bei personenbezogenen Daten ohne lokales Modell", async () => {
    resetEnv();
    process.env.CLAUDE_CLI_ENABLED = "true";
    const { aiComplete } = await import("../src/router");
    await expect(
      aiComplete({
        messages: [{ role: "user", content: "personal" }],
        containsPersonalData: true,
      }),
    ).rejects.toMatchObject({ code: "no_local_provider" });
    expect(callClaudeCliMock).not.toHaveBeenCalled();
  });

  it("uses explicit provider when containsPersonalData is false AND die Richtlinie es erlaubt", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OLLAMA_ENABLED = "true";
    const { aiComplete, operatorPolicySnapshot } = await import("../src/router");
    await aiComplete({
      messages: [{ role: "user", content: "Hello" }],
      provider: "openai",
      policy: { ...operatorPolicySnapshot(), allowUserProviderChoice: true },
    });
    expect(callOpenAIMock).toHaveBeenCalledOnce();
    expect(callOllamaMock).not.toHaveBeenCalled();
  });

  it("uses default provider when no explicit and no personal data", async () => {
    resetEnv();
    process.env.AI_DEFAULT_PROVIDER = "gemini";
    process.env.GOOGLE_AI_API_KEY = "g-test";
    const { aiComplete } = await import("../src/router");
    await aiComplete({
      messages: [{ role: "user", content: "neutral" }],
    });
    expect(callGeminiMock).toHaveBeenCalledOnce();
  });

  it("forwards the full request unchanged to the chosen provider", async () => {
    resetEnv();
    process.env.OLLAMA_ENABLED = "true";
    const { aiComplete } = await import("../src/router");
    const req = {
      messages: [{ role: "user" as const, content: "Hi" }],
      model: "llama3:70b",
      maxTokens: 1000,
      temperature: 0.3,
      containsPersonalData: true,
    };
    await aiComplete(req);
    // Der gewaehlte Provider wird jetzt explizit mitgegeben, damit
    // Provider-Implementierung und Protokollierung dasselbe sehen.
    expect(callOllamaMock).toHaveBeenCalledWith({
      ...req,
      provider: "ollama",
    });
  });

  it("aiRouter is an alias for aiComplete (back-compat)", async () => {
    resetEnv();
    process.env.OLLAMA_ENABLED = "true";
    const mod = await import("../src/router");
    expect(mod.aiRouter).toBe(mod.aiComplete);
  });
});
