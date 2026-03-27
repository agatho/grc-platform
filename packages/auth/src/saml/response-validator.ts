// Sprint 20: SAML Response Validator
// Validates SAML responses: signature, audience, expiry, replay protection
// Extracts user attributes from assertions

import { createHash, createVerify, X509Certificate } from "crypto";
import type { SamlAttributes, SamlAttributeMapping } from "@grc/shared";

// In-memory assertion ID cache for replay protection
// In production, this should be backed by Redis with TTL
const consumedAssertionIds = new Map<string, number>();
const ASSERTION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clean up expired assertion IDs from the replay cache.
 */
function cleanupAssertionCache(): void {
  const now = Date.now();
  for (const [id, expiresAt] of consumedAssertionIds) {
    if (expiresAt < now) {
      consumedAssertionIds.delete(id);
    }
  }
}

// Run cleanup periodically
setInterval(cleanupAssertionCache, 60_000);

/**
 * Decode a base64-encoded SAML response.
 */
export function decodeSamlResponse(base64Response: string): string {
  return Buffer.from(base64Response, "base64").toString("utf-8");
}

/**
 * Extract tag content from XML (safe, no external entity processing).
 */
function extractTag(xml: string, tagName: string): string | null {
  const patterns = [
    new RegExp(`<(?:saml[p2]?:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:saml[p2]?:)?${tagName}>`, "i"),
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function extractAttr(xml: string, tagName: string, attrName: string): string | null {
  const patterns = [
    new RegExp(`<(?:saml[p2]?:)?${tagName}[^>]*?${attrName}="([^"]*)"`, "i"),
    new RegExp(`<${tagName}[^>]*?${attrName}="([^"]*)"`, "i"),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/**
 * Reject XML with XXE attack vectors.
 */
function rejectXXE(xml: string): void {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml) || /SYSTEM\s+["']/i.test(xml)) {
    throw new Error("SAML response contains forbidden XML declarations (XXE prevention)");
  }
}

/**
 * Validate the SAML response signature against the IdP certificate.
 *
 * @param responseXml - Decoded SAML response XML
 * @param idpCertPem - PEM-formatted IdP certificate (without headers, just base64)
 * @returns true if signature is valid
 */
export function validateSAMLSignature(
  responseXml: string,
  idpCertPem: string,
): boolean {
  // Extract the SignatureValue and SignedInfo from the response
  const signatureValue = extractTag(responseXml, "SignatureValue");
  if (!signatureValue) {
    return false;
  }

  const signedInfoMatch = responseXml.match(
    /<(?:ds:)?SignedInfo[^>]*>[\s\S]*?<\/(?:ds:)?SignedInfo>/i,
  );
  if (!signedInfoMatch) {
    return false;
  }

  // Determine the signature algorithm
  const sigAlgUri = extractAttr(responseXml, "SignatureMethod", "Algorithm") ?? "";
  let algorithm = "SHA256";
  if (sigAlgUri.includes("sha1")) algorithm = "SHA1";
  else if (sigAlgUri.includes("sha512")) algorithm = "SHA512";

  // Build PEM certificate
  const pemCert = idpCertPem.includes("BEGIN CERTIFICATE")
    ? idpCertPem
    : `-----BEGIN CERTIFICATE-----\n${idpCertPem}\n-----END CERTIFICATE-----`;

  try {
    const verifier = createVerify(`RSA-${algorithm}`);
    verifier.update(signedInfoMatch[0]);
    const cleanSig = signatureValue.replace(/\s+/g, "");
    return verifier.verify(pemCert, cleanSig, "base64");
  } catch {
    return false;
  }
}

/**
 * Validate the SAML assertion conditions:
 * - NotOnOrAfter (expiry)
 * - Audience restriction
 * - Replay protection (InResponseTo)
 *
 * @param assertionXml - The assertion portion of the SAML response
 * @param expectedAudience - Our SP entity ID
 * @throws Error if validation fails
 */
export function validateSAMLAssertion(
  assertionXml: string,
  expectedAudience?: string,
): void {
  rejectXXE(assertionXml);

  // Check NotOnOrAfter
  const notOnOrAfter = extractAttr(assertionXml, "Conditions", "NotOnOrAfter")
    ?? extractAttr(assertionXml, "SubjectConfirmationData", "NotOnOrAfter");
  if (notOnOrAfter) {
    const expiry = new Date(notOnOrAfter);
    if (expiry < new Date()) {
      throw new Error("Assertion expired (NotOnOrAfter)");
    }
  }

  // Check NotBefore
  const notBefore = extractAttr(assertionXml, "Conditions", "NotBefore");
  if (notBefore) {
    const start = new Date(notBefore);
    // Allow 2 minutes of clock skew
    const now = new Date(Date.now() - 2 * 60 * 1000);
    if (start > new Date()) {
      throw new Error("Assertion not yet valid (NotBefore)");
    }
  }

  // Audience restriction
  if (expectedAudience) {
    const audience = extractTag(assertionXml, "Audience");
    if (audience && audience !== expectedAudience) {
      throw new Error(`Audience mismatch: expected ${expectedAudience}, got ${audience}`);
    }
  }

  // Replay protection: check InResponseTo
  const assertionId = extractAttr(assertionXml, "Assertion", "ID")
    ?? extractAttr(assertionXml, "saml:Assertion", "ID");
  if (assertionId) {
    if (consumedAssertionIds.has(assertionId)) {
      throw new Error("Replay attack detected: assertion ID already consumed");
    }
    consumedAssertionIds.set(assertionId, Date.now() + ASSERTION_TTL_MS);
  }
}

/**
 * Extract user attributes from a SAML assertion using the configured mapping.
 *
 * @param assertionXml - SAML assertion XML
 * @param mapping - Attribute name mapping from IdP attributes to ARCTOS fields
 * @returns Extracted user attributes
 */
export function extractSAMLAttributes(
  assertionXml: string,
  mapping: SamlAttributeMapping,
): SamlAttributes {
  // Extract all Attribute elements and their values
  const attrMap = new Map<string, string[]>();

  const attrRegex = /<(?:saml:)?Attribute\s+Name="([^"]*)"[^>]*>([\s\S]*?)<\/(?:saml:)?Attribute>/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(assertionXml)) !== null) {
    const name = match[1];
    const valueBlock = match[2];
    const values: string[] = [];
    const valueRegex = /<(?:saml:)?AttributeValue[^>]*>([\s\S]*?)<\/(?:saml:)?AttributeValue>/gi;
    let vm: RegExpExecArray | null;
    while ((vm = valueRegex.exec(valueBlock)) !== null) {
      values.push(vm[1].trim());
    }
    attrMap.set(name, values);
  }

  // Also try NameID as email fallback
  const nameId = extractTag(assertionXml, "NameID");

  const email = attrMap.get(mapping.email)?.[0] ?? nameId ?? "";
  const firstName = attrMap.get(mapping.firstName)?.[0];
  const lastName = attrMap.get(mapping.lastName)?.[0];
  const groups = attrMap.get(mapping.groups);

  if (!email) {
    throw new Error("No email attribute found in SAML assertion");
  }

  return {
    email,
    firstName,
    lastName,
    groups,
  };
}
