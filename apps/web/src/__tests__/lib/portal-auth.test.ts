// Tests for portal-auth.validateDdToken — the unauthenticated entry point for
// the Due-Diligence supplier portal. This function is the ONLY thing standing
// between the public internet and the DD questionnaire surface.
//
// #WP3 — the contract changed with three findings; the old tests pinned the
// defective behaviour and are updated here:
//
//   S02-05 (High): the lookup ran through the plain `db` proxy without an org
//   context. `dd_session` has FORCE RLS, so under the production runtime role
//   `grc_app` it matched no policy and returned 0 rows — EVERY valid supplier
//   token answered 401. The token now resolves through a narrow SECURITY
//   DEFINER helper (migration 0412) and the rest runs under an org-pinned RLS
//   context.
//
//   S02-20 (Low): `dd_session.access_token` was stored in PLAINTEXT and
//   compared directly (unlike SCIM, which hashes). A read leak handed out every
//   live supplier session. Matching is by SHA-256 hash now.
//
//   S02-20 (Low): the "GDPR: hash IP" measure was an UNSALTED SHA-256 over an
//   IPv4 address — 2^32 candidates, invertible by rainbow table in seconds, so
//   not a pseudonymisation measure at all. The old test asserted exactly that
//   plain SHA-256 and is replaced: the value must be a keyed HMAC, and the
//   plain SHA-256 must NOT appear.
//
// Contract pinned by these tests:
//   - empty / short (<32 char) token → 401, no DB access
//   - unknown token → 401 (same shape as the length check)
//   - revoked → 403 · already submitted → 403
//   - expired → 410 + DB transition to status="expired"
//   - first valid access (status="invited") → "in_progress" + pseudonymised IP

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash, createHmac } from "crypto";

const queryFindFirstMock = vi.fn();
const updateSetMock = vi.fn();
const updateWhereMock = vi.fn();
const resolveDdSessionTokenHashMock = vi.fn();

const ORG_ID = "aaaaaaaa-0000-0000-0000-000000000001";

const scopedDb = {
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
};

vi.mock("@grc/db", () => ({
  // #WP3-S02-05: everything after the token resolution runs on a connection
  // pinned to the resolved org, so the RLS policies evaluate for the right
  // tenant instead of filtering the row away.
  withOrgReadContext: async (_orgId: string, fn: (db: unknown) => unknown) =>
    fn(scopedDb),
  ddSession: {
    id: "id",
    accessToken: "accessToken",
    accessTokenHash: "accessTokenHash",
    status: "status",
    tokenExpiresAt: "tokenExpiresAt",
    updatedAt: "updatedAt",
    ipAddressLog: "ipAddressLog",
  },
}));

vi.mock("@grc/auth/anonymous-token", () => ({
  hashOpaqueToken: (t: string) => createHash("sha256").update(t).digest("hex"),
  resolveDdSessionTokenHash: (h: string) => resolveDdSessionTokenHashMock(h),
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  sql: (parts: TemplateStringsArray, ...args: unknown[]) => ({
    sql: parts.raw,
    args,
  }),
}));

import { validateDdToken, pseudonymizeIp } from "../../lib/portal-auth";

const VALID_TOKEN = "a".repeat(64);
const VALID_HASH = createHash("sha256").update(VALID_TOKEN).digest("hex");

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/portal", { headers });
}

/** Make the resolver return a session for the presented token. */
function resolvesTo(id: string) {
  resolveDdSessionTokenHashMock.mockResolvedValue({ id, orgId: ORG_ID });
}

beforeEach(() => {
  queryFindFirstMock.mockReset();
  updateSetMock.mockReset();
  updateWhereMock.mockReset();
  resolveDdSessionTokenHashMock.mockReset();
  process.env.IP_PSEUDONYM_KEY = "test-pseudonym-key-0123456789";
});

