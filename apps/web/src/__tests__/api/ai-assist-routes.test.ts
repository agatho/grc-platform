// AI-Assist endpoints — RBAC + validation + AI-mock contract tests.
//
// Covers the three routes added by the AI-assist feature:
//   POST /api/v1/ai/draft-policy
//   POST /api/v1/ai/suggest-controls
//   POST /api/v1/ai/explain-gap
//
// Branches per route: 401 (unauthenticated), 422 (Zod body), 503 (no AI
// provider configured), 404 (entity not found), happy path with a mocked
// AI router, and 422 when the AI returns unparseable JSON.
//
// Pattern follows risks-create-rbac.test.ts (getter-based mocks so each
// test drives its own branch).

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { makeMockDb, chainable, type MockDb } from "./helpers/mock-context";

let mockDb: MockDb;
const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const rateLimitMock = vi.fn();
const aiCompleteMock = vi.fn();
const getAvailableProvidersMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return mockDb;
  },
  // Table stubs — imports must resolve; shapes are irrelevant because
  // the drizzle-orm helpers are no-op mocked below.
  catalog: {},
  catalogEntry: {},
  controlCatalog: {},
  controlCatalogEntry: {},
  aiPromptLog: {},
  risk: {},
  control: {},
  riskControl: {},
  soaEntry: {},
}));

vi.mock("@grc/auth", () => ({
  get requireModule() {
    return requireModuleMock;
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  withAuditContext: vi.fn(async (_ctx: unknown, fn: () => Promise<unknown>) =>
    fn(),
  ),
  paginate: vi.fn(() => ({
    page: 1,
    limit: 10,
    offset: 0,
    searchParams: new URLSearchParams(),
  })),
  paginatedResponse: vi.fn((data: unknown) =>
    Response.json({ data, total: 0, page: 1, limit: 10 }),
  ),
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("@/lib/rate-limit", () => ({
  get rateLimit() {
    return rateLimitMock;
  },
  LIMITS: {
    DEFAULT: { capacity: 300, windowSeconds: 60 },
    AI_ASSIST: { capacity: 10, windowSeconds: 60 },
    COPILOT: { capacity: 30, windowSeconds: 60 },
  },
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@grc/ai", () => ({
  get aiComplete() {
    return aiCompleteMock;
  },
  get getAvailableProviders() {
    return getAvailableProvidersMock;
  },
  // Prompt builders: minimal message arrays — the real builders are
  // covered by packages/ai/tests/ai-assist-prompts.test.ts.
  buildPolicyDraftPrompt: vi.fn(() => [
    { role: "system", content: "s" },
    { role: "user", content: "u" },
  ]),
  buildControlAdvisorPrompt: vi.fn(() => [
    { role: "system", content: "s" },
    { role: "user", content: "u" },
  ]),
  buildGapExplanationPrompt: vi.fn(() => [
    { role: "system", content: "s" },
    { role: "user", content: "u" },
  ]),
  safeJsonParse: (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  },
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    isNull: noop,
    inArray: noop,
    desc: noop,
    asc: noop,
    count: noop,
    sql: noop,
    or: noop,
  };
});

const AUTH_CTX = {
  session: { user: { id: "user-1" } },
  orgId: "org-1",
  userId: "user-1",
};

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_FOREIGN = "99999999-9999-4999-8999-999999999999";

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function aiText(obj: unknown) {
  return {
    text: JSON.stringify(obj),
    provider: "ollama",
    model: "test-model",
    usage: { inputTokens: 100, outputTokens: 200 },
  };
}

beforeEach(() => {
  mockDb = makeMockDb();
  withAuthMock.mockReset();
  requireModuleMock.mockReset();
  rateLimitMock.mockReset();
  aiCompleteMock.mockReset();
  getAvailableProvidersMock.mockReset();

  withAuthMock.mockResolvedValue(AUTH_CTX);
  requireModuleMock.mockResolvedValue(undefined);
  rateLimitMock.mockResolvedValue({
    allowed: true,
    remaining: 9,
    retryAfterSeconds: 0,
  });
  getAvailableProvidersMock.mockReturnValue(["ollama"]);
});

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/ai/draft-policy
// ─────────────────────────────────────────────────────────────────

describe("POST /api/v1/ai/draft-policy", () => {
  const validBody = {
    catalogEntryIds: [UUID_A],
    documentCategory: "policy",
    language: "de",
    context: "Test org",
  };

  beforeAll(async () => {
    await import("../../app/api/v1/ai/draft-policy/route");
  }, 90_000);

  async function call(body: unknown) {
    const { POST } = await import("../../app/api/v1/ai/draft-policy/route");
    return POST(post("http://localhost/api/v1/ai/draft-policy", body));
  }

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await call(validBody);
    expect(res.status).toBe(401);
  });

  it("gates on the dms module", async () => {
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const res = await call(validBody);
    expect(res.status).toBe(404);
    expect(requireModuleMock).toHaveBeenCalledWith("dms", "org-1", "POST");
  });

  it("returns 429 when the rate limit is exhausted", async () => {
    rateLimitMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
    });
    const res = await call(validBody);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 422 for an invalid body", async () => {
    const res = await call({
      catalogEntryIds: [],
      documentCategory: "policy",
      language: "de",
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
    expect(aiCompleteMock).not.toHaveBeenCalled();
  });

  it("returns 422 for more than 20 catalog entries", async () => {
    const res = await call({
      ...validBody,
      catalogEntryIds: Array.from({ length: 21 }, () => UUID_A),
    });
    expect(res.status).toBe(422);
  });

  it("returns 503 when no AI provider is configured", async () => {
    getAvailableProvidersMock.mockReturnValue([]);
    const res = await call(validBody);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/provider/i);
    expect(aiCompleteMock).not.toHaveBeenCalled();
  });

  it("returns 404 when no catalog entries match", async () => {
    // default mockDb select resolves to []
    const res = await call(validBody);
    expect(res.status).toBe(404);
  });

  it("returns the validated draft on the happy path", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: UUID_A,
          code: "A.5.1",
          name: "Policies for information security",
          nameDe: "Informationssicherheitsrichtlinien",
          description: "desc",
          descriptionDe: "Beschreibung",
          frameworkName: "ISO 27001:2022 Annex A",
        },
      ]),
    );
    aiCompleteMock.mockResolvedValue(
      aiText({
        title: "Informationssicherheitsrichtlinie",
        content: "## Zweck\n...",
        coveredRequirements: ["A.5.1"],
      }),
    );

    const res = await call(validBody);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.title).toBe("Informationssicherheitsrichtlinie");
    expect(json.data.coveredRequirements).toEqual(["A.5.1"]);
    expect(json.data.provider).toBe("ollama");
    // Usage was logged to ai_prompt_log
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("returns 422 when the AI response is not parseable JSON", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: UUID_A,
          code: "A.5.1",
          name: "n",
          nameDe: null,
          description: null,
          descriptionDe: null,
          frameworkName: "ISO",
        },
      ]),
    );
    aiCompleteMock.mockResolvedValue({
      text: "Sorry, I cannot produce JSON today.",
      provider: "ollama",
      model: "test-model",
    });

    const res = await call(validBody);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/unparseable|invalid/i);
  });

  it("returns 502 when the AI provider throws", async () => {
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: UUID_A,
          code: "A.5.1",
          name: "n",
          nameDe: null,
          description: null,
          descriptionDe: null,
          frameworkName: "ISO",
        },
      ]),
    );
    aiCompleteMock.mockRejectedValue(new Error("provider down"));
    const res = await call(validBody);
    expect(res.status).toBe(502);
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/ai/suggest-controls
// ─────────────────────────────────────────────────────────────────

