// [ARCTOS-FULL-2026-08-31 · OP-096] Gueltigkeit des IdP-Zertifikats.
//
// Befund (WP3 §5.3): "Die Signaturpruefung ist jetzt korrekt, prueft aber
// weder Ablauf noch Kette des konfigurierten IdP-Zertifikats — ein
// abgelaufenes Zertifikat verifiziert weiterhin."
//
// Der erste Test unten ist die Reproduktion: eine Response, die mit einem
// LAENGST abgelaufenen Zertifikat korrekt signiert ist. Vor dem Fix ging sie
// durch (`verifySamlResponse` hat das Zertifikat nur geparst); jetzt wird sie
// abgelehnt, und die Meldung nennt das Ablaufdatum.
//
// Statt ein abgelaufenes Zertifikat einzuchecken, wird die UHR injiziert
// (`verifySamlResponse(..., { now })`). Begruendung siehe unten.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SignedXml } from "xml-crypto";
import {
  verifySamlResponse,
  inspectIdpCertificate,
  assertIdpCertificateUsable,
} from "../src/saml/response-validator";

/**
 * Ein einziges, langlebiges Schluesselpaar — das eingecheckte Testzertifikat
 * aus `fixtures/`. Der Ablauf wird nicht ueber die Datei erzeugt, sondern
 * ueber die Uhr: `verifySamlResponse(..., { now })`.
 *
 * Warum nicht ein abgelaufenes Fixture einchecken? Weil es genau einmal das
 * Richtige pruefen wuerde. Ein Fixture mit fester Gueltigkeit altert; das
 * "gueltige" Gegenstueck laeuft irgendwann ebenfalls ab, der Test wird rot,
 * und der naechste Leser verlaengert das Zertifikat statt den Befund zu
 * verstehen. Die Uhr zu injizieren macht beide Richtungen dauerhaft pruefbar
 * und kostet in der Produktion nichts: der Parameter hat einen Default.
 */
const KEY = readFileSync(join(__dirname, "fixtures/idp-test-key.pem"), "utf8");
const CERT = readFileSync(
  join(__dirname, "fixtures/idp-test-cert.pem"),
  "utf8",
);

const AUDIENCE = "https://arctos.test/auth/sso/saml";
let seq = 0;

function unsignedResponse(): string {
  const id = `_a${++seq}${Date.now()}`;
  const notOnOrAfter = new Date(Date.now() + 5 * 60_000).toISOString();
  return (
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"` +
    ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r${id}" Version="2.0">` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `<saml:Assertion ID="${id}" Version="2.0" IssueInstant="${new Date().toISOString()}">` +
    `<saml:Issuer>https://idp.example.test</saml:Issuer>` +
    `<saml:Subject><saml:NameID>honest.user@example.test</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">` +
    `<saml:SubjectConfirmationData NotOnOrAfter="${notOnOrAfter}"/>` +
    `</saml:SubjectConfirmation></saml:Subject>` +
    `<saml:Conditions NotOnOrAfter="${notOnOrAfter}">` +
    `<saml:AudienceRestriction><saml:Audience>${AUDIENCE}</saml:Audience></saml:AudienceRestriction>` +
    `</saml:Conditions>` +
    `<saml:AttributeStatement>` +
    `<saml:Attribute Name="email"><saml:AttributeValue>honest.user@example.test</saml:AttributeValue></saml:Attribute>` +
    `</saml:AttributeStatement>` +
    `</saml:Assertion></samlp:Response>`
  );
}

/** Signiert die Assertion echt — dieselbe Mechanik wie saml-signature.test.ts. */
function sign(xml: string, key: string, cert: string): string {
  const sig = new SignedXml({
    privateKey: key,
    publicCert: cert,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  });
  sig.addReference({
    xpath: "//*[local-name(.)='Assertion']",
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
  });
  sig.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='Assertion']", action: "append" },
  });
  return sig.getSignedXml();
}

