// Tests for portal-auth.validateDdToken — the unauthenticated entry
// point for the Due-Diligence supplier portal. This function is the
// ONLY thing standing between the public internet and the DD
// questionnaire surface; if it lets a bad token through, anyone
// gets read+write access to that supplier's DD response data.
//
// Pre-Wave-26: zero unit tests.
//
// Contract pinned by these tests:
//   - empty / short (<32 char) token → 401
//   - unknown token → 401 (don't reveal whether the token format is
//     valid, only that it doesn't match)
//   - revoked → 403
//   - already submitted → 403
//   - expired → 410 + DB transition to status="expired"
//   - first valid access (status="invited") → transitions to
//     "in_progress" + appends SHA-256 hash of the caller's IP to
//     ip_address_log (NOT the plaintext IP — GDPR)

import { describe, it, expect, vi, beforeEach } from "vitest";

const queryFindFirstMock = vi.fn();
const updateSetMock = vi.fn();
const updateWhereMock = vi.fn();

vi.mock("@grc/db", () => ({
  db: {
    query: {
      ddSession: {
        findFirst: (opts: unknown) => queryFindFirstMock(opts),
      },
    },
    update: () => ({
      set: (vals: unknown) => {
        updateSetMock(vals);
        return {
          where: (w: unknown) => {
            updateWhereMock(w);
            return Promise.resolve([]);
          },
        };
      },
    }),
  },
  ddSession: {
    id: "id",
    accessToken: "accessToken",
    status: "status",
    tokenExpiresAt: "tokenExpiresAt",
    updatedAt: "updatedAt",
    ipAddressLog: "ipAddressLog",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  sql: (parts: TemplateStringsArray, ...args: unknown[]) => ({
    sql: parts.raw,
    args,
  }),
}));

import { validateDdToken } from "../../lib/portal-auth";

const VALID_TOKEN = "a".repeat(64); // any string ≥ 32 chars
function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/portal", { headers });
}

beforeEach(() => {
  queryFindFirstMock.mockReset();
  updateSetMock.mockReset();
  updateWhereMock.mockReset();
});

describe("validateDdToken — input validation", () => {
  it.each(["", "a", "a".repeat(31)])(
    "rejects empty or sub-32-char token (%s) with 401",
    async (token) => {
      const res = await validateDdToken(token, req());
      expect((res as Response).status).toBe(401);
      expect(queryFindFirstMock).not.toHaveBeenCalled();
    },
  );

  it("accepts exactly 32-char tokens (boundary)", async () => {
    queryFindFirstMock.mockResolvedValue(null);
    const res = await validateDdToken("a".repeat(32), req());
    // Length passes; lookup fails → 401 from the lookup branch, not
    // from the length check.
    expect((res as Response).status).toBe(401);
    expect(queryFindFirstMock).toHaveBeenCalled();
  });
});

