// Sprint 20: SAML AuthnRequest Builder
// Builds SP-initiated SAML AuthnRequest XML for IdP redirect

import { randomUUID } from "crypto";

export interface AuthnRequestOptions {
  /** SP entity ID / Issuer (e.g., https://arctos.app/saml) */
  issuer: string;
  /** ACS URL where IdP will POST the response */
  assertionConsumerServiceUrl: string;
  /** IdP SSO URL to redirect to */
  destination: string;
  /** Optional: force re-authentication */
  forceAuthn?: boolean;
}

/**
 * Build a SAML 2.0 AuthnRequest XML document.
 * Returns the XML string and the request ID for InResponseTo validation.
 */
export function buildAuthnRequest(options: AuthnRequestOptions): {
  xml: string;
  requestId: string;
} {
  const requestId = `_${randomUUID().replace(/-/g, "")}`;
  const issueInstant = new Date().toISOString();

  const xml = [
    `<samlp:AuthnRequest`,
    `  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"`,
    `  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
    `  ID="${requestId}"`,
    `  Version="2.0"`,
    `  IssueInstant="${issueInstant}"`,
    `  Destination="${escapeXml(options.destination)}"`,
    `  AssertionConsumerServiceURL="${escapeXml(options.assertionConsumerServiceUrl)}"`,
    `  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`,
    options.forceAuthn ? `  ForceAuthn="true"` : "",
    `>`,
    `  <saml:Issuer>${escapeXml(options.issuer)}</saml:Issuer>`,
    `  <samlp:NameIDPolicy`,
    `    Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"`,
    `    AllowCreate="true"`,
    `  />`,
    `</samlp:AuthnRequest>`,
  ]
    .filter(Boolean)
    .join("\n");

  return { xml, requestId };
}

/**
 * Encode the AuthnRequest for HTTP-Redirect binding.
 * Deflates and base64-encodes the XML, then URL-encodes it.
 */
export function encodeAuthnRequestForRedirect(xml: string): string {
  // For HTTP-Redirect, we need to deflate + base64 encode
  // Using built-in zlib via Node.js
  const buffer = Buffer.from(xml, "utf-8");
  // Use raw deflate (no zlib header)
  const { deflateRawSync } = require("zlib") as typeof import("zlib");
  const deflated = deflateRawSync(buffer);
  return deflated.toString("base64");
}

/**
 * Build the full redirect URL for SP-initiated SSO.
 */
export function buildSamlRedirectUrl(
  idpSsoUrl: string,
  authnRequestXml: string,
  relayState?: string,
): string {
  const encoded = encodeAuthnRequestForRedirect(authnRequestXml);
  const url = new URL(idpSsoUrl);
  url.searchParams.set("SAMLRequest", encoded);
  if (relayState) {
    url.searchParams.set("RelayState", relayState);
  }
  return url.toString();
}

/** Escape special XML characters to prevent injection. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
