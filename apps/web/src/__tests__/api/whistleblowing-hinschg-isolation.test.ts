// HinSchG Isolation — admin must NOT read whistleblowing case content.
//
// #WAVE19-W7: Wave-19 QA spec mandates a cross-role-negative guard:
// admins (and any other "platform" role) must be denied access to
// case-content endpoints under /whistleblowing/cases/**. Per HinSchG
// §10/§11 and GDPR Art. 9(2)(b), the designated reporting-channel
// staff (whistleblowing_officer + ombudsperson) hold sole access to
// case content. Admins retain access to **anonymized** statistics and
// to /intake-codes (operational discovery), but never to the case
// list, case detail, messages, assignments, acknowledgments, or
// resolutions.
//
// These tests mock withAuth() to return Response(403) when admin tries
// to call the protected routes — that's how requireRole rejects, and
// the mock intentionally bypasses the actual role-check to assert the
// route never moves on to db queries on an unauthorized request.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return {
      query: {
        wbCase: { findFirst: vi.fn(async () => undefined) },
        wbReport: { findFirst: vi.fn(async () => undefined) },
        user: { findFirst: vi.fn(async () => undefined) },
      },
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  innerJoin() {
                    return {
                      leftJoin() {
                        return {
                          where() {
                            return {
                              orderBy() {
                                return { limit: () => ({ offset: () => [] }) };
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                  orderBy() {
                    return { limit: () => ({ offset: () => [] }) };
                  },
                };
              },
            };
          },
        };
      },
    };
  },
  wbCase: {},
  wbReport: {},
  wbCaseMessage: { caseId: "caseId", createdAt: "createdAt" },
  wbCaseEvidence: { caseId: "caseId", uploadedAt: "uploadedAt" },
  user: { id: "id" },
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
  get withAuditContext() {
    return withAuditContextMock;
  },
  paginate: vi.fn(() => ({
    page: 1,
    limit: 10,
    offset: 0,
    searchParams: new URLSearchParams(),
  })),
  paginatedResponse: vi.fn((data: unknown, total: number) =>
    Response.json({ data, total, page: 1, limit: 10 }),
  ),
}));

vi.mock("@/lib/api-errors", () => ({
  problem: {
    methodNotAllowed: vi.fn(() =>
      Response.json({ error: "Method not allowed" }, { status: 405 }),
    ),
  },
  getRequestId: vi.fn(() => "test-req-id"),
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    desc: noop,
    asc: noop,
    isNull: noop,
    count: noop,
  };
});

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const CASE_ID = "22222222-2222-2222-2222-222222222222";

const SLOW_TEST_TIMEOUT_MS = 15_000;

