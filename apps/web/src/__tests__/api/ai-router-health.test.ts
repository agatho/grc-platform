// AI Router Health Endpoint (Wave-21-B1)
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-14, S05-10]
//
// Der Vertrag dieser Route hat sich an drei Stellen geändert; diese Datei
// zieht nach und pinnt die neue Zusage:
//
//  1. `privacyTierRouting` gibt es nicht mehr. Die alte Matrix war
//     erfunden: `localPreferred.find(...) ?? "ollama"` meldete
//     `confidential: "ollama"` auch dann, wenn Ollama gar nicht
//     konfiguriert war — während `aiComplete()` für dieselbe Anfrage in
//     die Cloud routete. Ersetzt durch `effectiveRouting`, das aus
//     `selectProvider()` abgeleitet wird (derselben Funktion, die im
//     Ernstfall entscheidet) und `null` **plus Grund** meldet, wenn eine
//     Stufe nicht bedient werden kann.
//  2. `?probe=true` ist admin-only. Vorher löste jeder authentifizierte
//     Nutzer inkl. `viewer` eine Completion gegen JEDEN konfigurierten
//     Provider aus.
//  3. Provider-Fehlertexte gehen nur an `admin`.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const rateLimitMock = vi.fn();
const aiCompleteWithFailoverMock = vi.fn(async () => ({
  text: "ok",
  provider: "ollama",
  model: "x",
}));

vi.mock("@grc/ai", async () => {
  const actual = await vi.importActual<typeof import("@grc/ai")>("@grc/ai");
  return {
    ...actual,
    getAvailableProviders: () => ["claude_cli", "ollama"],
    getDefaultProvider: () => "claude_cli",
    loadOrgAiPolicy: async (orgId: string) => ({
      ...actual.defaultPolicySnapshot(orgId),
      requireTransparencyNotice: true,
    }),
    aiCompleteWithFailover: aiCompleteWithFailoverMock,
  };
});

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

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...a),
  LIMITS: { AI_ASSIST: { capacity: 10, windowSeconds: 60 } },
  getClientIp: () => "127.0.0.1",
}));

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

function authedCtx(roles: string[] = []) {
  return {
    session: { user: { id: VALID_UUID } },
    orgId: VALID_UUID,
    userId: VALID_UUID,
    roles,
  };
}

async function callHealth(url: string) {
  const { GET } = await import("../../app/api/v1/ai/router/health/route");
  return GET(new Request(url), undefined as never);
}

describe("GET /api/v1/ai/router/health", () => {
  beforeEach(() => {
    withAuthMock.mockReset();
    withAuthMock.mockResolvedValue(authedCtx(["admin"]));
    rateLimitMock.mockReset();
    rateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterSeconds: 0,
    });
    aiCompleteWithFailoverMock.mockClear();
  });

  it("returns 200 with provider list + effective routing", async () => {
    const res = await callHealth("http://localhost/api/v1/ai/router/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      asOf: expect.any(String),
      egressMode: expect.any(String),
      providers: expect.any(Array),
    });
    expect(body.data.providers.length).toBeGreaterThan(0);
    expect(body.data.effectiveRouting).toMatchObject({
      standard: expect.any(Object),
      personalData: expect.any(Object),
    });
  });

  it("routet personenbezogene Daten auf ein lokales Modell, wenn eines da ist", async () => {
    const res = await callHealth("http://localhost/api/v1/ai/router/health");
    const body = await res.json();
    expect(body.data.effectiveRouting.personalData.provider).toMatch(
      /ollama|lmstudio/,
    );
    expect(body.data.effectiveRouting.personalData.placement).toBe("local");
    expect(body.data.privacyRoutingEffective).toBe(true);
  });

  it("jeder Providereintrag nennt Status, Zulässigkeit und Jurisdiktion", async () => {
    const res = await callHealth("http://localhost/api/v1/ai/router/health");
    const body = await res.json();
    for (const p of body.data.providers) {
      expect(p).toMatchObject({
        name: expect.any(String),
        configured: expect.any(Boolean),
        permitted: expect.any(Boolean),
        placement: expect.stringMatching(/local|third_country/),
        country: expect.any(String),
        status: expect.stringMatching(
          /healthy|degraded|unconfigured|blocked|unknown/,
        ),
        model: expect.any(String),
      });
    }
  });

  it("?probe=true ist Administratoren vorbehalten (S05-10)", async () => {
    withAuthMock.mockResolvedValue(authedCtx(["viewer"]));
    const res = await callHealth(
      "http://localhost/api/v1/ai/router/health?probe=true",
    );
    expect(res.status).toBe(403);
    // Kein einziger Providerkontakt für einen Nicht-Admin.
    expect(aiCompleteWithFailoverMock).not.toHaveBeenCalled();
  });

  it("?probe=true als admin misst Latenz je zulässigem Provider", async () => {
    const res = await callHealth(
      "http://localhost/api/v1/ai/router/health?probe=true",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.probe).toBe(true);
    const probed = body.data.providers.filter(
      (p: { configured: boolean; permitted: boolean }) =>
        p.configured && p.permitted,
    );
    expect(probed.length).toBeGreaterThan(0);
    for (const p of probed) {
      expect(p.latencyMs).toBeTypeOf("number");
    }
  });

  it("?probe=true respektiert das Rate-Limit", async () => {
    rateLimitMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 42,
    });
    const res = await callHealth(
      "http://localhost/api/v1/ai/router/health?probe=true",
    );
    expect(res.status).toBe(429);
    expect(aiCompleteWithFailoverMock).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await callHealth("http://localhost/api/v1/ai/router/health");
    expect(res.status).toBe(401);
  });
});
