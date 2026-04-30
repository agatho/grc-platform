// Test for POST /api/v1/auth/switch-org — verifies session + org-membership.

import { describe, it, expect, beforeEach, vi } from "vitest";

const authMock = vi.fn();
const setCurrentOrgIdMock = vi.fn();
const getAccessibleOrgIdsMock = vi.fn();

vi.mock("@/auth", () => ({
  get auth() {
    return authMock;
  },
}));
vi.mock("@grc/auth/context", () => ({
  get setCurrentOrgId() {
    return setCurrentOrgIdMock;
  },
}));
vi.mock("@grc/auth", () => ({
  get getAccessibleOrgIds() {
    return getAccessibleOrgIdsMock;
  },
}));

describe("POST /api/v1/auth/switch-org", () => {
  beforeEach(() => {
    authMock.mockReset();
    setCurrentOrgIdMock.mockReset();
    getAccessibleOrgIdsMock.mockReset();
  });

  it("returns 401 when no session", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/v1/auth/switch-org/route"
    );
    const res = await POST(
      new Request("http://localhost/api/v1/auth/switch-org", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: "a1b2c3d4-e5f6-4789-9abc-def012345678" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 422 for invalid orgId format", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const { POST } = await import(
      "../../app/api/v1/auth/switch-org/route"
    );
    const res = await POST(
      new Request("http://localhost/api/v1/auth/switch-org", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: "not-a-uuid" }),
      }),
    );
    expect([400, 422]).toContain(res.status);
  });

  it("returns 403 when user has no access to orgId", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    // getAccessibleOrgIds is sync, returns array directly
    getAccessibleOrgIdsMock.mockReturnValue([
      "f9e8d7c6-b5a4-4321-8987-654321fedcba",
    ]);
    const { POST } = await import(
      "../../app/api/v1/auth/switch-org/route"
    );
    const res = await POST(
      new Request("http://localhost/api/v1/auth/switch-org", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: "a1b2c3d4-e5f6-4789-9abc-def012345678" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("succeeds and sets the new orgId when user has access", async () => {
    const targetId = "a1b2c3d4-e5f6-4789-9abc-def012345678";
    authMock.mockResolvedValue({ user: { id: "u1" } });
    getAccessibleOrgIdsMock.mockReturnValue([targetId]);
    setCurrentOrgIdMock.mockResolvedValue(undefined);

    const { POST } = await import(
      "../../app/api/v1/auth/switch-org/route"
    );
    const res = await POST(
      new Request("http://localhost/api/v1/auth/switch-org", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: targetId }),
      }),
    );
    expect(res.status).toBe(200);
    expect(setCurrentOrgIdMock).toHaveBeenCalledWith(targetId);
  });
});
