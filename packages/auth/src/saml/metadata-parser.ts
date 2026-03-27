// Sprint 20: SAML IdP Metadata XML Parser
// Parses IdP metadata to extract entityId, ssoUrl, certificate
// XXE prevention: external entity processing is disabled

import type { SamlMetadataResult } from "@grc/shared";

/**
 * Safe XML tag content extractor (no external dependencies).
 * Avoids full XML parser to prevent XXE attacks entirely.
 */
function extractTagContent(xml: string, tagName: string): string | null {
  // Match both namespaced and non-namespaced tags
  const patterns = [
    new RegExp(`<(?:md:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:md:)?${tagName}>`, "i"),
    new RegExp(`<(?:ds:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:ds:)?${tagName}>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractAttribute(xml: string, tagName: string, attrName: string): string | null {
  const patterns = [
    new RegExp(`<(?:md:)?${tagName}[^>]*${attrName}="([^"]*)"`, "i"),
    new RegExp(`<(?:md:)?${tagName}[^>]*${attrName}='([^']*)'`, "i"),
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

/**
 * Validate XML does not contain external entity declarations (XXE prevention).
 * Throws if DTD or external entities are detected.
 */
function rejectXXE(xml: string): void {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error("XML contains DOCTYPE declaration — rejected for XXE prevention");
  }
  if (/<!ENTITY/i.test(xml)) {
    throw new Error("XML contains ENTITY declaration — rejected for XXE prevention");
  }
  if (/SYSTEM\s+["']/i.test(xml)) {
    throw new Error("XML contains SYSTEM reference — rejected for XXE prevention");
  }
}

/**
 * Parse SAML IdP metadata XML and extract configuration values.
 *
 * @param metadataXml - Raw XML string from IdP metadata endpoint
 * @returns Parsed metadata with entityId, ssoUrl, and certificate
 * @throws Error if required fields are missing or XXE is detected
 */
export function parseSAMLMetadata(metadataXml: string): SamlMetadataResult {
  rejectXXE(metadataXml);

  // Extract entityID from EntityDescriptor
  const entityId = extractAttribute(metadataXml, "EntityDescriptor", "entityID");
  if (!entityId) {
    throw new Error("Missing entityID in IdP metadata");
  }

  // Extract SSO URL from SingleSignOnService with POST or Redirect binding
  let ssoUrl = extractAttribute(
    metadataXml,
    'SingleSignOnService[^>]*Binding="urn:oasis:names:tc:SAML:2\\.0:bindings:HTTP-Redirect"',
    "Location",
  );
  if (!ssoUrl) {
    ssoUrl = extractAttribute(
      metadataXml,
      'SingleSignOnService[^>]*Binding="urn:oasis:names:tc:SAML:2\\.0:bindings:HTTP-POST"',
      "Location",
    );
  }
  // Fallback: try generic SingleSignOnService Location
  if (!ssoUrl) {
    ssoUrl = extractAttribute(metadataXml, "SingleSignOnService", "Location");
  }
  if (!ssoUrl) {
    throw new Error("Missing SingleSignOnService URL in IdP metadata");
  }

  // Extract X.509 certificate
  const certificate = extractTagContent(metadataXml, "X509Certificate");
  if (!certificate) {
    throw new Error("Missing X509Certificate in IdP metadata");
  }

  // Clean certificate (remove whitespace/newlines)
  const cleanCert = certificate.replace(/\s+/g, "");

  return {
    entityId,
    ssoUrl,
    certificate: cleanCert,
  };
}

/**
 * Fetch and parse SAML metadata from a URL.
 */
export async function fetchAndParseSAMLMetadata(
  metadataUrl: string,
): Promise<SamlMetadataResult> {
  const response = await fetch(metadataUrl, {
    headers: { Accept: "application/xml, text/xml" },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch IdP metadata: ${response.status} ${response.statusText}`,
    );
  }

  const xml = await response.text();
  return parseSAMLMetadata(xml);
}
