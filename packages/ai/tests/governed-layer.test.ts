// [ARCTOS-FULL-2026-08-31 / WP6]
//
// `aiCompleteGoverned` — der zentrale Aufrufpunkt. Geprueft werden die
// Zusagen, die alle 23 Routen von ihm erben:
//   * Richtlinienverstoss -> kein Providerkontakt, Protokolleintrag
//     `outcome='blocked'`
//   * unbrauchbare Ausgabe -> AiOutputInvalidError, NICHTS wird
//     zurueckgegeben, Protokolleintrag `outcome='invalid_output'`
//   * Erfolg -> Transparenzangabe mit Provider, Jurisdiktion und
//     Drittlandkennzeichen
//
// Die Protokollschreibvorgaenge laufen ueber einen eingespeisten
// `logDb`-Adapter; die Datenbank wird nicht angefasst.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callOllamaMock = vi.fn();
const callOpenAIMock = vi.fn();
const callClaudeApiMock = vi.fn();
const callClaudeCliMock = vi.fn();
const callGeminiMock = vi.fn();
const callLmStudioMock = vi.fn();

vi.mock("../src/providers/ollama", () => ({
  callOllama: (...a: unknown[]) => callOllamaMock(...a),
}));
vi.mock("../src/providers/openai", () => ({
  callOpenAI: (...a: unknown[]) => callOpenAIMock(...a),
}));
vi.mock("../src/providers/claude-api", () => ({
  callClaudeApi: (...a: unknown[]) => callClaudeApiMock(...a),
}));
vi.mock("../src/providers/claude-cli", () => ({
  callClaudeCli: (...a: unknown[]) => callClaudeCliMock(...a),
}));
vi.mock("../src/providers/gemini", () => ({
  callGemini: (...a: unknown[]) => callGeminiMock(...a),
}));
vi.mock("../src/providers/lmstudio", () => ({
  callLmStudio: (...a: unknown[]) => callLmStudioMock(...a),
}));

// `@grc/db` wird in governed.ts dynamisch importiert. Der Mock verhindert,
// dass ein Verbindungspool aufgebaut wird.
vi.mock("@grc/db", () => ({ db: { execute: vi.fn(async () => []) } }));

import { defaultPolicySnapshot } from "../src/policy";
import type { LoadedOrgAiPolicy } from "../src/org-policy";
import { z } from "zod";

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
];
const ORIGINAL: Record<string, string | undefined> = {};

function policy(over: Partial<LoadedOrgAiPolicy> = {}): LoadedOrgAiPolicy {
  return {
    ...defaultPolicySnapshot("11111111-1111-1111-1111-111111111111"),
    requireTransparencyNotice: true,
    ...over,
  };
}

/** Sammelt die Protokoll-INSERTs, statt sie in die DB zu schreiben. */
function recordingLogDb() {
  const statements: string[] = [];
  return {
    statements,
    db: {
      execute: async (q: unknown) => {
        const text = JSON.stringify(q);
        statements.push(text);
        return [{ id: "22222222-2222-2222-2222-222222222222" }];
      },
    },
  };
}

beforeEach(() => {
  for (const k of AI_ENV_KEYS) ORIGINAL[k] = process.env[k];
  for (const k of AI_ENV_KEYS) delete process.env[k];
  for (const m of [
    callOllamaMock,
    callOpenAIMock,
    callClaudeApiMock,
    callClaudeCliMock,
    callGeminiMock,
    callLmStudioMock,
  ]) {
    m.mockReset();
  }
});

afterEach(() => {
  for (const k of AI_ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(ORIGINAL)) {
    if (v !== undefined) process.env[k] = v;
  }
  vi.resetModules();
});

