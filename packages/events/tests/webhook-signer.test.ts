// Webhook HMAC signing — security-critical pure-crypto tests.
// No mocks, no DB. Verifies tamper-detection contract end-to-end.
//
// Why this matters: ARCTOS dispatches webhook payloads to external systems
// (ERP/HR/IT integrations) signed with HMAC-SHA256. If signing or verification
// is broken, downstream systems either silently accept tampered payloads or
// reject valid ones. Both are P0 incidents.

import { describe, it, expect } from "vitest";
import {
  generateWebhookSecret,
  hashSecret,
  signPayload,
  verifySignature,
} from "../src/webhook-signer";

describe("generateWebhookSecret", () => {
  it("returns secret + hash + last4", () => {
    const { secret, hash, last4 } = generateWebhookSecret();
    expect(secret).toMatch(/^[a-f0-9]{64}$/); // 32 bytes hex
    expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    expect(last4).toBe(secret.slice(-4));
    expect(last4).toHaveLength(4);
  });

  it("produces unique secrets across calls", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a.secret).not.toBe(b.secret);
    expect(a.hash).not.toBe(b.hash);
  });

  it("hash is deterministic for the same secret", () => {
    const { secret, hash } = generateWebhookSecret();
    expect(hashSecret(secret)).toBe(hash);
  });
});

describe("signPayload + verifySignature roundtrip", () => {
  const secretHash =
    "f6f97c2c8d4c0e6f3b8a1d2e7c4f5a9b3c6d8e0f1a2b3c4d5e6f7a8b9c0d1e2f";
  const payload = JSON.stringify({
    event: "risk.created",
    orgId: "org-1",
    entityId: "rsk-1",
  });

  it("signs with sha256 prefix", () => {
    const sig = signPayload(payload, secretHash);
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("verifies a valid signature", () => {
    const sig = signPayload(payload, secretHash);
    expect(verifySignature(payload, sig, secretHash)).toBe(true);
  });

  it("rejects a tampered payload (single byte changed)", () => {
    const sig = signPayload(payload, secretHash);
    const tampered = payload.replace("rsk-1", "rsk-2");
    expect(verifySignature(tampered, sig, secretHash)).toBe(false);
  });

  it("rejects a tampered signature (single hex char flipped)", () => {
    const sig = signPayload(payload, secretHash);
    // Flip one char of the hex digest (after the "sha256=" prefix)
    const flipped =
      sig.slice(0, 8) +
      (sig[8] === "0" ? "1" : "0") +
      sig.slice(9);
    expect(verifySignature(payload, flipped, secretHash)).toBe(false);
  });

  it("rejects when verifying with the wrong secret", () => {
    const sig = signPayload(payload, secretHash);
    const otherHash =
      "0000000000000000000000000000000000000000000000000000000000000000";
    expect(verifySignature(payload, sig, otherHash)).toBe(false);
  });

  it("rejects when signature length differs (no constant-time leak)", () => {
    const sig = signPayload(payload, secretHash);
    const truncated = sig.slice(0, sig.length - 1);
    expect(verifySignature(payload, truncated, secretHash)).toBe(false);
  });

  it("survives empty payload", () => {
    const sig = signPayload("", secretHash);
    expect(verifySignature("", sig, secretHash)).toBe(true);
    expect(verifySignature("a", sig, secretHash)).toBe(false);
  });

  it("survives unicode payload", () => {
    const unicodePayload = JSON.stringify({
      title: "Risiko: Datenübertragung 🔐",
      desc: "测试 — مرحبا",
    });
    const sig = signPayload(unicodePayload, secretHash);
    expect(verifySignature(unicodePayload, sig, secretHash)).toBe(true);
  });
});