// Die Gueltigkeit des eingecheckten Testzertifikats — daraus werden die
// Zeitpunkte "davor", "mittendrin", "kurz vor Schluss" und "danach" abgeleitet.
const INFO = inspectIdpCertificate(CERT);
const DAY = 24 * 60 * 60 * 1000;
const NACH_ABLAUF = new Date(INFO.validTo.getTime() + 30 * DAY);
const VOR_BEGINN = new Date(INFO.validFrom.getTime() - 30 * DAY);
const MITTENDRIN = new Date(
  (INFO.validFrom.getTime() + INFO.validTo.getTime()) / 2,
);
const KURZ_VOR_SCHLUSS = new Date(INFO.validTo.getTime() - 5 * DAY);

describe("OP-096 — Ablauf des IdP-Zertifikats", () => {
  it("REPRODUKTION: korrekt signierte Response, Zertifikat abgelaufen -> abgelehnt", () => {
    const signed = sign(unsignedResponse(), KEY, CERT);

    // Kontrolle: die Signatur ist echt und traegt zum Zeitpunkt der
    // Gueltigkeit. Genau daran lag der Befund — die Signaturpruefung war
    // korrekt, und weil sonst nichts geprueft wurde, verifizierte sie auch
    // Jahre nach dem Ablauf des Zertifikats.
    expect(() =>
      verifySamlResponse(signed, CERT, { now: MITTENDRIN }),
    ).not.toThrow();

    expect(() =>
      verifySamlResponse(signed, CERT, { now: NACH_ABLAUF }),
    ).toThrow(/expired on/i);
  });

  it("Zertifikat noch nicht gueltig -> abgelehnt", () => {
    const signed = sign(unsignedResponse(), KEY, CERT);
    expect(() => verifySamlResponse(signed, CERT, { now: VOR_BEGINN })).toThrow(
      /not valid before/i,
    );
  });

  it("die Meldung nennt das Ablaufdatum — sonst wird aus dem Ausfall ein Ticketverlauf", () => {
    const signed = sign(unsignedResponse(), KEY, CERT);
    let message = "";
    try {
      verifySamlResponse(signed, CERT, { now: NACH_ABLAUF });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toContain(INFO.validTo.toISOString());
    expect(message).toContain("sso_config.saml_certificate");
  });

  it("Vorwarnfenster meldet, blockiert aber nicht", () => {
    const info = inspectIdpCertificate(CERT, KURZ_VOR_SCHLUSS);
    expect(info.expired).toBe(false);
    expect(info.expiresSoon).toBe(true);
    expect(info.daysUntilExpiry).toBeLessThanOrEqual(5);

    const signed = sign(unsignedResponse(), KEY, CERT);
    expect(() =>
      verifySamlResponse(signed, CERT, { now: KURZ_VOR_SCHLUSS }),
    ).not.toThrow();
  });

  it("mitten in der Gueltigkeit ist expiresSoon falsch — die Warnung ist keine Dauerwarnung", () => {
    const info = inspectIdpCertificate(CERT, MITTENDRIN);
    expect(info.expiresSoon).toBe(false);
    expect(info.expired).toBe(false);
    expect(info.notYetValid).toBe(false);
  });
});

describe("OP-096 — Ausleseform", () => {
  it("liest Betreff, Aussteller und Gueltigkeit aus dem Testzertifikat", () => {
    expect(INFO.subject).toContain("arctos-test-idp");
    expect(INFO.selfSigned).toBe(true);
    expect(INFO.certificateCount).toBe(1);
    expect(INFO.validTo.getTime()).toBeGreaterThan(INFO.validFrom.getTime());
    expect(() => assertIdpCertificateUsable(CERT, MITTENDRIN)).not.toThrow();
  });

  it("ein Feld ohne Zertifikat wird abgelehnt statt als 'nicht abgelaufen' durchgewinkt", () => {
    expect(() => inspectIdpCertificate("kein zertifikat")).toThrow(
      /not a valid X.509 certificate/i,
    );
  });
});
