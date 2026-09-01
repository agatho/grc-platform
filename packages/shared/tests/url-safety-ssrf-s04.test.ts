// #S04-02 / #S04-03 regression contract — audit ARCTOS-FULL-2026-08-31.
//
// Two High findings: the SAML-metadata / OIDC-discovery fetch and the ISMS
// threat-feed fetch called bare `fetch()` on a user-supplied URL although
// the project already shipped a url-safety guard (used by webhooks).
//
// The audit also asked whether that guard actually holds against the
// documented bypass classes. It did not:
//
//   * decimal / octal / hex / short-form IPv4 spellings were not matched by
//     the dotted-quad-only literal check;
//   * IPv6 was compared by written prefix, so `0:0:0:0:0:0:0:1` and
//     `[0:0:0:0:0:ffff:a9fe:a9fe]` read as public;
//   * REDIRECTS were never re-validated — only the first URL was checked,
//     so `https://public.test` → 302 → `http://169.254.169.254/` reached
//     the metadata service.
//
// These tests pin all three.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkOutboundUrl, normalizeNumericIPv4 } from "../src/url-safety";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

const { safeFetch, assertUrlIsSafe, SsrfBlockedError } =
  await import("../src/lib/url-safety-server");

describe("#S04-02/03 — literal guard covers every IPv4 spelling", () => {
  const LOOPBACK_SPELLINGS = [
    "127.0.0.1",
    "2130706433", // decimal
    "0x7f000001", // hex
    "0177.0.0.1", // octal first octet
    "127.1", // 2-part short form
    "127.0.1", // 3-part short form
  ];

  for (const host of LOOPBACK_SPELLINGS) {
    it(`rejects loopback written as ${host}`, () => {
      const r = checkOutboundUrl(`https://${host}/x`);
      expect(r.ok).toBe(false);
    });
  }

  const IMDS_SPELLINGS = [
    "169.254.169.254",
    "2852039166", // decimal form of 169.254.169.254
    "0251.0376.0251.0376", // octal
  ];

  for (const host of IMDS_SPELLINGS) {
    it(`rejects the cloud metadata endpoint written as ${host}`, () => {
      const r = checkOutboundUrl(`https://${host}/latest/meta-data/`);
      expect(r.ok).toBe(false);
    });
  }

  it("rejects 0.0.0.0 and its short forms", () => {
    expect(checkOutboundUrl("https://0.0.0.0/x").ok).toBe(false);
    expect(checkOutboundUrl("https://0/x").ok).toBe(false);
  });

  it("still accepts a genuine public address", () => {
    expect(checkOutboundUrl("https://93.184.216.34/x").ok).toBe(true);
    expect(checkOutboundUrl("https://idp.partner.example.com/meta").ok).toBe(
      true,
    );
  });

  it("normalizeNumericIPv4 canonicalises inet_aton spellings", () => {
    expect(normalizeNumericIPv4("2130706433")).toBe("127.0.0.1");
    expect(normalizeNumericIPv4("0x7f000001")).toBe("127.0.0.1");
    expect(normalizeNumericIPv4("127.1")).toBe("127.0.0.1");
    expect(normalizeNumericIPv4("example.com")).toBeNull();
    expect(normalizeNumericIPv4("999.1.1.1")).toBeNull();
  });
});

describe("#S04-02/03 — IPv6 guard is spelling-independent", () => {
  const IPV6_BLOCKED = [
    "[::1]",
    "[0:0:0:0:0:0:0:1]",
    "[::0001]",
    "[::]",
    "[::ffff:127.0.0.1]",
    "[0:0:0:0:0:ffff:7f00:1]",
    "[::ffff:169.254.169.254]",
    "[0:0:0:0:0:ffff:a9fe:a9fe]",
    "[fd00::1]",
    "[fe80::1]",
    "[fec0::1]",
    "[ff02::1]",
    "[64:ff9b::a9fe:a9fe]",
  ];

  for (const host of IPV6_BLOCKED) {
    it(`rejects ${host}`, () => {
      expect(checkOutboundUrl(`https://${host}/x`).ok).toBe(false);
    });
  }

  it("still accepts a public IPv6 literal", () => {
    expect(checkOutboundUrl("https://[2606:4700:4700::1111]/x").ok).toBe(true);
  });
});

