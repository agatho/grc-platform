// #WP3-S02-23 — SAML signature/digest negative tests.
//
// These reproduce the audit finding: with the pre-fix validator a genuinely
// IdP-signed response whose Assertion body was rewritten (NameID + group
// attribute) still verified, because only `SignatureValue` over `SignedInfo`
// was checked and `DigestValue` was never recomputed. Every "tampered" case
// below MUST now be rejected, and the honest case MUST still pass.

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { SignedXml } from "xml-crypto";
import {
  verifySamlResponse,
  validateSAMLSignature,
  validateSAMLAssertion,
  extractSAMLAttributes,
  cleanupAssertionCache,
} from "../src/saml/response-validator";

const KEY = readFileSync(join(__dirname, "fixtures/idp-test-key.pem"), "utf8");
const CERT = readFileSync(
  join(__dirname, "fixtures/idp-test-cert.pem"),
  "utf8",
);
const OTHER_CERT_SUBJECT = "CN=someone-else";

const AUDIENCE = "https://arctos.test/auth/sso/saml";

let seq = 0;
function unsignedResponse(opts?: {
  email?: string;
  group?: string;
  assertionId?: string;
}): { xml: string; assertionId: string } {
  const assertionId = opts?.assertionId ?? `_a${++seq}${Date.now()}`;
  const email = opts?.email ?? "honest.user@example.test";
  const group = opts?.group ?? "GRC-Viewers";
  const notOnOrAfter = new Date(Date.now() + 5 * 60_000).toISOString();
  const xml =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"` +
    ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r${assertionId}" Version="2.0">` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `<saml:Assertion ID="${assertionId}" Version="2.0" IssueInstant="${new Date().toISOString()}">` +
    `<saml:Issuer>https://idp.example.test</saml:Issuer>` +
    `<saml:Subject><saml:NameID>${email}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">` +
    `<saml:SubjectConfirmationData NotOnOrAfter="${notOnOrAfter}"/>` +
    `</saml:SubjectConfirmation></saml:Subject>` +
    `<saml:Conditions NotOnOrAfter="${notOnOrAfter}">` +
    `<saml:AudienceRestriction><saml:Audience>${AUDIENCE}</saml:Audience></saml:AudienceRestriction>` +
    `</saml:Conditions>` +
    `<saml:AttributeStatement>` +
    `<saml:Attribute Name="email"><saml:AttributeValue>${email}</saml:AttributeValue></saml:Attribute>` +
    `<saml:Attribute Name="memberOf"><saml:AttributeValue>${group}</saml:AttributeValue></saml:Attribute>` +
    `</saml:AttributeStatement>` +
    `</saml:Assertion></samlp:Response>`;
  return { xml, assertionId };
}

