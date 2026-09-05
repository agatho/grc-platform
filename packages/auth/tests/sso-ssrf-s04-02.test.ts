// #S04-02 regression contract — audit ARCTOS-FULL-2026-08-31, High.
//
// `fetchAndParseSAMLMetadata()` and `discoverOIDCEndpoints()` called bare
// `fetch()` on an admin-supplied URL that had only passed `z.string().url()`.
// An org admin could point ARCTOS at
//
//   http://169.254.169.254/latest/meta-data/iam/security-credentials/
//   http://postgres:5432
//   http://10.0.0.5/internal-admin
//
// from inside the app server's network, with part of the response reflected
// back through `entityId` / `ssoUrl` and the OIDC endpoints.
//
// WP5 scope note: these two files belong to WP3. Only the URL guard was
// changed there (bare `fetch` → `safeFetch`); this test covers exactly that
// and does not assert anything about signature validation.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

const { fetchAndParseSAMLMetadata } =
  await import("../src/saml/metadata-parser");
const { discoverOIDCEndpoints } = await import("../src/oidc/discovery");

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

const BLOCKED_TARGETS = [
  ["loopback", "https://127.0.0.1/metadata"],
  ["cloud metadata (IMDS)", "https://169.254.169.254/latest/meta-data/"],
  ["IPv6 loopback", "https://[::1]/metadata"],
  ["this-host 0.0.0.0", "https://0.0.0.0/metadata"],
  ["decimal-encoded loopback", "https://2130706433/metadata"],
  ["RFC1918 host", "https://10.0.0.5/metadata"],
  ["internal service name", "https://postgres.internal:5432/metadata"],
  ["cleartext http", "http://idp.example.com/metadata"],
] as const;

describe("#S04-02 — SAML metadata fetch is SSRF-guarded", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  for (const [label, url] of BLOCKED_TARGETS) {
    it(`refuses ${label}: ${url}`, async () => {
      await expect(fetchAndParseSAMLMetadata(url)).rejects.toThrow(
        /Blocked by SSRF guard/,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it("refuses a redirect that lands on a private address", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: "https://169.254.169.254/latest/" }),
    } as unknown as Response);

    await expect(
      fetchAndParseSAMLMetadata("https://idp.partner.example.com/metadata"),
    ).rejects.toThrow(/Blocked by SSRF guard/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a hostname that RESOLVES to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    await expect(
      fetchAndParseSAMLMetadata("https://rebind.example.com/metadata"),
    ).rejects.toThrow(/Blocked by SSRF guard/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still fetches a legitimate public IdP", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers(),
      text: async () =>
        `<EntityDescriptor entityID="https://idp.partner.example.com">
           <IDPSSODescriptor>
             <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
               Location="https://idp.partner.example.com/sso"/>
             <KeyDescriptor><KeyInfo><X509Data><X509Certificate>MIIBAgMBAAE=</X509Certificate></X509Data></KeyInfo></KeyDescriptor>
           </IDPSSODescriptor>
         </EntityDescriptor>`,
    } as unknown as Response);

    const result = await fetchAndParseSAMLMetadata(
      "https://idp.partner.example.com/metadata",
    );
    expect(result.entityId).toBe("https://idp.partner.example.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("#S04-02 — OIDC discovery fetch is SSRF-guarded", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  for (const [label, url] of BLOCKED_TARGETS) {
    it(`refuses ${label}: ${url}`, async () => {
      await expect(discoverOIDCEndpoints(url)).rejects.toThrow(
        /Blocked by SSRF guard/,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it("refuses a redirect that lands on a private address", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: "https://[::1]/openid-configuration" }),
    } as unknown as Response);

    await expect(
      discoverOIDCEndpoints("https://accounts.partner.example.com"),
    ).rejects.toThrow(/Blocked by SSRF guard/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still fetches a legitimate public provider", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: async () => ({
        issuer: "https://accounts.partner.example.com",
        authorization_endpoint: "https://accounts.partner.example.com/auth",
        token_endpoint: "https://accounts.partner.example.com/token",
        jwks_uri: "https://accounts.partner.example.com/jwks",
      }),
    } as unknown as Response);

    const doc = await discoverOIDCEndpoints(
      "https://accounts.partner.example.com",
    );
    expect(doc.issuer).toBe("https://accounts.partner.example.com");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://accounts.partner.example.com/.well-known/openid-configuration",
    );
  });
});
