// BPM Overhaul Phase 6 E2: Unit tests for sign-off hash chain.

import { describe, it, expect } from "vitest";
import {
  buildLink,
  verifyChain,
  computePayloadHash,
  computeChainHash,
  type SignOffPayload,
} from "@/lib/sign-off-chain";

function payload(overrides: Partial<SignOffPayload> = {}): SignOffPayload {
  return {
    processId: "p1",
    processVersionId: "v1",
    signerId: "u1",
    signerRole: "process_owner",
    signoffType: "approval",
    comments: null,
    signedAt: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("sign-off hash chain", () => {
  it("computePayloadHash is deterministic regardless of key order", () => {
    const a = computePayloadHash(payload());
    const b = computePayloadHash({ ...payload(), signerRole: "process_owner" });
    expect(a).toBe(b);
  });

  it("different payloads produce different hashes", () => {
    expect(computePayloadHash(payload())).not.toBe(
      computePayloadHash(payload({ signerRole: "quality_manager" })),
    );
  });

  it("buildLink links to previous chain hash", () => {
    const l1 = buildLink(null, payload({ signedAt: "2026-05-18T00:00:00.000Z" }));
    const l2 = buildLink(l1.chainHash, payload({ signedAt: "2026-05-18T01:00:00.000Z" }));
    expect(l1.previousChainHash).toBeNull();
    expect(l2.previousChainHash).toBe(l1.chainHash);
    expect(l2.chainHash).toBe(computeChainHash(l1.chainHash, l2.payloadHash));
  });

  it("verifyChain returns ok=true on a clean chain", () => {
    const l1 = buildLink(null, payload({ signedAt: "2026-05-18T00:00:00.000Z" }));
    const l2 = buildLink(l1.chainHash, payload({ signedAt: "2026-05-18T01:00:00.000Z" }));
    const l3 = buildLink(l2.chainHash, payload({ signedAt: "2026-05-18T02:00:00.000Z" }));
    expect(verifyChain([l1, l2, l3])).toEqual({ ok: true, brokenAt: null });
  });

  it("verifyChain detects a tampered payload hash mid-chain", () => {
    const l1 = buildLink(null, payload({ signedAt: "2026-05-18T00:00:00.000Z" }));
    const l2 = buildLink(l1.chainHash, payload({ signedAt: "2026-05-18T01:00:00.000Z" }));
    const tamper = { ...l2, payloadHash: "f".repeat(64) };
    const res = verifyChain([l1, tamper]);
    expect(res.ok).toBe(false);
    expect(res.brokenAt).toBe(1);
  });

  it("verifyChain detects a broken previousChainHash link", () => {
    const l1 = buildLink(null, payload({ signedAt: "2026-05-18T00:00:00.000Z" }));
    const l2 = buildLink(l1.chainHash, payload({ signedAt: "2026-05-18T01:00:00.000Z" }));
    const fakePrev = { ...l2, previousChainHash: "0".repeat(64) };
    expect(verifyChain([l1, fakePrev]).ok).toBe(false);
  });

  it("verifyChain detects swapped order", () => {
    const l1 = buildLink(null, payload({ signedAt: "2026-05-18T00:00:00.000Z" }));
    const l2 = buildLink(l1.chainHash, payload({ signedAt: "2026-05-18T01:00:00.000Z" }));
    expect(verifyChain([l2, l1]).ok).toBe(false);
  });
});
