import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  verifyTimestampResponse,
  buildTimestampRequest,
  parseTimestampResponse,
  TimestampValidationError,
} from "../src/lib/freetsa";

/**
 * S03-11 — the TSA response was never validated.
 *
 * Every test in this file fails against the pre-remediation
 * implementation, because that implementation had no validation to fail:
 * `requestTimestamp` accepted any HTTP 200 whose first PKIStatusInfo
 * integer was 0, and `parseTimestampResponse` read nothing else.
 *
 * The fixture is a real `TimeStampResp` produced by `openssl ts` — see
 * fixtures/README-rfc3161.md. Testing a DER validator against DER from
 * its own encoder would prove nothing.
 */

interface Fixture {
  messageImprintHex: string;
  nonceHex: string;
  responseBase64: string;
  caPem: string;
  tsaCertPem: string;
}

const fx: Fixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "rfc3161-timestamp.json"), "utf8"),
);

const response = Buffer.from(fx.responseBase64, "base64");
const imprint = Buffer.from(fx.messageImprintHex, "hex");
const nonce = Buffer.from(fx.nonceHex, "hex");

describe("verifyTimestampResponse — genuine RFC 3161 response", () => {
  it("accepts a response that attests to the submitted hash", () => {
    const r = verifyTimestampResponse(response, imprint, nonce, {
      caPem: fx.caPem,
    });
    expect(r.statusCode).toBe(0);
    expect(r.verified).toBe(true);
    expect(r.chainVerified).toBe(true);
    expect(r.genTime).toBeInstanceOf(Date);
    expect(r.signerSubject).toContain("ARCTOS Test TSA");
    expect(r.serialNumber).toBeTruthy();
  });

  it("reports chainVerified=false when no trust anchor is configured", () => {
    const r = verifyTimestampResponse(response, imprint, nonce, {
      allowUnpinnedChain: true,
    });
    // The signature is still verified; only the chain is not.
    expect(r.verified).toBe(true);
    expect(r.chainVerified).toBe(false);
  });
});

describe("verifyTimestampResponse — forged and mismatched responses", () => {
  it("rejects a response whose messageImprint is a different hash", () => {
    // The S03-11 core scenario: a valid, correctly signed timestamp that
    // attests to somebody else's data is stored as the anchor for ours.
    expect(() =>
      verifyTimestampResponse(response, Buffer.alloc(32, 0x42), nonce, {
        caPem: fx.caPem,
      }),
    ).toThrowError(
      expect.objectContaining({ reason: "imprint_mismatch" }) as Error,
    );
  });

  it("rejects a replayed response whose nonce is not the one we sent", () => {
    expect(() =>
      verifyTimestampResponse(
        response,
        imprint,
        Buffer.from("0011223344556677", "hex"),
        { caPem: fx.caPem },
      ),
    ).toThrowError(
      expect.objectContaining({ reason: "nonce_mismatch" }) as Error,
    );
  });

  it("rejects a response whose signature was tampered with", () => {
    const forged = Buffer.from(response);
    // [OP-065] `buf[i] ^= x` liest über den Index; `writeUInt8`/`readUInt8`
    // prüfen den Bereich selbst und werfen bei einem Fehlgriff, statt still
    // eine 0 zu verrechnen.
    const pos = forged.length - 20;
    forged.writeUInt8(forged.readUInt8(pos) ^ 0xff, pos);
    expect(() =>
      verifyTimestampResponse(forged, imprint, nonce, { caPem: fx.caPem }),
    ).toThrowError(
      expect.objectContaining({ reason: "signature_invalid" }) as Error,
    );
  });

  it("rejects a response signed by a certificate outside the trust anchor", () => {
    // The TSA certificate itself is not a CA, so pinning to it must not
    // make the token trusted.
    expect(() =>
      verifyTimestampResponse(response, imprint, nonce, {
        caPem: fx.tsaCertPem,
      }),
    ).toThrowError(
      expect.objectContaining({ reason: "chain_untrusted" }) as Error,
    );
  });

  it("rejects PKIStatus != 0, including grantedWithMods", () => {
    // status is the first INTEGER inside the first SEQUENCE. Patch the
    // single status byte from 0 (granted) to 1 (grantedWithMods).
    const modded = Buffer.from(response);
    const idx = modded.indexOf(Buffer.from([0x30, 0x03, 0x02, 0x01, 0x00]));
    expect(idx).toBeGreaterThanOrEqual(0);
    modded[idx + 4] = 1;
    expect(() =>
      verifyTimestampResponse(modded, imprint, nonce, { caPem: fx.caPem }),
    ).toThrowError(expect.objectContaining({ reason: "status" }) as Error);
  });

  it("rejects a status-only response with no timeStampToken", () => {
    // The shape the old implementation happily accepted: PKIStatus 0 and
    // nothing else at all.
    const statusOnly = Buffer.from([0x30, 0x05, 0x30, 0x03, 0x02, 0x01, 0x00]);
    expect(parseTimestampResponse(statusOnly).statusCode).toBe(0);
    expect(() =>
      verifyTimestampResponse(statusOnly, imprint, nonce),
    ).toThrowError(expect.objectContaining({ reason: "no_token" }) as Error);
  });

  it("rejects a response whose eContent no longer matches the signed digest", () => {
    // Flip a byte inside the TSTInfo. The CMS signature still covers the
    // old message-digest attribute, so this must be caught even before
    // the signature check.
    const idx = response.indexOf(Buffer.from(fx.messageImprintHex, "hex"));
    expect(idx).toBeGreaterThanOrEqual(0);
    const mangled = Buffer.from(response);
    mangled.writeUInt8(mangled.readUInt8(idx + 5) ^ 0x01, idx + 5);
    expect(() =>
      verifyTimestampResponse(mangled, imprint, nonce, { caPem: fx.caPem }),
    ).toThrow(TimestampValidationError);
  });
});

