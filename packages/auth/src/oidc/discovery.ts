// Sprint 20: OIDC Discovery — Fetch .well-known/openid-configuration
import type { OidcDiscoveryDocument } from "@grc/shared";
// #S04-02: SSRF guard (literal + DNS + per-redirect-hop re-validation).
import { safeFetch } from "@grc/shared/lib/url-safety-server";

/**
 * Fetch the OIDC discovery document from the provider.
 * Automatically appends .well-known/openid-configuration if not present.
 *
 * @param discoveryUrl - Base issuer URL or full .well-known URL
 * @returns Parsed OIDC discovery document
 */
export async function discoverOIDCEndpoints(
  discoveryUrl: string,
): Promise<OidcDiscoveryDocument> {
  // [CodeQL js/polynomial-redos] `.replace(/\/+$/, "")` is quadratic:
  // on "…" + "/".repeat(n) + "x" the engine restarts at every slash,
  // consumes the whole remaining run, fails the anchor, backtracks —
  // O(n²) for a URL whose slash run is not the very end of the string.
  // The loop below strips exactly the same maximal run of trailing
  // slashes (and nothing else, since `/+$` can only ever match trailing
  // slashes) in O(n). `discoveryUrl` is operator-supplied SSO
  // configuration, so this is hardening, not a reachable DoS.
  let url = discoveryUrl;
  while (url.endsWith("/")) url = url.slice(0, -1);

  if (!url.endsWith(".well-known/openid-configuration")) {
    url = `${url}/.well-known/openid-configuration`;
  }

  // #S04-02 (ARCTOS-FULL-2026-08-31, High) — SSRF. `discoveryUrl` comes
  // from the org's SSO configuration and only passed `z.string().url()`;
  // the bare `fetch` here reached cloud metadata endpoints and internal
  // services from the app server.
  //
  // WP5 scope note: this file belongs to WP3 (OIDC signature work). Only
  // the URL guard changes here — the discovery-document validation below
  // is untouched.
  const response = await safeFetch(url, {
    headers: { Accept: "application/json" },
    timeoutMs: 10000,
    requireHttps: true,
    purpose: "OIDC discovery",
    maxRedirects: 3,
  });

  if (!response.ok) {
    throw new Error(
      `OIDC discovery failed: ${response.status} ${response.statusText}`,
    );
  }

  const doc = await response.json();

  // Validate required fields
  if (!doc.issuer) throw new Error("OIDC discovery: missing issuer");
  if (!doc.authorization_endpoint)
    throw new Error("OIDC discovery: missing authorization_endpoint");
  if (!doc.token_endpoint)
    throw new Error("OIDC discovery: missing token_endpoint");
  if (!doc.jwks_uri) throw new Error("OIDC discovery: missing jwks_uri");

  return {
    issuer: doc.issuer,
    authorization_endpoint: doc.authorization_endpoint,
    token_endpoint: doc.token_endpoint,
    userinfo_endpoint: doc.userinfo_endpoint ?? null,
    jwks_uri: doc.jwks_uri,
    end_session_endpoint: doc.end_session_endpoint ?? null,
  };
}
