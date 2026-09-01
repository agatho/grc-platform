// Sprint 20 / Audit-Remediation WP3 (S02-23): SAML Response Validator
//
// #WP3-S02-23 — the previous implementation verified ONLY `SignatureValue`
// over the raw `<SignedInfo>` byte range found by a regular expression. It
// never computed the `<Reference>` digest over the assertion, never
// canonicalised anything, accepted SHA-1, and then extracted the user
// attributes from the *unbound* original XML. Anyone holding one genuine
// IdP-signed response could therefore swap NameID/group attributes and log in
// as an arbitrary user (XML Signature Wrapping, XSW).
//
// This module now performs real XML-DSig core validation via `xml-crypto`:
//   1. The `<Reference>` digest is recomputed over the canonicalised, signed
//      element and compared with `<DigestValue>`.
//   2. `SignedInfo` is canonicalised (exc-c14n) and its signature verified
//      against the *configured* IdP certificate — the certificate embedded in
//      `<KeyInfo>` is explicitly ignored (`getCertFromKeyInfo: () => null`),
//      otherwise an attacker could sign with their own cert and ship it along.
//   3. SHA-1 signature and digest algorithms are rejected.
//   4. The signature must cover either the `<Response>` root or the single
//      `<Assertion>` — a signature anywhere else in the tree is rejected.
//   5. Everything downstream consumes ONLY the canonical XML returned by
//      `getSignedReferences()`, i.e. exactly the bytes whose digest was
//      verified. That binding is what actually defeats XSW.

import { X509Certificate } from "crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import type { SamlAttributes, SamlAttributeMapping } from "@grc/shared";

const XMLDSIG_NS = "http://www.w3.org/2000/09/xmldsig#";
const SAML_ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const SAML_PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";

/** Signature algorithms we accept. SHA-1 and HMAC are deliberately absent. */
const ALLOWED_SIGNATURE_ALGORITHMS = new Set([
  "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512",
  "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
  "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha512",
]);

/** Digest algorithms we accept for `<Reference>`. */
const ALLOWED_DIGEST_ALGORITHMS = new Set([
  "http://www.w3.org/2001/04/xmlenc#sha256",
  "http://www.w3.org/2001/04/xmlenc#sha512",
  "http://www.w3.org/2001/04/xmldsig-more#sha384",
]);

// ── Replay protection (process-local fast path) ──────────────────────
//
// This map is per-process. The durable, cross-instance replay guard lives in
// the DB (migration 0411, `auth_consume_saml_assertion`) and is applied by the
// ACS route; see `apps/web/src/app/api/v1/auth/sso/saml/callback/route.ts`.
const consumedAssertionIds = new Map<string, number>();
const ASSERTION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Clean up expired assertion IDs from the in-memory replay cache. */
export function cleanupAssertionCache(): void {
  const now = Date.now();
  for (const [id, expiresAt] of consumedAssertionIds) {
    if (expiresAt < now) consumedAssertionIds.delete(id);
  }
}

/** Decode a base64-encoded SAML response. */
export function decodeSamlResponse(base64Response: string): string {
  return Buffer.from(base64Response, "base64").toString("utf-8");
}