describe("validateDdToken — input validation", () => {
  it.each(["", "a", "a".repeat(31)])(
    "rejects empty or sub-32-char token (%s) with 401",
    async (token) => {
      const res = await validateDdToken(token, req());
      expect((res as Response).status).toBe(401);
      expect(resolveDdSessionTokenHashMock).not.toHaveBeenCalled();
      expect(queryFindFirstMock).not.toHaveBeenCalled();
    },
  );

  it("accepts exactly 32-char tokens (boundary)", async () => {
    resolveDdSessionTokenHashMock.mockResolvedValue(null);
    const res = await validateDdToken("a".repeat(32), req());
    expect((res as Response).status).toBe(401);
    expect(resolveDdSessionTokenHashMock).toHaveBeenCalled();
  });
});

describe("validateDdToken — token lookup (S02-05 / S02-20)", () => {
  it("resolves by SHA-256 HASH, never by the plaintext token", async () => {
    resolveDdSessionTokenHashMock.mockResolvedValue(null);
    await validateDdToken(VALID_TOKEN, req());
    expect(resolveDdSessionTokenHashMock).toHaveBeenCalledWith(VALID_HASH);
    expect(resolveDdSessionTokenHashMock).not.toHaveBeenCalledWith(VALID_TOKEN);
  });

  it("returns 401 when the token doesn't match any session", async () => {
    resolveDdSessionTokenHashMock.mockResolvedValue(null);
    const res = await validateDdToken(VALID_TOKEN, req());
    expect((res as Response).status).toBe(401);
    const body = await (res as Response).json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it("returns 403 when session.status='revoked'", async () => {
    resolvesTo("s1");
    queryFindFirstMock.mockResolvedValue({
      id: "s1",
      status: "revoked",
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const res = await validateDdToken(VALID_TOKEN, req());
    expect((res as Response).status).toBe(403);
    expect((await (res as Response).json()).error).toBe("Token revoked");
  });

  it("returns 403 when session.status='submitted'", async () => {
    resolvesTo("s1");
    queryFindFirstMock.mockResolvedValue({
      id: "s1",
      status: "submitted",
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const res = await validateDdToken(VALID_TOKEN, req());
    expect((res as Response).status).toBe(403);
    expect((await (res as Response).json()).error).toBe("Already submitted");
  });

  it("rejects when the stored hash does not match the presented one", async () => {
    // Defence in depth: even if the resolver were widened, the constant-time
    // comparison in the handler still has to agree.
    resolvesTo("s-mismatch");
    queryFindFirstMock.mockResolvedValue({
      id: "s-mismatch",
      status: "invited",
      accessTokenHash: "b".repeat(64),
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const res = await validateDdToken(VALID_TOKEN, req());
    expect((res as Response).status).toBe(401);
  });
});

describe("validateDdToken — expiry handling", () => {
  it("returns 410 when expired AND transitions the session to 'expired'", async () => {
    resolvesTo("s-expired");
    queryFindFirstMock.mockResolvedValue({
      id: "s-expired",
      status: "invited",
      tokenExpiresAt: new Date(Date.now() - 60_000),
    });
    const res = await validateDdToken(VALID_TOKEN, req());
    expect((res as Response).status).toBe(410);
    expect((await (res as Response).json()).error).toBe("Token expired");
    expect(updateSetMock).toHaveBeenCalled();
    expect(
      (updateSetMock.mock.calls[0][0] as Record<string, unknown>).status,
    ).toBe("expired");
  });
});

describe("validateDdToken — happy path", () => {
  it("returns session + org and transitions 'invited' → 'in_progress'", async () => {
    resolvesTo("s-fresh");
    queryFindFirstMock.mockResolvedValue({
      id: "s-fresh",
      status: "invited",
      accessTokenHash: VALID_HASH,
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const res = await validateDdToken(VALID_TOKEN, req());
    expect("session" in (res as { session?: unknown })).toBe(true);
    const result = res as { session: { status: string }; orgId: string };
    expect(result.session.status).toBe("in_progress");
    // #WP3-S02-05: callers need the org to scope their own reads.
    expect(result.orgId).toBe(ORG_ID);
    expect(
      (updateSetMock.mock.calls[0][0] as Record<string, unknown>).status,
    ).toBe("in_progress");
  });

  it("preserves 'in_progress' on subsequent accesses (no thrash)", async () => {
    resolvesTo("s-ongoing");
    queryFindFirstMock.mockResolvedValue({
      id: "s-ongoing",
      status: "in_progress",
      accessTokenHash: VALID_HASH,
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const res = await validateDdToken(VALID_TOKEN, req());
    expect((res as { session: { status: string } }).session.status).toBe(
      "in_progress",
    );
  });
});

describe("validateDdToken — IP pseudonymisation (S02-20)", () => {
  it("stores a keyed HMAC, not the reversible plain SHA-256 of the IP", async () => {
    resolvesTo("s-ip");
    queryFindFirstMock.mockResolvedValue({
      id: "s-ip",
      status: "invited",
      accessTokenHash: VALID_HASH,
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    await validateDdToken(
      VALID_TOKEN,
      req({ "x-forwarded-for": "203.0.113.42" }),
    );
    const args = updateSetMock.mock.calls[0][0] as Record<string, unknown>;
    const serialised = JSON.stringify(
      (args.ipAddressLog as { args: unknown[] }).args,
    );

    // Neither the raw IP …
    expect(serialised).not.toContain("203.0.113.42");
    // … nor the unsalted SHA-256 the old implementation called "GDPR: hash IP"
    // (2^32 candidates — a rainbow table inverts it in seconds).
    const naiveHash = createHash("sha256").update("203.0.113.42").digest("hex");
    expect(serialised).not.toContain(naiveHash);

    // It IS the keyed, daily-rotated HMAC.
    const day = new Date().toISOString().slice(0, 10);
    const expected = createHmac("sha256", process.env.IP_PSEUDONYM_KEY!)
      .update(`${day}|203.0.113.42`)
      .digest("hex");
    expect(serialised).toContain(expected);
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", async () => {
    resolvesTo("s-ip-alt");
    queryFindFirstMock.mockResolvedValue({
      id: "s-ip-alt",
      status: "invited",
      accessTokenHash: VALID_HASH,
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    await validateDdToken(VALID_TOKEN, req({ "x-real-ip": "198.51.100.7" }));
    const args = updateSetMock.mock.calls[0][0] as Record<string, unknown>;
    const serialised = JSON.stringify(
      (args.ipAddressLog as { args: unknown[] }).args,
    );
    expect(serialised).toContain(pseudonymizeIp("198.51.100.7"));
    expect(serialised).not.toContain("198.51.100.7");
  });

  it("stores NOTHING rather than something fake when no key is configured", async () => {
    const prevKey = process.env.IP_PSEUDONYM_KEY;
    const prevSecret = process.env.SECRET_ENCRYPTION_KEY;
    const prevAuth = process.env.AUTH_SECRET;
    delete process.env.IP_PSEUDONYM_KEY;
    delete process.env.SECRET_ENCRYPTION_KEY;
    delete process.env.AUTH_SECRET;
    try {
      expect(pseudonymizeIp("203.0.113.42")).toBeNull();
      resolvesTo("s-nokey");
      queryFindFirstMock.mockResolvedValue({
        id: "s-nokey",
        status: "invited",
        accessTokenHash: VALID_HASH,
        tokenExpiresAt: new Date(Date.now() + 86_400_000),
      });
      await validateDdToken(
        VALID_TOKEN,
        req({ "x-forwarded-for": "203.0.113.42" }),
      );
      const args = updateSetMock.mock.calls[0][0] as Record<string, unknown>;
      expect(args.ipAddressLog).toBeUndefined();
    } finally {
      if (prevKey) process.env.IP_PSEUDONYM_KEY = prevKey;
      if (prevSecret) process.env.SECRET_ENCRYPTION_KEY = prevSecret;
      if (prevAuth) process.env.AUTH_SECRET = prevAuth;
    }
  });

  it("uses the 'unknown' marker when neither header is set", async () => {
    resolvesTo("s-noip");
    queryFindFirstMock.mockResolvedValue({
      id: "s-noip",
      status: "invited",
      accessTokenHash: VALID_HASH,
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    });
    await validateDdToken(VALID_TOKEN, req());
    const args = updateSetMock.mock.calls[0][0] as Record<string, unknown>;
    const serialised = JSON.stringify(
      (args.ipAddressLog as { args: unknown[] }).args,
    );
    expect(serialised).toContain(pseudonymizeIp("unknown"));
  });
});
