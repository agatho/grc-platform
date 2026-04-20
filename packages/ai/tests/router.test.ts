import { afterEach, describe, expect, it, vi } from "vitest";
import { getAvailableProviders, getDefaultProvider } from "../src/router";
import type { AiProvider } from "../src/types";

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

afterEach(() => {
  resetEnv();
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("router availability", () => {
  it("returns claude_cli when no provider is configured and CLI is not disabled", () => {
    resetEnv();
    const available = getAvailableProviders();
    expect(available).toContain("claude_cli");
  });

  it("honours CLAUDE_CLI_ENABLED=false to drop the CLI provider", () => {
    resetEnv();
    process.env.CLAUDE_CLI_ENABLED = "false";
    const available = getAvailableProviders();
    expect(available).not.toContain("claude_cli");
  });

  it("picks up LM Studio via either LMSTUDIO_BASE_URL or LMSTUDIO_ENABLED", () => {
    resetEnv();
    process.env.LMSTUDIO_ENABLED = "true";
    expect(getAvailableProviders()).toContain("lmstudio");

    resetEnv();
    process.env.LMSTUDIO_BASE_URL = "http://localhost:1234";
    expect(getAvailableProviders()).toContain("lmstudio");
  });

  it("does not confuse Ollama and LM Studio", () => {
    resetEnv();
    process.env.OLLAMA_ENABLED = "true";
    const available = getAvailableProviders();
    expect(available).toContain("ollama");
    expect(available).not.toContain("lmstudio");
  });

  it("validates AI_DEFAULT_PROVIDER against the known list", () => {
    resetEnv();
    process.env.AI_DEFAULT_PROVIDER = "not_real" as AiProvider;
    // Falls back to first available — CLI is always on by default.
    const def = getDefaultProvider();
    expect(def).toBe("claude_cli");
  });

  it("honours a valid AI_DEFAULT_PROVIDER", () => {
    resetEnv();
    process.env.AI_DEFAULT_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    expect(getDefaultProvider()).toBe("openai");
  });

  it("placeholder ANTHROPIC_API_KEY does not count as configured — wait, actually it does", () => {
    // The router trusts env presence, not value shape. Keeping this test
    // as documentation: if you want stricter validation add it at the
    // provider call site, not in availability. Placeholder keys will fail
    // at request time — that's the right place to surface a useful error.
    resetEnv();
    process.env.ANTHROPIC_API_KEY = "sk-ant-placeholder";
    expect(getAvailableProviders()).toContain("claude_api");
  });
});