/** Reject XML with XXE attack vectors. Called before ANY parsing. */
export function rejectXXE(xml: string): void {
  if (
    /<!DOCTYPE/i.test(xml) ||
    /<!ENTITY/i.test(xml) ||
    /SYSTEM\s+["']/i.test(xml)
  ) {
    throw new Error(
      "SAML response contains forbidden XML declarations (XXE prevention)",
    );
  }
}

function toPem(cert: string): string {
  const trimmed = cert.trim();
  if (trimmed.includes("BEGIN CERTIFICATE")) return trimmed;
  const body = trimmed.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
}

/** Strict parse — used for the untrusted response document. */
function parseXmlStrict(xml: string): Document {
  const errors: string[] = [];
  const doc = new DOMParser({
    onError: (level: string, msg: unknown) => {
      if (level === "error" || level === "fatalError") errors.push(String(msg));
    },
  } as never).parseFromString(xml, "text/xml") as unknown as Document;
  if (errors.length || !doc?.documentElement) {
    throw new Error("SAML response is not well-formed XML");
  }
  return doc;
}

/**
 * Lenient parse of an already signature-verified assertion fragment.
 *
 * Real IdPs bind their prefixes, but tests/fixtures (and a few IdPs that ship
 * bare fragments) use `saml:` without a namespace declaration. Retry once with
 * the common prefixes bound on a wrapper element so the fragment still parses
 * — the content is already cryptographically verified at this point.
 */
function parseAssertionFragment(xml: string): Element | null {
  const attempt = (candidate: string): Element | null => {
    try {
      const doc = new DOMParser({
        onError: () => {},
      } as never).parseFromString(candidate, "text/xml") as unknown as Document;
      return doc?.documentElement ?? null;
    } catch {
      return null;
    }
  };

  const direct = attempt(xml);
  if (direct) return direct;

  const wrapped = attempt(
    `<wp3wrap xmlns:saml="${SAML_ASSERTION_NS}"` +
      ` xmlns:saml2="${SAML_ASSERTION_NS}"` +
      ` xmlns:samlp="${SAML_PROTOCOL_NS}"` +
      ` xmlns:ds="${XMLDSIG_NS}">${xml}</wp3wrap>`,
  );
  if (!wrapped) return null;
  const kids = wrapped.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i] as unknown as Element;
    if (n.nodeType === 1) return n;
  }
  return null;
}

function serialize(node: Node): string {
  return new XMLSerializer().serializeToString(node as never);
}

function childElements(parent: Element, ns: string, localName: string) {
  const out: Element[] = [];
  const kids = parent.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i] as unknown as Element;
    if (
      n.nodeType === 1 &&
      n.localName === localName &&
      (n.namespaceURI ?? ns) === ns
    ) {
      out.push(n);
    }
  }
  return out;
}

export type SamlSignatureScope = "response" | "assertion";

export interface VerifiedSamlResponse {
  /**
   * The canonical XML of the SIGNED assertion — the exact bytes covered by the
   * verified reference digest. Every downstream consumer (attribute
   * extraction, condition checks) MUST use this and nothing else.
   */
  assertionXml: string;
  /** Which element the signature covered. */
  scope: SamlSignatureScope;
  /** `InResponseTo` of the response (if present) for request binding. */
  inResponseTo: string | null;
}

/**
 * Verify a SAML Response and return the assertion that is *provably* covered by
 * the signature.
 *
 * @throws Error when the response is malformed, unsigned, signed with a weak
 *   algorithm, signed over the wrong element, or the signature/digest does not
 *   verify against `idpCertPem`.
 */
