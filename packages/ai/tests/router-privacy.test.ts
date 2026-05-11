// Privacy-Router edge-case tests.
//
// The existing router.test.ts covers getAvailableProviders() and
// getDefaultProvider(). What's NOT covered is the actual aiComplete()
// routing logic for personal data — the GDPR-critical branch (ADR-008).
//
// Contract under test:
//   - containsPersonalData=true → prefer ollama → lmstudio → explicit → default
//   - containsPersonalData=false → explicit > default
//   - unknown provider → throws

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
    callLmStudioMock.mockReset().mockResolvedValue({ ...okResp, provider: "lmstudio" });
    callOpenAIMock.mockReset().mockResolvedValue({ ...okResp, provider: "openai" });
    callClaudeCliMock.mockReset().mockResolvedValue({ ...okResp, provider: "claude_cli" });
    callClaudeApiMock.mockReset().mockResolvedValue({ ...okResp, provider: "claude_api" });
    callGeminiMock.mockReset().mockResolvedValue({ ...okResp, provider: "gemini" });
  });

  afterEach(() => {
    resetEnv();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("routes personal data to ollama when ollama is available", async () => {
    resetEnv();
    process.env.OLLAMA_ENABLED = "true";
    // CLI also available by default — but ollama must win for personal data
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

  it("falls back to explicit provider when no local model is available", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.CLAUDE_CLI_ENABLED = "false";
    // Note: this is the GDPR risk surface — the router does NOT block,
    // it only PREFERS local. Caller must understand this.
    const { aiComplete } = await import("../src/router");
    await aiComplete({
      messages: [{ role: "user", content: "personenbezogene daten" }],
      containsPersonalData: true,
      provider: "openai",
    });
    expect(callOpenAIMock).toHaveBeenCalledOnce();
    expect(callOllamaMock).not.toHaveBeenCalled();
  });

  it("falls back to default when personal data + no local + no explicit", async () => {
    resetEnv();
    // Only CLI available
    const { aiComplete } = await import("../src/router");
    await aiComplete({
      messages: [{ role: "user", content: "personal" }],
      containsPersonalData: true,
    });
    expect(callClaudeCliMock).toHaveBeenCalledOnce();
  });

  it("uses explicit provider when containsPersonalData is false", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OLLAMA_ENABLED = "true";
    const { aiComplete } = await import("../src/router");
    await aiComplete({
      messages: [{ role: "user", content: "Hello" }],
      provider: "openai",
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
    expect(callOllamaMock).toHaveBeenCalledWith(req);
  });

  it("aiRouter is an alias for aiComplete (back-compat)", async () => {
    resetEnv();
    process.env.OLLAMA_ENABLED = "true";
    const mod = await import("../src/router");
    expect(mod.aiRouter).toBe(mod.aiComplete);
  });
});
