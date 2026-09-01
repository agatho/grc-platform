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

// [ARCTOS-FULL-2026-08-31 / WP6 · S05-02]
// Der Vertrag hat sich umgedreht: kein Provider ist ohne ausdrueckliche
// Freischaltung verfuegbar. Vorher galt `claude_cli` als verfuegbar,
// solange `CLAUDE_CLI_ENABLED` nicht "false" war — eine Installation ohne
// eine einzige AI-Variable schickte damit jeden Prompt an Anthropic.
describe("router availability", () => {
  it("liefert OHNE AI-Variable eine leere Liste (frueher: claude_cli)", () => {
    resetEnv();
    const available = getAvailableProviders();
    expect(available).toEqual([]);
  });

  it("aktiviert die CLI nur bei CLAUDE_CLI_ENABLED=true oder CLAUDE_CLI_PATH", () => {
    resetEnv();
    process.env.CLAUDE_CLI_ENABLED = "true";
    expect(getAvailableProviders()).toContain("claude_cli");

    resetEnv();
    process.env.CLAUDE_CLI_PATH = "/usr/local/bin/claude";
    expect(getAvailableProviders()).toContain("claude_cli");

    resetEnv();
    process.env.CLAUDE_CLI_ENABLED = "false";
    expect(getAvailableProviders()).not.toContain("claude_cli");
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
    // Nichts konfiguriert -> null statt eines Cloud-Providers.
    expect(getDefaultProvider()).toBeNull();

    process.env.OLLAMA_ENABLED = "true";
    expect(getDefaultProvider()).toBe("ollama");
  });

  it("akzeptiert AI_DEFAULT_PROVIDER nur, wenn er auch konfiguriert ist", () => {
    resetEnv();
    // Frueher reichte die blosse Nennung: `PROVIDER_FNS[explicit]` war
    // wahr, und der Router waehlte einen Provider ohne Zugangsdaten.
    process.env.AI_DEFAULT_PROVIDER = "openai";
    expect(getDefaultProvider()).toBeNull();
    process.env.OPENAI_API_KEY = "sk-test";
    expect(getDefaultProvider()).toBe("openai");
  });

  it("honours a valid AI_DEFAULT_PROVIDER", () => {
    resetEnv();
    process.env.AI_DEFAULT_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    expect(getDefaultProvider()).toBe("openai");
  });

  it("placeholder ANTHROPIC_API_KEY counts as configured (Doku-Test)", () => {
    // The router trusts env presence, not value shape. Keeping this test
    // as documentation: if you want stricter validation add it at the
    // provider call site, not in availability. Placeholder keys will fail
    // at request time — that's the right place to surface a useful error.
    resetEnv();
    process.env.ANTHROPIC_API_KEY = "sk-ant-placeholder";
    expect(getAvailableProviders()).toContain("claude_api");
  });
});