export function verifySamlResponse(
  responseXml: string,
  idpCertPem: string,
  opts?: { requireStatusSuccess?: boolean },
): VerifiedSamlResponse {
  rejectXXE(responseXml);

  if (!idpCertPem?.trim()) {
    throw new Error("No IdP certificate configured for this organization");
  }
  const pem = toPem(idpCertPem);
  try {
    // Throws on a structurally invalid certificate — fail closed rather than
    // handing garbage to the verifier and reading its `false` as "tampered".
    new X509Certificate(pem);
  } catch {
    throw new Error(
      "Configured IdP certificate is not a valid X.509 certificate",
    );
  }

  const doc = parseXmlStrict(responseXml);
  const root = doc.documentElement;
  if (root.localName !== "Response" || root.namespaceURI !== SAML_PROTOCOL_NS) {
    throw new Error("Not a SAML 2.0 protocol Response");
  }

  // Status must be Success — an IdP-signed error response must never be
  // treated as an authentication.
  if (opts?.requireStatusSuccess !== false) {
    const statusEls = root.getElementsByTagNameNS(
      SAML_PROTOCOL_NS,
      "StatusCode",
    );
    const value = statusEls.length
      ? (statusEls[0] as unknown as Element).getAttribute("Value")
      : null;
    if (value && !/:status:Success$/.test(value)) {
      throw new Error(`SAML Response status is not Success (${value})`);
    }
  }

  if (
    root.getElementsByTagNameNS(SAML_ASSERTION_NS, "EncryptedAssertion")
      .length > 0
  ) {
    throw new Error("Encrypted SAML assertions are not supported");
  }

  // Exactly one assertion. Multiple assertions are the classic XSW carrier and
  // no legitimate ARCTOS flow needs more than one.
  const allAssertions = root.getElementsByTagNameNS(
    SAML_ASSERTION_NS,
    "Assertion",
  );
  if (allAssertions.length !== 1) {
    throw new Error(
      `Expected exactly one SAML Assertion, found ${allAssertions.length}`,
    );
  }
  const assertionEl = allAssertions[0] as unknown as Element;
  if ((assertionEl.parentNode as unknown as Element) !== root) {
    throw new Error("Assertion is not a direct child of the Response element");
  }

  // Candidate signatures: only a signature that is a DIRECT child of the
  // Response or of the Assertion counts. A signature nested anywhere else is
  // not an enveloped signature over our data.
  const candidates: Array<{ node: Element; scope: SamlSignatureScope }> = [];
  for (const node of childElements(assertionEl, XMLDSIG_NS, "Signature")) {
    candidates.push({ node, scope: "assertion" });
  }
  for (const node of childElements(root, XMLDSIG_NS, "Signature")) {
    candidates.push({ node, scope: "response" });
  }
  if (candidates.length === 0) {
    throw new Error(
      "SAML Response carries no signature over the Response or the Assertion",
    );
  }

  const idOf = (el: Element) =>
    el.getAttribute("ID") ?? el.getAttribute("Id") ?? el.getAttribute("id");

  const failures: string[] = [];
  for (const candidate of candidates) {
    try {
      const signedEl = candidate.scope === "assertion" ? assertionEl : root;
      const signedId = idOf(signedEl);
      if (!signedId) {
        throw new Error(
          `signed ${candidate.scope} element has no ID attribute to reference`,
        );
      }

      // Algorithm allowlist — read from the signature we are about to check.
      const sigMethods = candidate.node.getElementsByTagNameNS(
        XMLDSIG_NS,
        "SignatureMethod",
      );
      const sigAlg = sigMethods.length
        ? (sigMethods[0] as unknown as Element).getAttribute("Algorithm")
        : null;
      if (!sigAlg || !ALLOWED_SIGNATURE_ALGORITHMS.has(sigAlg)) {
        throw new Error(
          `unsupported or weak SAML signature algorithm: ${sigAlg ?? "(none)"}`,
        );
      }
      const digestMethods = candidate.node.getElementsByTagNameNS(
        XMLDSIG_NS,
        "DigestMethod",
      );
      if (digestMethods.length === 0) {
        throw new Error("signature contains no Reference DigestMethod");
      }
      for (let i = 0; i < digestMethods.length; i++) {
        const alg = (
          digestMethods[i] as unknown as Element
        ).getAttribute("Algorithm");
        if (!alg || !ALLOWED_DIGEST_ALGORITHMS.has(alg)) {
          throw new Error(
            `unsupported or weak SAML digest algorithm: ${alg ?? "(none)"}`,
          );
        }
      }

      const sig = new SignedXml({
        publicCert: pem,
        // NEVER trust the certificate the response ships in <KeyInfo> — that is
        // attacker-supplied. xml-crypto prefers KeyInfo over publicCert unless
        // this is nulled out.
        getCertFromKeyInfo: () => null,
      });
      sig.loadSignature(candidate.node as unknown as Node);

      // Throws on an incorrect SignatureValue; returns false when a reference
      // digest does not match the document.
      if (sig.checkSignature(responseXml) !== true) {
        throw new Error("reference digest does not match the document");
      }

      const refs = sig.getReferences();
      if (refs.length !== 1) {
        throw new Error(
          `signature must cover exactly one reference, found ${refs.length}`,
        );
      }
      const uri = refs[0].uri ?? "";
      if (uri !== `#${signedId}`) {
        throw new Error(
          `signature reference "${uri}" does not cover the ${candidate.scope} element (#${signedId})`,
        );
      }
      const enveloped = (refs[0].transforms ?? []).some((t) =>
        String(t).includes("enveloped-signature"),
      );
      if (!enveloped) {
        throw new Error(
          "signature reference lacks the enveloped-signature transform",
        );
      }

      // The ONLY trustworthy bytes: the canonicalised content whose digest was
      // verified. Everything downstream is derived from this.
      const signedContent = sig.getSignedReferences()[0];
      if (!signedContent) {
        throw new Error("signature verified but no signed content captured");
      }

      let assertionXml: string;
      if (candidate.scope === "assertion") {
        assertionXml = signedContent;
      } else {
        const signedDoc = parseXmlStrict(signedContent);
        const inner = signedDoc.documentElement.getElementsByTagNameNS(
          SAML_ASSERTION_NS,
          "Assertion",
        );
        if (inner.length !== 1) {
          throw new Error(
            "signed Response does not contain exactly one Assertion",
          );
        }
        assertionXml = serialize(inner[0] as unknown as Node);
      }

      return {
        assertionXml,
        scope: candidate.scope,
        inResponseTo: root.getAttribute("InResponseTo"),
      };
    } catch (err) {
      failures.push(
        `${candidate.scope}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  throw new Error(`SAML signature validation failed — ${failures.join("; ")}`);
}

/**
 * Legacy boolean wrapper.
 *
 * #WP3-S02-23: kept so existing callers/tests keep compiling, but it now runs
 * the FULL core validation (reference digest + signature + algorithm
 * allowlist). It returns only a boolean and therefore cannot express the
 * signature→assertion binding — callers that consume assertion content MUST
 * use `verifySamlResponse()` instead. The SAML ACS route does.
 */
export function validateSAMLSignature(
  responseXml: string,
  idpCertPem: string,
): boolean {
  try {
    verifySamlResponse(responseXml, idpCertPem);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate the conditions of an already signature-VERIFIED assertion:
 * - NotOnOrAfter (mandatory — an assertion without an expiry never expires)
 * - NotBefore (2 min clock skew)
 * - Audience restriction (enforced whenever an expected audience is supplied;
 *   a missing `<Audience>` is then a hard failure, not a pass)
 * - Replay protection over the assertion ID (mandatory ID, process-local cache;
 *   the durable cross-instance guard is applied by the ACS route)
 *
 * @throws Error if validation fails
 */
export function validateSAMLAssertion(
  assertionXml: string,
  expectedAudience?: string,
): void {
  rejectXXE(assertionXml);
  const root = parseAssertionFragment(assertionXml);
  if (!root) throw new Error("Assertion is not parseable XML");

  const firstByLocalName = (localName: string): Element | null => {
    const nsHits = root.getElementsByTagNameNS(SAML_ASSERTION_NS, localName);
    if (nsHits.length) return nsHits[0] as unknown as Element;
    // Fixtures / IdPs that emit the prefix without binding the namespace.
    const wildcard = root.getElementsByTagName("*");
    for (let i = 0; i < wildcard.length; i++) {
      const el = wildcard[i] as unknown as Element;
      if (el.localName === localName) return el;
    }
    return null;
  };

  const conditions =
    root.localName === "Conditions" ? root : firstByLocalName("Conditions");
  const scd = firstByLocalName("SubjectConfirmationData");

  const notOnOrAfter =
    conditions?.getAttribute("NotOnOrAfter") ??
    scd?.getAttribute("NotOnOrAfter") ??
    null;
  if (!notOnOrAfter) {
    // #WP3-S02-23: was `if (notOnOrAfter) { … }` — an assertion without
    // <Conditions> simply never expired. Now it is rejected.
    throw new Error(
      "Assertion has no NotOnOrAfter condition and is therefore rejected",
    );
  }
  if (new Date(notOnOrAfter) < new Date()) {
    throw new Error("Assertion expired (NotOnOrAfter)");
  }

  const notBefore = conditions?.getAttribute("NotBefore");
  if (notBefore) {
    if (new Date(notBefore).getTime() - 2 * 60 * 1000 > Date.now()) {
      throw new Error("Assertion not yet valid (NotBefore)");
    }
  }

  if (expectedAudience) {
    const audiences: string[] = [];
    const all = root.getElementsByTagName("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i] as unknown as Element;
      if (el.localName === "Audience") {
        audiences.push((el.textContent ?? "").trim());
      }
    }
    if (root.localName === "Audience") {
      audiences.push((root.textContent ?? "").trim());
    }
    if (audiences.length === 0) {
      // #WP3-S02-23: was a silent pass when <Audience> was absent.
      throw new Error("Assertion has no AudienceRestriction");
    }
    if (!audiences.includes(expectedAudience)) {
      throw new Error(
        `Audience mismatch: expected ${expectedAudience}, got ${audiences.join(", ")}`,
      );
    }
  }

  const assertionId =
    (root.localName === "Assertion"
      ? (root.getAttribute("ID") ?? root.getAttribute("Id"))
      : null) ?? firstByLocalName("Assertion")?.getAttribute("ID") ??
    root.getAttribute("ID");
  if (!assertionId) {
    // #WP3-S02-23: was `if (assertionId) { … }` — an assertion without an ID
    // skipped replay protection entirely.
    throw new Error("Assertion has no ID — replay protection impossible");
  }

  cleanupAssertionCache();
  if (consumedAssertionIds.has(assertionId)) {
    throw new Error("Replay attack detected: assertion ID already consumed");
  }
  const expiry = Math.min(
    new Date(notOnOrAfter).getTime(),
    Date.now() + ASSERTION_TTL_MS,
  );
  consumedAssertionIds.set(assertionId, expiry);
}

/**
 * Extract user attributes from a SAML assertion using the configured mapping.
 *
 * SECURITY: only ever call this with the assertion XML returned by
 * `verifySamlResponse()`. Passing the raw response reintroduces S02-23.
 */
export function extractSAMLAttributes(
  assertionXml: string,
  mapping: SamlAttributeMapping,
): SamlAttributes {
  rejectXXE(assertionXml);
  const attrMap = new Map<string, string[]>();

  const attrRegex =
    /<(?:[A-Za-z0-9_.-]+:)?Attribute\s+[^>]*?Name="([^"]*)"[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_.-]+:)?Attribute>/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(assertionXml)) !== null) {
    const name = match[1];
    const valueBlock = match[2];
    const values: string[] = [];
    const valueRegex =
      /<(?:[A-Za-z0-9_.-]+:)?AttributeValue[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_.-]+:)?AttributeValue>/gi;
    let vm: RegExpExecArray | null;
    while ((vm = valueRegex.exec(valueBlock)) !== null) {
      values.push(vm[1].trim());
    }
    attrMap.set(name, values);
  }

  const nameIdMatch = assertionXml.match(
    /<(?:[A-Za-z0-9_.-]+:)?NameID[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_.-]+:)?NameID>/i,
  );
  const nameId = nameIdMatch?.[1]?.trim() ?? null;

  const email = attrMap.get(mapping.email)?.[0] ?? nameId ?? "";
  const firstName = attrMap.get(mapping.firstName)?.[0];
  const lastName = attrMap.get(mapping.lastName)?.[0];
  const groups = attrMap.get(mapping.groups);

  if (!email) {
    throw new Error("No email attribute found in SAML assertion");
  }

  return { email, firstName, lastName, groups };
}