describe("aiCompleteGoverned", () => {
  it("blockiert und ruft KEINEN Provider auf, wenn die Richtlinie es verbietet", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { aiCompleteGoverned } = await import("../src/governed");
    const log = recordingLogDb();

    await expect(
      aiCompleteGoverned({
        feature: "ai.suggest_controls",
        orgId: "11111111-1111-1111-1111-111111111111",
        messages: [{ role: "user", content: "x" }],
        policy: policy({ egressMode: "local_only" }),
        logDb: log.db as never,
      }),
    ).rejects.toMatchObject({ name: "AiPolicyViolationError" });

    expect(callOpenAIMock).not.toHaveBeenCalled();
    // Auch der abgelehnte Aufruf wird protokolliert — der Nachweis, dass
    // fail-closed gegriffen hat, ist Teil der Nachweispflicht.
    expect(log.statements.join(" ")).toContain("ai_egress_log");
    expect(log.statements.join(" ")).toContain("blocked");
  });

  it("gibt bei schemawidriger Ausgabe NICHTS zurueck", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    callOpenAIMock.mockResolvedValue({
      text: '{"relevanceScore": "sehr hoch"}',
      provider: "openai",
      model: "gpt-4o",
    });
    const { aiCompleteGoverned } = await import("../src/governed");
    const log = recordingLogDb();

    const schema = z.object({ relevanceScore: z.number().int() });

    await expect(
      aiCompleteGoverned({
        feature: "worker.regulatory_relevance_scorer",
        orgId: "11111111-1111-1111-1111-111111111111",
        messages: [{ role: "user", content: "x" }],
        policy: policy(),
        logDb: log.db as never,
        parse: (raw) => JSON.parse(raw),
        outputSchema: schema,
      }),
    ).rejects.toMatchObject({ name: "AiOutputInvalidError" });

    expect(log.statements.join(" ")).toContain("invalid_output");
  });

  it("liefert bei Erfolg eine vollstaendige Transparenzangabe (Drittland)", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    callOpenAIMock.mockResolvedValue({
      text: '{"ok": true}',
      provider: "openai",
      model: "gpt-4o",
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    const { aiCompleteGoverned } = await import("../src/governed");
    const log = recordingLogDb();

    const result = await aiCompleteGoverned({
      feature: "ai.draft_policy",
      orgId: "11111111-1111-1111-1111-111111111111",
      messages: [{ role: "user", content: "x" }],
      policy: policy(),
      logDb: log.db as never,
      parse: (raw) => JSON.parse(raw),
      outputSchema: z.object({ ok: z.boolean() }),
    });

    expect(result.data).toEqual({ ok: true });
    expect(result.disclosure).toMatchObject({
      aiGenerated: true,
      provider: "openai",
      processing: "third_country",
      processingCountry: "US",
      thirdCountryTransfer: true,
      humanReviewRequired: true,
    });
    expect(result.disclosure.notice).toContain("OpenAI");
    // Prompt-Hash statt Prompt-Text im Protokoll.
    expect(result.promptSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(log.statements.join(" ")).not.toContain("x\\n\\n");
  });

  it("kennzeichnet lokale Verarbeitung als egress-frei", async () => {
    process.env.OLLAMA_ENABLED = "true";
    callOllamaMock.mockResolvedValue({
      text: "Antwort",
      provider: "ollama",
      model: "llama3.1:8b",
    });
    const { aiCompleteGoverned } = await import("../src/governed");
    const log = recordingLogDb();

    const result = await aiCompleteGoverned({
      feature: "dpms.ropa_draft_fields",
      orgId: "11111111-1111-1111-1111-111111111111",
      containsPersonalData: true,
      messages: [{ role: "user", content: "ROPA" }],
      policy: policy(),
      logDb: log.db as never,
    });

    expect(result.disclosure.processing).toBe("local");
    expect(result.disclosure.thirdCountryTransfer).toBe(false);
    expect(result.disclosure.notice).toContain(
      "die Installation nicht verlassen",
    );
    expect(result.data).toBe("Antwort");
  });

  it("reicht den Nutzerwunsch nur nach Richtlinienpruefung durch", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GOOGLE_AI_API_KEY = "g-test";
    const { aiCompleteGoverned } = await import("../src/governed");
    const log = recordingLogDb();

    await expect(
      aiCompleteGoverned({
        feature: "bpm.generate_bpmn",
        orgId: "11111111-1111-1111-1111-111111111111",
        messages: [{ role: "user", content: "x" }],
        requestedProvider: "gemini",
        policy: policy({ allowUserProviderChoice: false }),
        logDb: log.db as never,
      }),
    ).rejects.toMatchObject({ code: "user_choice_forbidden" });

    expect(callGeminiMock).not.toHaveBeenCalled();
  });
});