describe("POST /api/v1/ai/suggest-controls", () => {
  const validBody = { riskId: UUID_A };

  beforeAll(async () => {
    await import("../../app/api/v1/ai/suggest-controls/route");
  }, 90_000);

  async function call(body: unknown) {
    const { POST } = await import(
      "../../app/api/v1/ai/suggest-controls/route"
    );
    return POST(post("http://localhost/api/v1/ai/suggest-controls", body));
  }

  function queueRiskAndControls() {
    // 1st select: the risk
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: UUID_A,
          title: "Ransomware attack",
          description: "Encryption of file shares",
          riskCategory: "security",
          riskScoreInherent: 20,
          riskScoreResidual: 12,
        },
      ]),
    );
    // 2nd select: already linked controls
    mockDb.select.mockReturnValueOnce(chainable([]));
    // 3rd select: org control pool
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: UUID_B,
          title: "Endpoint detection and response",
          description: "EDR on all endpoints against ransomware encryption",
          controlType: "detective",
          status: "implemented",
        },
      ]),
    );
  }

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await call(validBody);
    expect(res.status).toBe(401);
  });

  it("gates on the erm module", async () => {
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const res = await call(validBody);
    expect(res.status).toBe(404);
    expect(requireModuleMock).toHaveBeenCalledWith("erm", "org-1", "POST");
  });

  it("returns 422 for an invalid body", async () => {
    const res = await call({ riskId: "not-a-uuid" });
    expect(res.status).toBe(422);
    expect(aiCompleteMock).not.toHaveBeenCalled();
  });

  it("returns 503 when no AI provider is configured", async () => {
    getAvailableProvidersMock.mockReturnValue([]);
    const res = await call(validBody);
    expect(res.status).toBe(503);
  });

  it("returns 404 when the risk does not exist in the org", async () => {
    const res = await call(validBody);
    expect(res.status).toBe(404);
  });

  it("returns validated suggestions and drops foreign control IDs", async () => {
    queueRiskAndControls();
    aiCompleteMock.mockResolvedValue(
      aiText({
        suggestions: [
          {
            type: "link_existing",
            controlId: UUID_B,
            reason: "EDR erkennt Ransomware-Aktivität",
          },
          {
            // hallucinated ID — must be filtered server-side
            type: "link_existing",
            controlId: UUID_FOREIGN,
            reason: "made up",
          },
          {
            type: "create_new",
            title: "Offline-Backup-Konzept",
            description: "3-2-1-Backups mit Offline-Kopie",
            controlType: "corrective",
            reason: "Wiederherstellung nach Verschlüsselung",
          },
        ],
      }),
    );

    const res = await call(validBody);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.suggestions).toHaveLength(2);
    const linkSuggestion = json.data.suggestions.find(
      (s: { type: string }) => s.type === "link_existing",
    );
    expect(linkSuggestion.controlId).toBe(UUID_B);
    expect(linkSuggestion.controlTitle).toBe(
      "Endpoint detection and response",
    );
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("returns 422 when the AI response is not parseable JSON", async () => {
    queueRiskAndControls();
    aiCompleteMock.mockResolvedValue({
      text: "no json here",
      provider: "ollama",
      model: "test-model",
    });
    const res = await call(validBody);
    expect(res.status).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/ai/explain-gap
// ─────────────────────────────────────────────────────────────────

describe("POST /api/v1/ai/explain-gap", () => {
  const validBody = { soaEntryId: UUID_A };

  beforeAll(async () => {
    await import("../../app/api/v1/ai/explain-gap/route");
  }, 90_000);

  async function call(body: unknown) {
    const { POST } = await import("../../app/api/v1/ai/explain-gap/route");
    return POST(post("http://localhost/api/v1/ai/explain-gap", body));
  }

  function queueSoaAndRequirement() {
    // 1st select: SoA entry
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          id: UUID_A,
          catalogEntryId: UUID_B,
          controlId: null,
          applicability: "applicable",
          implementation: "not_implemented",
          applicabilityJustification: "in scope",
          implementationNotes: null,
        },
      ]),
    );
    // 2nd select: typed control_catalog_entry requirement
    mockDb.select.mockReturnValueOnce(
      chainable([
        {
          code: "A.8.7",
          titleDe: "Schutz vor Schadsoftware",
          titleEn: "Protection against malware",
          descriptionDe: "Beschreibung",
          descriptionEn: "Description",
          framework: "ISO 27001:2022 Annex A",
        },
      ]),
    );
  }

  it("returns 401 when not authenticated", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await call(validBody);
    expect(res.status).toBe(401);
  });

  it("gates on the isms module", async () => {
    requireModuleMock.mockResolvedValue(
      Response.json({ error: "Module disabled" }, { status: 404 }),
    );
    const res = await call(validBody);
    expect(res.status).toBe(404);
    expect(requireModuleMock).toHaveBeenCalledWith("isms", "org-1", "POST");
  });

  it("returns 422 when neither soaEntryId nor catalogEntryId is given", async () => {
    const res = await call({});
    expect(res.status).toBe(422);
  });

  it("returns 422 when both soaEntryId and catalogEntryId are given", async () => {
    const res = await call({ soaEntryId: UUID_A, catalogEntryId: UUID_B });
    expect(res.status).toBe(422);
  });

  it("returns 503 when no AI provider is configured", async () => {
    getAvailableProvidersMock.mockReturnValue([]);
    const res = await call(validBody);
    expect(res.status).toBe(503);
  });

  it("returns 404 when the SoA entry does not exist in the org", async () => {
    const res = await call(validBody);
    expect(res.status).toBe(404);
  });

  it("returns the validated explanation on the happy path", async () => {
    queueSoaAndRequirement();
    aiCompleteMock.mockResolvedValue(
      aiText({
        explanation: "A.8.7 verlangt Malware-Schutz auf allen Endpunkten.",
        suggestedSteps: ["AV/EDR ausrollen", "Signatur-Updates", "Awareness"],
        suggestedEvidence: ["EDR-Report", "Update-Log", "Schulungsnachweis"],
      }),
    );

    const res = await call(validBody);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.requirement.code).toBe("A.8.7");
    expect(json.data.suggestedSteps).toHaveLength(3);
    expect(json.data.suggestedEvidence).toHaveLength(3);
    expect(json.data.soaEntryId).toBe(UUID_A);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("returns 422 when the AI response is not parseable JSON", async () => {
    queueSoaAndRequirement();
    aiCompleteMock.mockResolvedValue({
      text: "```not json```",
      provider: "ollama",
      model: "test-model",
    });
    const res = await call(validBody);
    expect(res.status).toBe(422);
  });
});