/** Produce a genuinely IdP-signed response (assertion-scoped signature). */
function signResponse(
  xml: string,
  assertionId: string,
  algo: {
    signature?: string;
    digest?: string;
  } = {},
): string {
  const sig = new SignedXml({
    privateKey: KEY,
    publicCert: CERT,
    signatureAlgorithm:
      algo.signature ?? "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  });
  sig.addReference({
    xpath: `//*[local-name(.)='Assertion']`,
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    digestAlgorithm: algo.digest ?? "http://www.w3.org/2001/04/xmlenc#sha256",
    uri: `#${assertionId}`,
  });
  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='Assertion']`, action: "append" },
  });
  return sig.getSignedXml();
}

describe("S02-23 — SAML signature core validation", () => {
  beforeEach(() => cleanupAssertionCache());

  it("accepts a genuinely signed, untampered response and binds the assertion", () => {
    const { xml, assertionId } = unsignedResponse({
      email: "honest.user@example.test",
    });
    const signed = signResponse(xml, assertionId);

    const result = verifySamlResponse(signed, CERT);
    expect(result.scope).toBe("assertion");
    const attrs = extractSAMLAttributes(result.assertionXml, {
      email: "email",
      firstName: "givenName",
      lastName: "sn",
      groups: "memberOf",
    });
    expect(attrs.email).toBe("honest.user@example.test");
    expect(attrs.groups).toEqual(["GRC-Viewers"]);
  });

  it("REJECTS a response whose NameID/email was rewritten after signing (S02-23 PoC)", () => {
    const { xml, assertionId } = unsignedResponse({
      email: "honest.user@example.test",
    });
    const signed = signResponse(xml, assertionId);

    // The attacker keeps <Signature> byte-identical and only edits the
    // assertion body — exactly the reproduction in the audit report.
    const tampered = signed.replace(
      /honest\.user@example\.test/g,
      "admin@victim-org.test",
    );
    expect(tampered).not.toBe(signed);
    expect(tampered).toContain("SignatureValue");

    expect(() => verifySamlResponse(tampered, CERT)).toThrow();
    expect(validateSAMLSignature(tampered, CERT)).toBe(false);
  });

  it("REJECTS a response whose group attribute was escalated after signing", () => {
    const { xml, assertionId } = unsignedResponse({ group: "GRC-Viewers" });
    const signed = signResponse(xml, assertionId);
    const tampered = signed.replace("GRC-Viewers", "GRC-Admins");
    expect(() => verifySamlResponse(tampered, CERT)).toThrow();
  });

  it("REJECTS XML Signature Wrapping (second, unsigned assertion injected)", () => {
    const { xml, assertionId } = unsignedResponse();
    const signed = signResponse(xml, assertionId);
    const evil =
      `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_evil" Version="2.0">` +
      `<saml:Subject><saml:NameID>attacker@victim-org.test</saml:NameID></saml:Subject>` +
      `</saml:Assertion>`;
    const wrapped = signed.replace("<saml:Assertion", `${evil}<saml:Assertion`);
    expect(() => verifySamlResponse(wrapped, CERT)).toThrow(
      /exactly one SAML Assertion/,
    );
  });

  it("REJECTS a response signed by a different key", () => {
    const { xml, assertionId } = unsignedResponse();
    const signed = signResponse(xml, assertionId);
    // A structurally valid but different certificate.
    const otherCert = readFileSync(
      join(__dirname, "fixtures/idp-other-cert.pem"),
      "utf8",
    );
    expect(otherCert).toContain("BEGIN CERTIFICATE");
    expect(OTHER_CERT_SUBJECT).toBeTruthy();
    expect(() => verifySamlResponse(signed, otherCert)).toThrow();
  });

  it("REJECTS SHA-1 signature algorithm", () => {
    const { xml, assertionId } = unsignedResponse();
    const signed = signResponse(xml, assertionId, {
      signature: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
      digest: "http://www.w3.org/2000/09/xmldsig#sha1",
    });
    expect(() => verifySamlResponse(signed, CERT)).toThrow(/weak|unsupported/i);
  });

  it("REJECTS an unsigned response", () => {
    const { xml } = unsignedResponse();
    expect(() => verifySamlResponse(xml, CERT)).toThrow(/no signature/i);
  });

  it("REJECTS an assertion without <Conditions> (never-expiring assertion)", () => {
    const noConditions =
      `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_nc1">` +
      `<saml:Subject><saml:NameID>x@example.test</saml:NameID></saml:Subject>` +
      `</saml:Assertion>`;
    expect(() => validateSAMLAssertion(noConditions, AUDIENCE)).toThrow(
      /NotOnOrAfter/,
    );
  });

  it("REJECTS an assertion without AudienceRestriction when an audience is expected", () => {
    const noAudience =
      `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_na1">` +
      `<saml:Conditions NotOnOrAfter="2099-01-01T00:00:00Z"/>` +
      `</saml:Assertion>`;
    expect(() => validateSAMLAssertion(noAudience, AUDIENCE)).toThrow(
      /AudienceRestriction/,
    );
  });

  it("REJECTS an assertion without an ID (replay protection impossible)", () => {
    const noId =
      `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
      `<saml:Conditions NotOnOrAfter="2099-01-01T00:00:00Z">` +
      `<saml:AudienceRestriction><saml:Audience>${AUDIENCE}</saml:Audience></saml:AudienceRestriction>` +
      `</saml:Conditions></saml:Assertion>`;
    expect(() => validateSAMLAssertion(noId, AUDIENCE)).toThrow(/no ID/);
  });

  it("REJECTS a non-Success SAML status", () => {
    const { xml, assertionId } = unsignedResponse();
    const failed = xml.replace(
      "urn:oasis:names:tc:SAML:2.0:status:Success",
      "urn:oasis:names:tc:SAML:2.0:status:Responder",
    );
    const signed = signResponse(failed, assertionId);
    expect(() => verifySamlResponse(signed, CERT)).toThrow(/not Success/);
  });
});
