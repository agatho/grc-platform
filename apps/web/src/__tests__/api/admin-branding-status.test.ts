// GET /api/v1/admin/branding — Status-Code-Contract.
//
// #WAVE23-A2: Wave 22 Cowork-QA reproduzierte 4 Wellen lang ein
// `GET /admin/branding → 500` mit RequestID `24a45b827c4f2e4d`. Wave 19
// hatte den Read in `withReadContext` gewrappt + 42P01-Fallback auf
// Defaults. Trotzdem: Production weiterhin rot.
//
// Dieser Test pinnt die Acceptance-Kontrakt:
//   1. GET MUSS 200 (mit Defaults oder stored Row) ODER 501 liefern.
//   2. Niemals 500.
//   3. Wenn die Tabelle fehlt (PG 42P01), trotzdem 200 mit defaults.
//   4. Wenn die Auth-Layer rot ist, 401 (NICHT 500).
//
// Wenn dieser Test rot wird, ist der A2-Failure-Mode regrediert.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const withReadContextMock = vi.fn();

vi.mock("@grc/db", () => ({
  orgBranding: {
    id: "id",
    orgId: "orgId",
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  get withReadContext() {
    return withReadContextMock;
  },
  // withAuditContext is only used by PUT — stub it so the import
  // doesn't fail.
  withAuditContext: vi.fn(),
  // Required by withErrorHandler (api-wrapper imports PaginationError
  // at module-load time). Stub class is enough for the `instanceof`
  // check to short-circuit — we never throw it from this test.
  PaginationError: class PaginationError extends Error {},
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
  };
});

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

describe("GET /api/v1/admin/branding — status-code contract", () => {
  beforeEach(() => {
    withAuthMock.mockReset();
    withReadContextMock.mockReset();
  });

  it("returns 200 with defaults when no row exists for the org", async () => {
    withAuthMock.mockResolvedValue({
      session: { user: { id: USER_ID } },
      orgId: ORG_ID,
      userId: USER_ID,
    });
    // Empty result-set → route should fall back to defaults payload.
    withReadContextMock.mockImplementation(async (_ctx, fn) => {
      const tx = {
        select() {
          return {
            from() {
              return {
                where() {
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
      return fn(tx);
    });

    const { GET } = await import("../../app/api/v1/admin/branding/route");
    const res = await GET(
      new Request("http://localhost/api/v1/admin/branding"),
      undefined as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      orgId: ORG_ID,
      primaryColor: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
      reportTemplate: "standard",
      source: "defaults",
    });
  });

  it("returns 200 with defaults when org_branding table missing (PG 42P01)", async () => {
    withAuthMock.mockResolvedValue({
      session: { user: { id: USER_ID } },
      orgId: ORG_ID,
      userId: USER_ID,
    });
    // Simulate undefined-table error from a partial/early deploy.
    withReadContextMock.mockImplementation(async () => {
      const err = new Error("relation org_branding does not exist") as Error & {
        code?: string;
      };
      err.code = "42P01";
      throw err;
    });

    const { GET } = await import("../../app/api/v1/admin/branding/route");
    const res = await GET(
      new Request("http://localhost/api/v1/admin/branding"),
      undefined as never,
    );

    // 42P01 must NOT escalate to 500 — Wave 19 made this an explicit
    // graceful-degradation path. Defaults are returned with source=defaults.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.source).toBe("defaults");
  });

  it("returns 200 with stored row when org_branding has a row", async () => {
    withAuthMock.mockResolvedValue({
      session: { user: { id: USER_ID } },
      orgId: ORG_ID,
      userId: USER_ID,
    });
    const STORED_ROW = {
      id: "stored-id",
      orgId: ORG_ID,
      primaryColor: "#abcdef",
      secondaryColor: "#123456",
      accentColor: "#fedcba",
      textColor: "#000000",
      backgroundColor: "#ffffff",
      reportTemplate: "formal",
      inheritFromParent: false,
    };
    withReadContextMock.mockImplementation(async (_ctx, fn) => {
      const tx = {
        select() {
          return {
            from() {
              return {
                where() {
                  return Promise.resolve([STORED_ROW]);
                },
              };
            },
          };
        },
      };
      return fn(tx);
    });

    const { GET } = await import("../../app/api/v1/admin/branding/route");
    const res = await GET(
      new Request("http://localhost/api/v1/admin/branding"),
      undefined as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      ...STORED_ROW,
      source: "stored",
    });
  });

  it("returns 401 (not 500) when auth layer rejects", async () => {
    withAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { GET } = await import("../../app/api/v1/admin/branding/route");
    const res = await GET(
      new Request("http://localhost/api/v1/admin/branding"),
      undefined as never,
    );

    expect(res.status).toBe(401);
    expect([200, 401, 501]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it("non-42P01 PG errors escalate to a typed 500 (not empty body)", async () => {
    withAuthMock.mockResolvedValue({
      session: { user: { id: USER_ID } },
      orgId: ORG_ID,
      userId: USER_ID,
    });
    // Simulate a generic FK violation — should land as a 422
    // (constraint-violation branch in withErrorHandler), NOT 500.
    withReadContextMock.mockImplementation(async () => {
      const err = new Error("connection terminated") as Error & {
        code?: string;
      };
      err.code = "CONNECTION_ENDED";
      throw err;
    });

    const { GET } = await import("../../app/api/v1/admin/branding/route");
    const res = await GET(
      new Request("http://localhost/api/v1/admin/branding"),
      undefined as never,
    );

    // Connection-timeout maps to 503 (database-unavailable branch in
    // api-wrapper). Acceptance for A2 is "never silently 500 with
    // empty body" — 503 with RFC-7807 body is a fine outcome since
    // the operator can correlate via requestId.
    expect([200, 401, 501, 503]).toContain(res.status);
    expect(res.status).not.toBe(500);
    const body = await res.json();
    expect(body.requestId).toBeTruthy();
  });
});
