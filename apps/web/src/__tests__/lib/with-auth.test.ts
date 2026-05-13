// Tests for the central withAuth() helper in apps/web/src/lib/api.ts.
// This is the auth gateway used by virtually every API route — if it's
// broken, every endpoint breaks. Worth dedicated tests.
//
// Covers the contract:
//   - No session → 401 Response
//   - No selected org → 400 Response
//   - Role check failure → standard requireRole Response (typically 403)
//   - Success → ApiContext with session/orgId/userId

import { describe, it, expect, beforeEach, vi } from "vitest";

const authMock = vi.fn();
const getCurrentOrgIdMock = vi.fn();
const requireRoleMock = vi.fn();
const dbExecuteMock = vi.fn();

vi.mock("@/auth", () => ({
  get auth() {
    return authMock;
  },
}));

vi.mock("@grc/auth/context", () => ({
  get getCurrentOrgId() {
    return getCurrentOrgIdMock;
  },
}));

vi.mock("@grc/auth", () => ({
  get requireRole() {
    return requireRoleMock;
  },
}));

vi.mock("@grc/db", () => ({
  db: {
    execute: (...args: unknown[]) => dbExecuteMock(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
    sql: strings.raw,
    vals,
  }),
}));

// #WAVE13-RBAC-Forbidden-Format: withAuth now reads x-request-id from
// next/headers to thread into RFC-7807 problem bodies. Mock it so the
// test environment doesn't blow up trying to access the real request
// async-context.
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === "x-request-id" ? "test-request-id" : null,
  }),
}));

describe("withAuth()", () => {
  beforeEach(() => {
    authMock.mockReset();
    getCurrentOrgIdMock.mockReset();
    requireRoleMock.mockReset();
    dbExecuteMock.mockReset();
  });

  it("returns 401 RFC-7807 Response when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const { withAuth } = await import("../../lib/api");
    const result = await withAuth();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect((result as Response).headers.get("Content-Type")).toBe(
      "application/problem+json; charset=utf-8",
    );
    const body = await (result as Response).json();
    expect(body).toMatchObject({
      title: "Unauthorized",
      status: 401,
      requestId: "test-request-id",
    });
  });

  it("returns 401 when session has no user.id", async () => {
    authMock.mockResolvedValue({ user: {} });
    const { withAuth } = await import("../../lib/api");
    const result = await withAuth();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns 400 RFC-7807 Response when no orgId is selected", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getCurrentOrgIdMock.mockResolvedValue(null);
    const { withAuth } = await import("../../lib/api");
    const result = await withAuth();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
    const body = await (result as Response).json();
    expect(body).toMatchObject({
      title: "No organization selected",
      status: 400,
      requestId: "test-request-id",
    });
  });

  it("returns ApiContext on success without role check", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getCurrentOrgIdMock.mockResolvedValue("org-1");
    const { withAuth } = await import("../../lib/api");
    const result = await withAuth();
    expect(result).not.toBeInstanceOf(Response);
    if (result instanceof Response) return; // type-narrow
    expect(result.userId).toBe("user-1");
    expect(result.orgId).toBe("org-1");
    expect(result.session).toBeDefined();
  });

  it("delegates role check to requireRole and falls back to custom-role lookup on denial", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getCurrentOrgIdMock.mockResolvedValue("org-1");

    const denial = Response.json({ error: "Forbidden" }, { status: 403 });
    // requireRole returns a curried function: requireRole(...roles)(session, orgId)
    requireRoleMock.mockReturnValue(() => denial);
    // Custom role fallback: empty result = no access
    dbExecuteMock.mockResolvedValue([]);

    const { withAuth } = await import("../../lib/api");
    const result = await withAuth("admin");
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(requireRoleMock).toHaveBeenCalledWith("admin");
  });

  it("succeeds when role check passes (no fallback needed)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getCurrentOrgIdMock.mockResolvedValue("org-1");
    requireRoleMock.mockReturnValue(() => null); // null = authorized
    const { withAuth } = await import("../../lib/api");
    const result = await withAuth("admin", "risk_manager");
    expect(result).not.toBeInstanceOf(Response);
    expect(requireRoleMock).toHaveBeenCalledWith("admin", "risk_manager");
  });

  it("succeeds via custom-role fallback when standard role denies but custom row exists", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getCurrentOrgIdMock.mockResolvedValue("org-1");
    requireRoleMock.mockReturnValue(() =>
      Response.json({ error: "Forbidden" }, { status: 403 }),
    );
    // Custom-role lookup finds a row → access granted
    dbExecuteMock.mockResolvedValue([{ "?column?": 1 }]);
    const { withAuth } = await import("../../lib/api");
    const result = await withAuth("admin");
    expect(result).not.toBeInstanceOf(Response);
  });
});
