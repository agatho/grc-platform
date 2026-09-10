// [CodeQL js/polynomial-redos] Counter-proof for the trailing-slash strip in
// `discoverOIDCEndpoints()`, which used to be `.replace(/\/+$/, "")`.
//
// This is hardening, not a reachable DoS: `discoveryUrl` is the operator's
// own SSO configuration, not attacker input. The alert is still worth
// closing, because the linear form is strictly simpler than the regex.
//
// The test lives in its own file because it has to mock `node:dns/promises`
// and `globalThis.fetch` (the SSRF guard from #S04-02 resolves the host
// before fetching), and that mocking must not leak into `oidc.test.ts`.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

const { discoverOIDCEndpoints } = await import("../src/oidc/discovery");

const DISCOVERY_DOC = {
  issuer: "https://idp.example.com",
  authorization_endpoint: "https://idp.example.com/authorize",
  token_endpoint: "https://idp.example.com/token",
  jwks_uri: "https://idp.example.com/jwks",
};

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

describe("discoverOIDCEndpoints — trailing-slash strip", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => DISCOVERY_DOC,
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function requestedUrl(): string {
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch was never called");
    const target = call[0];
    return typeof target === "string" ? target : String(target);
  }

  it("appends .well-known and strips a trailing slash run", async () => {
    await discoverOIDCEndpoints("https://idp.example.com///");
    expect(requestedUrl()).toBe(
      "https://idp.example.com/.well-known/openid-configuration",
    );
  });

  it("leaves a URL that already points at .well-known alone", async () => {
    await discoverOIDCEndpoints(
      "https://idp.example.com/.well-known/openid-configuration",
    );
    expect(requestedUrl()).toBe(
      "https://idp.example.com/.well-known/openid-configuration",
    );
  });

  it("strips the slash run in linear time (js/polynomial-redos)", async () => {
    // A long run of slashes followed by a non-slash makes the anchored
    // regex restart, consume the run and backtrack at every slash. Note
    // that a run at the very END of the string is NOT pathological — the
    // anchor succeeds on the first attempt — so the input needs a tail.
    // The old code needs ~1.4 s for this one, the loop ~0 ms; the budget
    // is wide enough that only the quadratic behaviour can blow it.
    const discoveryUrl = `https://idp.example.com${"/".repeat(50_000)}/.well-known/openid-configuration`;
    const started = performance.now();
    await discoverOIDCEndpoints(discoveryUrl);
    const elapsedMs = performance.now() - started;
    expect(requestedUrl()).toBe(discoveryUrl);
    expect(elapsedMs).toBeLessThan(300);
  });
});