describe("#S04-02/03 — scheme and credential hardening", () => {
  it("refuses non-http(s) schemes", () => {
    expect(checkOutboundUrl("file:///etc/passwd").ok).toBe(false);
    expect(checkOutboundUrl("gopher://internal:70/_x").ok).toBe(false);
  });

  it("refuses plain http when requireHttps is set (SSO paths)", () => {
    const r = checkOutboundUrl("http://idp.example.com/metadata", {
      requireHttps: true,
      purpose: "SAML metadata retrieval",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/http:\/\/ is not allowed/);
  });

  it("refuses embedded credentials", () => {
    expect(checkOutboundUrl("https://user:pw@idp.example.com/x").ok).toBe(
      false,
    );
  });

  it("refuses .internal / .local / .localhost hostnames", () => {
    expect(checkOutboundUrl("https://postgres.internal/x").ok).toBe(false);
    expect(checkOutboundUrl("https://printer.local/x").ok).toBe(false);
    expect(checkOutboundUrl("https://api.localhost/x").ok).toBe(false);
    expect(checkOutboundUrl("https://metadata.google.internal/x").ok).toBe(
      false,
    );
  });
});

describe("#S04-02/03 — safeFetch re-validates every redirect hop", () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    lookupMock.mockReset();
    // Every hostname that reaches DNS resolves to a public address unless a
    // test says otherwise — the point of these tests is the LITERAL and the
    // REDIRECT layer, not the resolver.
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.WEBHOOK_ALLOW_HTTP = "1";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.WEBHOOK_ALLOW_HTTP;
  });

  function redirectTo(location: string) {
    return {
      status: 302,
      headers: new Headers({ location }),
    } as unknown as Response;
  }
  function ok(body = "<xml/>") {
    return {
      status: 200,
      ok: true,
      headers: new Headers(),
      text: async () => body,
    } as unknown as Response;
  }

  const PRIVATE_REDIRECT_TARGETS = [
    "http://127.0.0.1/admin",
    "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "http://[::1]/admin",
    "http://0.0.0.0/",
    "http://2130706433/", // decimal loopback
  ];

  for (const target of PRIVATE_REDIRECT_TARGETS) {
    it(`blocks a redirect to ${target}`, async () => {
      fetchMock.mockResolvedValueOnce(redirectTo(target));

      await expect(
        safeFetch("https://idp.partner.example.com/metadata"),
      ).rejects.toBeInstanceOf(SsrfBlockedError);

      // The first hop was fetched, the private hop never was.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://idp.partner.example.com/metadata",
      );
    });
  }

  it("blocks a redirect that only becomes private on the SECOND hop", async () => {
    fetchMock
      .mockResolvedValueOnce(redirectTo("https://cdn.partner.example.com/meta"))
      .mockResolvedValueOnce(redirectTo("http://169.254.169.254/latest/"));

    await expect(
      safeFetch("https://idp.partner.example.com/metadata"),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks a hostname that RESOLVES to a private address (DNS rebinding)", async () => {
    lookupMock.mockResolvedValue([{ address: "10.1.2.3", family: 4 }]);
    await expect(
      safeFetch("https://rebind.attacker.example/metadata"),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never lets fetch follow redirects on its own", async () => {
    fetchMock.mockResolvedValueOnce(ok());
    await safeFetch("https://idp.partner.example.com/metadata");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("caps the redirect chain", async () => {
    fetchMock.mockResolvedValue(
      redirectTo("https://loop.partner.example.com/next"),
    );
    await expect(
      safeFetch("https://idp.partner.example.com/metadata", {
        maxRedirects: 2,
      }),
    ).rejects.toThrow(/too many redirects/i);
  });

  it("returns the response for a well-behaved public target", async () => {
    fetchMock.mockResolvedValueOnce(ok("<EntityDescriptor/>"));
    const res = await safeFetch("https://idp.partner.example.com/metadata");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("EntityDescriptor");
  });

  it("assertUrlIsSafe combines the literal and the DNS layer", async () => {
    expect((await assertUrlIsSafe("https://127.0.0.1/x")).ok).toBe(false);
    lookupMock.mockResolvedValue([{ address: "192.168.1.10", family: 4 }]);
    expect((await assertUrlIsSafe("https://intranet.example.com/x")).ok).toBe(
      false,
    );
  });
});