describe("splitPem — via the caPem trust anchor", () => {
  // `splitPem` is module-private and stays that way; the only thing that
  // reaches it is the `caPem` option of verifyTimestampResponse, which is
  // enough to observe every branch of it. `caPem` is fed one certificate
  // at a time into `new X509Certificate`, so how the bundle was split is
  // visible in the outcome.

  it("splits a two-certificate bundle into two anchors", () => {
    // The TSA certificate alone is rejected (see the chain_untrusted case
    // above). Put it first and the real CA second: the call can only
    // succeed if both halves were handed to X509Certificate separately —
    // a single un-split blob parses as its first certificate only, which
    // is the TSA cert, and would throw chain_untrusted.
    const bundle = `${fx.tsaCertPem.trim()}\n${fx.caPem.trim()}\n`;
    const r = verifyTimestampResponse(response, imprint, nonce, {
      caPem: bundle,
    });
    expect(r.verified).toBe(true);
    expect(r.chainVerified).toBe(true);
  });

  it("falls back to the whole string when there are no certificate markers", () => {
    // Fallback `[pem]`: the unparseable string reaches X509Certificate and
    // its parse error propagates. Returning `[]` instead would produce a
    // TimestampValidationError("chain_untrusted") — so the error type is
    // what distinguishes the fallback from an empty result.
    let thrown: unknown;
    try {
      verifyTimestampResponse(response, imprint, nonce, {
        caPem: "-- definitely not a certificate --",
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(TimestampValidationError);
  });

  it("scans a BEGIN-heavy bundle in linear time (js/polynomial-redos)", () => {
    // Counter-proof for the lazy `[\s\S]*?` scan this used to be: after
    // the one real certificate, every further BEGIN marker has no END
    // after it, so the old regex expanded to end-of-string once per
    // marker — several seconds for this input against ~0 ms for the
    // indexOf walk. The result is identical either way: one usable
    // anchor, so the call succeeds exactly as with a clean caPem.
    const poisoned = `${fx.caPem.trim()}\n${"-----BEGIN CERTIFICATE-----\n".repeat(40_000)}`;
    const started = performance.now();
    const r = verifyTimestampResponse(response, imprint, nonce, {
      caPem: poisoned,
    });
    const elapsedMs = performance.now() - started;
    expect(r.chainVerified).toBe(true);
    expect(elapsedMs).toBeLessThan(500);
  });
});

describe("buildTimestampRequest", () => {
  it("refuses anything that is not a 32-byte SHA-256 hash", () => {
    expect(() =>
      buildTimestampRequest(Buffer.alloc(20), Buffer.alloc(16)),
    ).toThrow(/32 bytes/);
  });

  it("round-trips through the imprint check of its own validator", () => {
    const req = buildTimestampRequest(imprint, nonce, true);
    // messageImprint must contain the hash verbatim.
    expect(req.includes(imprint)).toBe(true);
    expect(req.includes(nonce)).toBe(true);
  });
});