describe("validateDdToken — token lookup", () => {
  it("returns 401 when token doesn't match any session", async () => {
    queryFindFirstMock.mockResolvedValue(null);
    const res = await validateDdToken(VALID_TOKEN, req());
    expect((res as Response).status).toBe(401);
    const body = await (res as Response).json();
    // Important: the unknown-token message doesn't reveal whether
    // the format was valid — same 401 shape as the length check.
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it("returns 403 when session.status='revoked'", async () => {
    queryFindFirstMock.mockResolvedValue({
      id: "s1",
      status: "revoked",
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const res = await validateDdToken(VALID_TOKEN, req());
    expect((res as Response).status).toBe(403);
    const body = await (res as Response).json();
    expect(body.error).toBe("Token revoked");
  });

  it("returns 403 when session.status='submitted'", async () => {
    queryFindFirstMock.mockResolvedValue({
      id: "s1",
      status: "submitted",
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const res = await validateDdToken(VALID_TOKEN, req());
    expect((res as Response).status).toBe(403);
    const body = await (res as Response).json();
    expect(body.error).toBe("Already submitted");
  });
});

describe("validateDdToken — expiry handling", () => {
  it("returns 410 when token is expired AND transitions session to 'expired'", async () => {
    queryFindFirstMock.mockResolvedValue({
      id: "s-expired",
      status: "invited",
      tokenExpiresAt: new Date(Date.now() - 60_000), // 1 min ago
    });
    const res = await validateDdToken(VALID_TOKEN, req());
    expect((res as Response).status).toBe(410);
    const body = await (res as Response).json();
    expect(body.error).toBe("Token expired");

    // The session must be transitioned to status='expired' so future
    // accesses with the same token short-circuit to 410 even before
    // the timestamp comparison runs.
    expect(updateSetMock).toHaveBeenCalled();
    const updateCall = updateSetMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(updateCall.status).toBe("expired");
  });
});

describe("validateDdToken — happy path", () => {
  it("returns session + transitions 'invited' → 'in_progress' on first access", async () => {
    const baseSession = {
      id: "s-fresh",
      status: "invited" as const,
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
      accessToken: VALID_TOKEN,
    };
    queryFindFirstMock.mockResolvedValue(baseSession);
    const res = await validateDdToken(VALID_TOKEN, req());
    expect("session" in (res as { session?: unknown })).toBe(true);
    const result = res as { session: typeof baseSession };
    expect(result.session.status).toBe("in_progress");
    // DB was updated with new status
    expect(updateSetMock).toHaveBeenCalled();
    const setCall = updateSetMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(setCall.status).toBe("in_progress");
  });

  it("preserves 'in_progress' status on subsequent accesses (no thrash)", async () => {
    const baseSession = {
      id: "s-ongoing",
      status: "in_progress" as const,
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
      accessToken: VALID_TOKEN,
    };
    queryFindFirstMock.mockResolvedValue(baseSession);
    const res = await validateDdToken(VALID_TOKEN, req());
    const result = res as { session: typeof baseSession };
    expect(result.session.status).toBe("in_progress");
  });
});

describe("validateDdToken — GDPR IP handling", () => {
  it("hashes the X-Forwarded-For IP (SHA-256) before storing — never plaintext", async () => {
    queryFindFirstMock.mockResolvedValue({
      id: "s-ip",
      status: "invited",
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    await validateDdToken(
      VALID_TOKEN,
      req({ "x-forwarded-for": "203.0.113.42" }),
    );
    expect(updateSetMock).toHaveBeenCalled();
    const args = updateSetMock.mock.calls[0][0] as Record<string, unknown>;
    const ipLogSql = args.ipAddressLog as { sql: readonly string[]; args: unknown[] };
    // The SHA-256 hash of "203.0.113.42" is c3f0b… (precomputed).
    const expectedHash =
      require("crypto").createHash("sha256").update("203.0.113.42").digest("hex");
    // The arg interpolated into the array_append() call should be the
    // hash, not the raw IP. The raw IP must NOT appear anywhere.
    const allArgsStr = JSON.stringify(ipLogSql.args);
    expect(allArgsStr).toContain(expectedHash);
    expect(allArgsStr).not.toContain("203.0.113.42");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", async () => {
    queryFindFirstMock.mockResolvedValue({
      id: "s-ip-alt",
      status: "invited",
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    await validateDdToken(VALID_TOKEN, req({ "x-real-ip": "10.0.0.1" }));
    const args = updateSetMock.mock.calls[0][0] as Record<string, unknown>;
    const ipLogSql = args.ipAddressLog as { args: unknown[] };
    const expectedHash =
      require("crypto").createHash("sha256").update("10.0.0.1").digest("hex");
    expect(JSON.stringify(ipLogSql.args)).toContain(expectedHash);
  });

  it("uses 'unknown' marker when neither header is set", async () => {
    queryFindFirstMock.mockResolvedValue({
      id: "s-ip-none",
      status: "invited",
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    await validateDdToken(VALID_TOKEN, req());
    const args = updateSetMock.mock.calls[0][0] as Record<string, unknown>;
    const ipLogSql = args.ipAddressLog as { args: unknown[] };
    const expectedHash =
      require("crypto").createHash("sha256").update("unknown").digest("hex");
    expect(JSON.stringify(ipLogSql.args)).toContain(expectedHash);
  });
});
