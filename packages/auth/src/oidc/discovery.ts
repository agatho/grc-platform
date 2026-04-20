// Sprint 20: OIDC Discovery — Fetch .well-known/openid-configuration
import type { OidcDiscoveryDocument } from "@grc/shared";

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
  let url = discoveryUrl.replace(/\/+$/, "");

  if (!url.endsWith(".well-known/openid-configuration")) {
    url = `${url}/.well-known/openid-configuration`;
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
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
