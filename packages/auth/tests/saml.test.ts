// Sprint 20: SAML Service Unit Tests
import { describe, it, expect } from "vitest";
import { parseSAMLMetadata } from "../src/saml/metadata-parser";
import {
  buildAuthnRequest,
  encodeAuthnRequestForRedirect,
  buildSamlRedirectUrl,
} from "../src/saml/request-builder";
import {
  decodeSamlResponse,
  validateSAMLSignature,
  validateSAMLAssertion,
  extractSAMLAttributes,
} from "../src/saml/response-validator";

// ── Metadata Parser ─────────────────────────────────────────

describe("SAMLMetadataParser", () => {
  const validMetadata = `
    <md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="http://www.idp.example.com/exk123">
      <md:IDPSSODescriptor>
        <md:KeyDescriptor use="signing">
          <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
            <ds:X509Data>
              <ds:X509Certificate>MIICxDCCAaygAwIBAgIGAX...</ds:X509Certificate>
            </ds:X509Data>
          </ds:KeyInfo>
        </md:KeyDescriptor>
        <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/sso/saml"/>
      </md:IDPSSODescriptor>
    </md:EntityDescriptor>
  `;

  it("should parse IdP metadata XML and extract entityId, ssoUrl, certificate", () => {
    const result = parseSAMLMetadata(validMetadata);
    expect(result.entityId).toBe("http://www.idp.example.com/exk123");
    expect(result.ssoUrl).toContain("/sso/saml");
    expect(result.certificate).toMatch(/^MIICx/);
  });

  it("should throw when entityID is missing", () => {
    const noEntityId = `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">
      <md:IDPSSODescriptor>
        <md:SingleSignOnService Location="https://sso.example.com"/>
        <ds:X509Certificate xmlns:ds="http://www.w3.org/2000/09/xmldsig#">MIIC</ds:X509Certificate>
      </md:IDPSSODescriptor>
    </md:EntityDescriptor>`;
    expect(() => parseSAMLMetadata(noEntityId)).toThrow("Missing entityID");
  });

  it("should reject XML with DOCTYPE (XXE prevention)", () => {
    const xxe = `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
      <md:EntityDescriptor entityID="test"></md:EntityDescriptor>`;
    expect(() => parseSAMLMetadata(xxe)).toThrow("DOCTYPE");
  });

  it("should reject XML with ENTITY declaration (XXE prevention)", () => {
    const xxe = `<xml><!ENTITY xxe SYSTEM "http://evil.com/payload">
      <md:EntityDescriptor entityID="test"></md:EntityDescriptor></xml>`;
    expect(() => parseSAMLMetadata(xxe)).toThrow("ENTITY");
  });

  it("should reject XML with SYSTEM reference (XXE prevention)", () => {
    const xxe = `<xml SYSTEM "file:///etc/passwd">
      <md:EntityDescriptor entityID="test"></md:EntityDescriptor></xml>`;
    expect(() => parseSAMLMetadata(xxe)).toThrow("SYSTEM");
  });
});

// ── Request Builder ─────────────────────────────────────────

describe("SAMLRequestBuilder", () => {
  it("should build AuthnRequest with correct structure", () => {
    const { xml, requestId } = buildAuthnRequest({
      issuer: "https://arctos.app/saml",
      assertionConsumerServiceUrl: "https://arctos.app/callback",
      destination: "https://idp.example.com/sso",
    });

    expect(xml).toContain("AuthnRequest");
    expect(xml).toContain("https://arctos.app/saml");
    expect(xml).toContain("https://arctos.app/callback");
    expect(xml).toContain("https://idp.example.com/sso");
    expect(requestId).toMatch(/^_[a-f0-9]{32}$/);
  });

  it("should include ForceAuthn when requested", () => {
    const { xml } = buildAuthnRequest({
      issuer: "https://arctos.app/saml",
      assertionConsumerServiceUrl: "https://arctos.app/callback",
      destination: "https://idp.example.com/sso",
      forceAuthn: true,
    });
    expect(xml).toContain('ForceAuthn="true"');
  });

  it("should encode AuthnRequest for HTTP-Redirect binding", () => {
    const { xml } = buildAuthnRequest({
      issuer: "https://arctos.app/saml",
      assertionConsumerServiceUrl: "https://arctos.app/callback",
      destination: "https://idp.example.com/sso",
    });
    const encoded = encodeAuthnRequestForRedirect(xml);
    expect(encoded).toBeTruthy();
    expect(typeof encoded).toBe("string");
  });

  it("should build full redirect URL with SAMLRequest and RelayState", () => {
    const url = buildSamlRedirectUrl(
      "https://idp.example.com/sso",
      "<xml>test</xml>",
      "relay123",
    );
    expect(url).toContain("SAMLRequest=");
    expect(url).toContain("RelayState=relay123");
    expect(url).toMatch(/^https:\/\/idp\.example\.com\/sso/);
  });
});

