// #S04-08 regression contract — audit ARCTOS-FULL-2026-08-31, Low.
//
// The playground proxy's SSRF hole was already closed (same-origin gate,
// commit 2ce8d6b8) and the audit confirmed that fix as complete. What
// remained: the endpoint forwarded ANY caller-supplied header to the app's
// own API routes —
//
//   fetch(targetUrl, { headers: { "Content-Type": …, ...body.data.headers } })
//
// so an admin could inject `X-Forwarded-For` (spoofing the client IP that
// rate limiting and IP allowlists trust), `Authorization` / `Cookie` (acting
// as a different principal against internal routes), or `Host`.
//
// The fix is an allowlist. These tests pin which headers survive.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const insertValues = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
}));

vi.mock("@grc/db", () => ({
  apiUsageLog: {},
  db: {
    insert: () => ({ values: insertValues }),
  },
}));

const fetchMock = vi.fn();

const ORG_ID = "22222222-2222-2222-2222-222222222222";

function makeReq(headers: Record<string, string>) {
  return new Request("http://localhost/api/v1/playground/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "GET", path: "/api/v1/risks", headers }),
  });
}

describe("playground/execute — #S04-08 header allowlist", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    insertValues.mockClear();
    withAuthMock.mockReset();
    withAuthMock.mockResolvedValue({ orgId: ORG_ID, userId: "u1" });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValue({
      status: 200,
      headers: new Headers(),
      text: async () => "[]",
    } as unknown as Response);
  });

  const FORBIDDEN = [
    "Authorization",
    "authorization",
    "Cookie",
    "X-Forwarded-For",
    "x-forwarded-for",
    "X-Forwarded-Host",
    "X-Real-IP",
    "Host",
    "Origin",
    "Referer",
    "X-Org-Id",
    "X-User-Id",
  ];

  for (const header of FORBIDDEN) {
    it(`drops ${header}`, async () => {
      const { POST } =
        await import("../../app/api/v1/playground/execute/route");
      const res = await POST(makeReq({ [header]: "injected" }));
      expect(res.status).toBe(200);

      const sentHeaders = (fetchMock.mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      const sentKeys = Object.keys(sentHeaders).map((k) => k.toLowerCase());
      expect(sentKeys).not.toContain(header.toLowerCase());

      const body = await res.json();
      expect(body.data.rejectedHeaders).toContain(header);
    });
  }

  it("still forwards the benign headers a playground user needs", async () => {
    const { POST } = await import("../../app/api/v1/playground/execute/route");
    const res = await POST(
      makeReq({
        Accept: "application/json",
        "Accept-Language": "de-DE",
        "If-None-Match": '"abc"',
        "X-Request-Id": "req-1",
      }),
    );
    expect(res.status).toBe(200);

    const sentHeaders = (fetchMock.mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>;
    expect(sentHeaders["Accept"]).toBe("application/json");
    expect(sentHeaders["Accept-Language"]).toBe("de-DE");
    expect(sentHeaders["If-None-Match"]).toBe('"abc"');
    expect(sentHeaders["X-Request-Id"]).toBe("req-1");
    // Content-Type is always set by the proxy itself.
    expect(sentHeaders["Content-Type"]).toBe("application/json");

    const body = await res.json();
    expect(body.data.rejectedHeaders).toBeUndefined();
  });

  it("keeps rejecting off-origin paths (SSRF gate from 2ce8d6b8 intact)", async () => {
    const { POST } = await import("../../app/api/v1/playground/execute/route");
    for (const path of [
      "http://169.254.169.254/latest/meta-data/",
      "//evil.example/",
      "/\\evil.example/",
    ]) {
      const res = await POST(
        new Request("http://localhost/api/v1/playground/execute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ method: "GET", path, headers: {} }),
        }),
      );
      expect(res.status).toBe(422);
    }
  });
});