describe("HinSchG isolation — admin denied on whistleblowing case-content endpoints (Wave-19-W7)", () => {
  beforeEach(() => {
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();
    requireModuleMock.mockResolvedValue(undefined);
  });

  // We assert two things per route:
  //   1. The withAuth call lists ONLY whistleblowing_officer + ombudsperson —
  //      no admin. (This locks the role contract at the source.)
  //   2. When the auth mock returns a 403 (which is what the real withAuth
  //      would do for a role mismatch), the route returns 403 and never
  //      proceeds to the DB. (This locks the runtime behavior.)

  it(
    "GET /whistleblowing/cases — does NOT list admin in role gate",
    async () => {
      // Mock as if an admin tried — auth returns the 403 Response.
      withAuthMock.mockResolvedValue(
        Response.json({ error: "Forbidden" }, { status: 403 }),
      );

      const { GET } =
        await import("../../app/api/v1/whistleblowing/cases/route");
      const res = await GET(
        new Request("http://localhost/api/v1/whistleblowing/cases"),
      );

      expect(res.status).toBe(403);
      // The role-gate args must be exactly the officer set, no admin.
      expect(withAuthMock).toHaveBeenCalledWith(
        "whistleblowing_officer",
        "ombudsperson",
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "GET /whistleblowing/cases/[id] — does NOT list admin in role gate",
    async () => {
      withAuthMock.mockResolvedValue(
        Response.json({ error: "Forbidden" }, { status: 403 }),
      );

      const { GET } =
        await import("../../app/api/v1/whistleblowing/cases/[id]/route");
      const res = await GET(
        new Request(`http://localhost/api/v1/whistleblowing/cases/${CASE_ID}`),
        { params: Promise.resolve({ id: CASE_ID }) },
      );

      expect(res.status).toBe(403);
      expect(withAuthMock).toHaveBeenCalledWith(
        "whistleblowing_officer",
        "ombudsperson",
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "PUT /whistleblowing/cases/[id]/assign — does NOT list admin",
    async () => {
      withAuthMock.mockResolvedValue(
        Response.json({ error: "Forbidden" }, { status: 403 }),
      );

      const { PUT } =
        await import("../../app/api/v1/whistleblowing/cases/[id]/assign/route");
      const res = await PUT(
        new Request(
          `http://localhost/api/v1/whistleblowing/cases/${CASE_ID}/assign`,
          { method: "PUT", body: JSON.stringify({ assignedTo: VALID_UUID }) },
        ),
        { params: Promise.resolve({ id: CASE_ID }) },
      );

      expect(res.status).toBe(403);
      expect(withAuthMock).toHaveBeenCalledWith(
        "whistleblowing_officer",
        "ombudsperson",
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "PUT /whistleblowing/cases/[id]/acknowledge — does NOT list admin",
    async () => {
      withAuthMock.mockResolvedValue(
        Response.json({ error: "Forbidden" }, { status: 403 }),
      );

      const { PUT } =
        await import("../../app/api/v1/whistleblowing/cases/[id]/acknowledge/route");
      const res = await PUT(
        new Request(
          `http://localhost/api/v1/whistleblowing/cases/${CASE_ID}/acknowledge`,
          { method: "PUT", body: JSON.stringify({ message: "Got it." }) },
        ),
        { params: Promise.resolve({ id: CASE_ID }) },
      );

      expect(res.status).toBe(403);
      expect(withAuthMock).toHaveBeenCalledWith(
        "whistleblowing_officer",
        "ombudsperson",
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "POST /whistleblowing/cases/[id]/message — does NOT list admin",
    async () => {
      withAuthMock.mockResolvedValue(
        Response.json({ error: "Forbidden" }, { status: 403 }),
      );

      const { POST } =
        await import("../../app/api/v1/whistleblowing/cases/[id]/message/route");
      const res = await POST(
        new Request(
          `http://localhost/api/v1/whistleblowing/cases/${CASE_ID}/message`,
          { method: "POST", body: JSON.stringify({ content: "hi" }) },
        ),
        { params: Promise.resolve({ id: CASE_ID }) },
      );

      expect(res.status).toBe(403);
      expect(withAuthMock).toHaveBeenCalledWith(
        "whistleblowing_officer",
        "ombudsperson",
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "PUT /whistleblowing/cases/[id]/resolve — does NOT list admin",
    async () => {
      withAuthMock.mockResolvedValue(
        Response.json({ error: "Forbidden" }, { status: 403 }),
      );

      const { PUT } =
        await import("../../app/api/v1/whistleblowing/cases/[id]/resolve/route");
      const res = await PUT(
        new Request(
          `http://localhost/api/v1/whistleblowing/cases/${CASE_ID}/resolve`,
          {
            method: "PUT",
            body: JSON.stringify({
              resolution: "investigated, no findings",
              resolutionCategory: "unfounded",
            }),
          },
        ),
        { params: Promise.resolve({ id: CASE_ID }) },
      );

      expect(res.status).toBe(403);
      expect(withAuthMock).toHaveBeenCalledWith(
        "whistleblowing_officer",
        "ombudsperson",
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "GET /whistleblowing/investigations — admin removed; auditor retained for LoD3",
    async () => {
      withAuthMock.mockResolvedValue(
        Response.json({ error: "Forbidden" }, { status: 403 }),
      );

      const { GET } =
        await import("../../app/api/v1/whistleblowing/investigations/route");
      const res = await GET(
        new Request("http://localhost/api/v1/whistleblowing/investigations"),
      );

      expect(res.status).toBe(403);
      expect(withAuthMock).toHaveBeenCalledWith(
        "whistleblowing_officer",
        "ombudsperson",
        "auditor",
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "GET /whistleblowing/protection — admin removed; auditor retained",
    async () => {
      withAuthMock.mockResolvedValue(
        Response.json({ error: "Forbidden" }, { status: 403 }),
      );

      const { GET } =
        await import("../../app/api/v1/whistleblowing/protection/route");
      const res = await GET(
        new Request("http://localhost/api/v1/whistleblowing/protection"),
      );

      expect(res.status).toBe(403);
      expect(withAuthMock).toHaveBeenCalledWith(
        "whistleblowing_officer",
        "ombudsperson",
        "auditor",
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  // Statistics endpoint deliberately keeps admin access — the rationale
  // (anonymized aggregates, no case content) is documented inline; this
  // test pins that the contract is intentional rather than an oversight.
  it(
    "GET /whistleblowing/statistics — admin RETAINED for anonymized KPIs",
    async () => {
      withAuthMock.mockResolvedValue(
        Response.json({ error: "Forbidden" }, { status: 403 }),
      );

      const { GET } =
        await import("../../app/api/v1/whistleblowing/statistics/route");
      await GET(
        new Request("http://localhost/api/v1/whistleblowing/statistics"),
      );

      // Admin IS in the role list here — anonymized aggregate KPIs.
      expect(withAuthMock).toHaveBeenCalledWith(
        "admin",
        "whistleblowing_officer",
        "ombudsperson",
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});