// ── Response Validator ──────────────────────────────────────

describe("SAMLResponseValidator", () => {
  it("should decode base64 SAML response", () => {
    const original = "<samlp:Response>test</samlp:Response>";
    const encoded = Buffer.from(original).toString("base64");
    expect(decodeSamlResponse(encoded)).toBe(original);
  });

  it("should reject expired SAML assertion (NotOnOrAfter)", () => {
    const expired = `
      <saml:Assertion ID="_test123">
        <saml:Conditions NotOnOrAfter="2020-01-01T00:00:00Z">
          <saml:Audience>https://arctos.app</saml:Audience>
        </saml:Conditions>
      </saml:Assertion>
    `;
    expect(() => validateSAMLAssertion(expired)).toThrow("expired");
  });

  it("should reject SAML assertion with wrong audience", () => {
    const wrongAudience = `
      <saml:Assertion ID="_test456">
        <saml:Conditions NotOnOrAfter="2099-01-01T00:00:00Z">
          <saml:Audience>https://wrong-sp.com</saml:Audience>
        </saml:Conditions>
      </saml:Assertion>
    `;
    expect(() =>
      validateSAMLAssertion(wrongAudience, "https://arctos.app"),
    ).toThrow("Audience mismatch");
  });

  it("should accept valid assertion with correct audience", () => {
    const valid = `
      <saml:Assertion ID="_validid789">
        <saml:Conditions NotOnOrAfter="2099-01-01T00:00:00Z">
          <saml:Audience>https://arctos.app</saml:Audience>
        </saml:Conditions>
      </saml:Assertion>
    `;
    expect(() =>
      validateSAMLAssertion(valid, "https://arctos.app"),
    ).not.toThrow();
  });

  it("should reject replay attack (duplicate assertion ID)", () => {
    const assertion = `
      <saml:Assertion ID="_replay_test_unique">
        <saml:Conditions NotOnOrAfter="2099-01-01T00:00:00Z"/>
      </saml:Assertion>
    `;
    // First time should succeed
    validateSAMLAssertion(assertion);
    // Second time should throw
    expect(() => validateSAMLAssertion(assertion)).toThrow("Replay attack");
  });

  it("should extract user attributes from SAML assertion", () => {
    const assertion = `
      <saml:Assertion>
        <saml:NameID>test@example.de</saml:NameID>
        <saml:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress">
          <saml:AttributeValue>test@example.de</saml:AttributeValue>
        </saml:Attribute>
        <saml:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname">
          <saml:AttributeValue>Max</saml:AttributeValue>
        </saml:Attribute>
        <saml:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname">
          <saml:AttributeValue>Mustermann</saml:AttributeValue>
        </saml:Attribute>
        <saml:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/groups">
          <saml:AttributeValue>GRC-Admins</saml:AttributeValue>
          <saml:AttributeValue>Risk-Team</saml:AttributeValue>
        </saml:Attribute>
      </saml:Assertion>
    `;
    const attrs = extractSAMLAttributes(assertion, {
      email:
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      firstName:
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
      lastName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
      groups: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/groups",
    });
    expect(attrs.email).toBe("test@example.de");
    expect(attrs.firstName).toBe("Max");
    expect(attrs.lastName).toBe("Mustermann");
    expect(attrs.groups).toEqual(["GRC-Admins", "Risk-Team"]);
  });

  it("should use NameID as email fallback", () => {
    const assertion = `
      <saml:Assertion>
        <saml:NameID>fallback@example.de</saml:NameID>
      </saml:Assertion>
    `;
    const attrs = extractSAMLAttributes(assertion, {
      email: "nonexistent",
      firstName: "nonexistent",
      lastName: "nonexistent",
      groups: "nonexistent",
    });
    expect(attrs.email).toBe("fallback@example.de");
  });

  it("should return false for invalid SAML signature", () => {
    const tamperedResponse = `
      <samlp:Response>
        <ds:SignedInfo>
          <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
        </ds:SignedInfo>
        <ds:SignatureValue>INVALIDBASE64SIGNATURE</ds:SignatureValue>
      </samlp:Response>
    `;
    const cert = "MIICxDCCAaygAwIBAgIGAX..."; // Invalid cert
    expect(validateSAMLSignature(tamperedResponse, cert)).toBe(false);
  });

  it("should return false when SignatureValue is missing", () => {
    const noSig = `<samlp:Response><saml:Assertion/></samlp:Response>`;
    expect(validateSAMLSignature(noSig, "cert")).toBe(false);
  });

  it("extracts attributes when start tags carry extra XML attributes", () => {
    // Capture-semantics guard for the `[^>]*` → `[^<>]*` narrowing: every
    // narrowed region here is non-empty and namespaced, so a narrowing that
    // changed what the groups capture would show up as a wrong value rather
    // than as a silent pass on an attribute-free tag.
    const assertion = `
      <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
        <saml:Subject>
          <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" SPNameQualifier="https://sp.example.de">nameid@example.de</saml:NameID>
        </saml:Subject>
        <saml:Attribute Name="mail" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic" FriendlyName="E-Mail">
          <saml:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">attr@example.de</saml:AttributeValue>
        </saml:Attribute>
        <saml:Attribute Name="givenName" FriendlyName="Vorname">
          <saml:AttributeValue xsi:type="xs:string">Erika</saml:AttributeValue>
        </saml:Attribute>
        <saml:Attribute Name="sn" FriendlyName="Nachname">
          <saml:AttributeValue xsi:type="xs:string">Musterfrau</saml:AttributeValue>
        </saml:Attribute>
        <saml:Attribute Name="memberOf" FriendlyName="Gruppen">
          <saml:AttributeValue xsi:type="xs:string">GRC-Admins</saml:AttributeValue>
          <saml:AttributeValue xsi:type="xs:string">Risk-Team</saml:AttributeValue>
        </saml:Attribute>
      </saml:Assertion>
    `;
    const mapping = {
      email: "mail",
      firstName: "givenName",
      lastName: "sn",
      groups: "memberOf",
    };
    const attrs = extractSAMLAttributes(assertion, mapping);
    expect(attrs.email).toBe("attr@example.de");
    expect(attrs.firstName).toBe("Erika");
    expect(attrs.lastName).toBe("Musterfrau");
    expect(attrs.groups).toEqual(["GRC-Admins", "Risk-Team"]);

    // …and the NameID from the same attribute-rich start tag is still the
    // email fallback when the mapped attribute is absent.
    const fallback = extractSAMLAttributes(assertion, {
      ...mapping,
      email: "absent",
    });
    expect(fallback.email).toBe("nameid@example.de");
  });

  it("extracts attributes in linear time (js/polynomial-redos)", () => {
    // Counter-proof for the `[^>]*` / `[^>]*?` start-tag regions that used
    // to sit in `extractSAMLAttributes`. `[^>]` also matches `<`, so on an
    // assertion carrying many `<Attribute ` fragments that never close,
    // every fragment is a viable start position whose inner loop scans to
    // the end of the string. The old classes need ~1.0 s (attrRegex),
    // ~3.4 s (valueRegex) and ~2.2 s (NameID) for these inputs, the
    // narrowed `[^<>]` ~1 ms; the budget is wide enough that only the
    // quadratic behaviour can blow it.
    //
    // This is hardening, not a reachable DoS: `extractSAMLAttributes` only
    // ever runs on an assertion that `verifySamlResponse()` has already
    // validated with real XML-DSig, so producing such an input means a
    // malicious or compromised IdP attacking its own tenant.
    const mapping = {
      email: "mail",
      firstName: "givenName",
      lastName: "sn",
      groups: "memberOf",
    };
    const cases: Array<[string, string]> = [
      // attrRegex: unterminated `<Attribute ` fragments at top level.
      ["attrRegex", "<Attribute ".repeat(20_000)],
      // valueRegex: it only ever runs on `match[2]`, so the fragments have
      // to sit inside an Attribute block that does match.
      [
        "valueRegex",
        `<Attribute Name="mail">${"<AttributeValue ".repeat(20_000)}</Attribute>`,
      ],
      // NameID: unterminated `<NameID ` fragments at top level.
      ["NameID", "<NameID ".repeat(20_000)],
    ];
    for (const [, evil] of cases) {
      const started = performance.now();
      // No mapped attribute and no NameID resolve, so the function refuses —
      // the point is that it refuses fast instead of scanning to the end.
      expect(() => extractSAMLAttributes(evil, mapping)).toThrow(
        /No email attribute found/,
      );
      expect(performance.now() - started).toBeLessThan(300);
    }
  });
});
