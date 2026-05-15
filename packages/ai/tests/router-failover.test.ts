// AI Router — Multi-provider failover (Wave-19-N2)
//
// Wave-19 spec asks for: Provider-A times out → automatic fallback to
// Provider-B; audit-log records the selection with reason. The new
// `aiCompleteWithFailover` wrapper handles the failover; this test
// pins its contract:
//
//   1. Primary succeeds → return primary result, fallbacks not called.
//   2. Primary times out → fallback called, fallback result returned.
//   3. Primary throws → fallback called.
//   4. All providers fail → AllProvidersFailedError with per-provider
//      error details preserved (the audit-log path consumes these).
//   5. Privacy override (containsPersonalData=true) chooses Ollama as
//      the PRIMARY even if a different `provider` was requested —
//      and the failover chain still runs if Ollama dies.
//   6. onAttempt hook fires for every attempt, success and failure.

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

function ok(provider: string) {
  return { text: `from ${provider}`, provider, model: "x" };
}

describe("aiCompleteWithFailover (Wave-19-N2)", () => {
  beforeEach(() => {
    callOllamaMock.mockReset();
    callLmStudioMock.mockReset();
    callOpenAIMock.mockReset();
    callClaudeCliMock.mockReset();
    callClaudeApiMock.mockReset();
    callGeminiMock.mockReset();
  });

  afterEach(() => {
    resetEnv();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("returns primary result when primary succeeds; fallbacks NOT called", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.AI_DEFAULT_PROVIDER = "openai";
    callOpenAIMock.mockResolvedValue(ok("openai"));

    const { aiCompleteWithFailover } = await import("../src/router");
    const result = await aiCompleteWithFailover(
      { messages: [{ role: "user", content: "hi" }] },
      { fallbackProviders: ["gemini", "claude_cli"] },
    );

    expect(result.provider).toBe("openai");
    expect(callOpenAIMock).toHaveBeenCalledOnce();
    expect(callGeminiMock).not.toHaveBeenCalled();
    expect(callClaudeCliMock).not.toHaveBeenCalled();
  });

  it("falls back to next provider when primary throws", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GOOGLE_AI_API_KEY = "g-test";
    process.env.AI_DEFAULT_PROVIDER = "openai";
    callOpenAIMock.mockRejectedValue(new Error("503 service unavailable"));
    callGeminiMock.mockResolvedValue(ok("gemini"));

    const { aiCompleteWithFailover } = await import("../src/router");
    const result = await aiCompleteWithFailover(
      { messages: [{ role: "user", content: "hi" }] },
      { fallbackProviders: ["gemini"] },
    );

    expect(result.provider).toBe("gemini");
    expect(callOpenAIMock).toHaveBeenCalledOnce();
    expect(callGeminiMock).toHaveBeenCalledOnce();
  });

  it("falls back when primary times out (timeoutMs option)", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.AI_DEFAULT_PROVIDER = "openai";
    // Primary never resolves within the timeout.
    callOpenAIMock.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    callClaudeCliMock.mockResolvedValue(ok("claude_cli"));

    const { aiCompleteWithFailover } = await import("../src/router");
    const result = await aiCompleteWithFailover(
      { messages: [{ role: "user", content: "hi" }] },
      { fallbackProviders: ["claude_cli"], timeoutMs: 50 },
    );

    expect(result.provider).toBe("claude_cli");
  });

  it("throws AllProvidersFailedError with attempt details when every provider fails", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.AI_DEFAULT_PROVIDER = "openai";
    callOpenAIMock.mockRejectedValue(new Error("rate limited"));
    callGeminiMock.mockRejectedValue(new Error("invalid api key"));
    callClaudeCliMock.mockRejectedValue(new Error("CLI not installed"));

    const { aiCompleteWithFailover, AllProvidersFailedError } =
      await import("../src/router");

    await expect(
      aiCompleteWithFailover(
        { messages: [{ role: "user", content: "hi" }] },
        { fallbackProviders: ["gemini", "claude_cli"] },
      ),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);

    try {
      await aiCompleteWithFailover(
        { messages: [{ role: "user", content: "hi" }] },
        { fallbackProviders: ["gemini", "claude_cli"] },
      );
    } catch (err) {
      const e = err as InstanceType<typeof AllProvidersFailedError>;
      expect(e.attempts).toHaveLength(3);
      expect(e.attempts[0].provider).toBe("openai");
      expect(e.attempts[0].error).toContain("rate limited");
      expect(e.attempts[1].provider).toBe("gemini");
      expect(e.attempts[2].provider).toBe("claude_cli");
    }
  });

  it("privacy override: containsPersonalData routes to ollama as primary", async () => {
    resetEnv();
    process.env.OLLAMA_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-test";
    callOllamaMock.mockResolvedValue(ok("ollama"));

    const { aiCompleteWithFailover } = await import("../src/router");
    const result = await aiCompleteWithFailover(
      {
        messages: [{ role: "user", content: "patient John Doe" }],
        containsPersonalData: true,
        provider: "openai", // <-- explicitly requested but should be overridden
      },
      { fallbackProviders: ["openai"] },
    );

    expect(result.provider).toBe("ollama");
    expect(callOllamaMock).toHaveBeenCalledOnce();
    expect(callOpenAIMock).not.toHaveBeenCalled();
  });

  it("onAttempt hook fires for every attempt with success/error metadata", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.AI_DEFAULT_PROVIDER = "openai";
    callOpenAIMock.mockRejectedValue(new Error("503"));
    callGeminiMock.mockResolvedValue(ok("gemini"));

    const onAttempt = vi.fn();

    const { aiCompleteWithFailover } = await import("../src/router");
    await aiCompleteWithFailover(
      { messages: [{ role: "user", content: "hi" }] },
      { fallbackProviders: ["gemini"], onAttempt },
    );

    expect(onAttempt).toHaveBeenCalledTimes(2);
    // First attempt: openai, failure
    expect(onAttempt).toHaveBeenNthCalledWith(1, {
      provider: "openai",
      attempt: 1,
      success: false,
      error: expect.stringContaining("503"),
      elapsedMs: expect.any(Number),
    });
    // Second attempt: gemini, success
    expect(onAttempt).toHaveBeenNthCalledWith(2, {
      provider: "gemini",
      attempt: 2,
      success: true,
      elapsedMs: expect.any(Number),
    });
  });

  it("de-duplicates fallback providers when one matches the primary", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.AI_DEFAULT_PROVIDER = "openai";
    callOpenAIMock.mockRejectedValue(new Error("fail"));
    callGeminiMock.mockResolvedValue(ok("gemini"));

    const { aiCompleteWithFailover } = await import("../src/router");
    const result = await aiCompleteWithFailover(
      { messages: [{ role: "user", content: "hi" }] },
      // openai listed twice — primary + first fallback. Should run only once.
      { fallbackProviders: ["openai", "gemini"] },
    );

    expect(result.provider).toBe("gemini");
    expect(callOpenAIMock).toHaveBeenCalledOnce();
  });
});
