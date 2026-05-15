// AI Router Health Endpoint (Wave-21-B1)
//
// Wave-21 QA found that there's no public health probe for the AI
// router. CLAUDE.md mentions a multi-provider router but callers had
// no way to know which providers are reachable. This test pins the
// new GET /api/v1/ai/router/health endpoint contract.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();

vi.mock("@grc/ai", () => ({
  getAvailableProviders: () => ["claude_cli", "ollama"],
  getDefaultProvider: () => "claude_cli",
  DEFAULT_MODELS: {
    claude_cli: "claude-subscription",
    claude_api: "claude-sonnet-4-20250514",
    openai: "gpt-4o",
    gemini: "gemini-2.0-flash",
    ollama: "llama3.1:8b",
    lmstudio: "local-model",
  },
  aiCompleteWithFailover: vi.fn(async () => ({
    text: "ok",
    provider: "claude_cli",
    model: "x",
  })),
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  PaginationError: class extends Error {
    constructor(
      public field: string,
      public value: string,
      public reason: string,
    ) {
      super(`pagination: ${field}`);
    }
  },
}));

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

function authedCtx() {
  return {
    session: { user: { id: VALID_UUID } },
    orgId: VALID_UUID,
    userId: VALID_UUID,
  };
}

describe("GET /api/v1/ai/router/health (Wave-21-B1)", () => {
  beforeEach(() => {
    withAuthMock.mockReset();
    withAuthMock.mockResolvedValue(authedCtx());
  });

  it("returns 200 with provider list + privacy tier routing", async () => {
    const { GET } = await import("../../app/api/v1/ai/router/health/route");
    const res = await GET(
      new Request("http://localhost/api/v1/ai/router/health"),
      undefined,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      asOf: expect.any(String),
      defaultProvider: expect.any(String),
      privacyRoutingEnabled: true,
      providers: expect.any(Array),
    });
    expect(body.data.providers.length).toBeGreaterThan(0);
    expect(body.data.privacyTierRouting).toMatchObject({
      public: expect.any(String),
      internal: expect.any(String),
      confidential: expect.any(String),
      restricted: expect.any(String),
    });
  });

  it("privacyTierRouting routes confidential to a local provider when available", async () => {
    const { GET } = await import("../../app/api/v1/ai/router/health/route");
    const res = await GET(
      new Request("http://localhost/api/v1/ai/router/health"),
      undefined,
    );
    const body = await res.json();
    // ollama is in the mocked available providers; confidential must
    // route to it (not to claude_cli or any cloud provider).
    expect(body.data.privacyTierRouting.confidential).toMatch(
      /ollama|lmstudio/,
    );
    expect(body.data.privacyTierRouting.restricted).toMatch(/ollama|lmstudio/);
  });

  it("each provider entry has name + configured + status + model", async () => {
    const { GET } = await import("../../app/api/v1/ai/router/health/route");
    const res = await GET(
      new Request("http://localhost/api/v1/ai/router/health"),
      undefined,
    );
    const body = await res.json();
    for (const p of body.data.providers) {
      expect(p).toMatchObject({
        name: expect.any(String),
        configured: expect.any(Boolean),
        status: expect.stringMatching(/healthy|degraded|unconfigured|unknown/),
        model: expect.any(String),
      });
    }
  });

  it("?probe=true triggers actual provider calls + records latency", async () => {
    const { GET } = await import("../../app/api/v1/ai/router/health/route");
    const res = await GET(
      new Request("http://localhost/api/v1/ai/router/health?probe=true"),
      undefined,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.probe).toBe(true);
    // Configured providers should have a latencyMs after probing.
    const configured = body.data.providers.filter(
      (p: { configured: boolean }) => p.configured,
    );
    for (const p of configured) {
      expect(p.latencyMs).toBeTypeOf("number");
    }
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../../app/api/v1/ai/router/health/route");
    const res = await GET(
      new Request("http://localhost/api/v1/ai/router/health"),
      undefined,
    );
    expect(res.status).toBe(401);
  });
});
