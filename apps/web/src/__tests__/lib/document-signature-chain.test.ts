// Unit tests for the document e-signature hash chain
// (W21-DMS-MULTISIGN-01) — build, verify, detect tampering.

import { describe, it, expect } from "vitest";
import {
  buildSignatureLink,
  computeChainHash,
  computeContentHash,
  verifySignatureChain,
  type SignatureChainRow,
  type SignaturePayload,
} from "../../lib/documents/signature-chain";

function payload(overrides: Partial<SignaturePayload> = {}): SignaturePayload {
  return {
    documentId: "d0000000-0000-0000-0000-000000000001",
    versionId: "e0000000-0000-0000-0000-000000000002",
    fileSha256: "a".repeat(64),
    signerUserId: "u0000000-0000-0000-0000-000000000003",
    signedAt: "2026-07-11T10:00:00.000Z",
    decision: "signed",
    ...overrides,
  };
}

function buildChain(count: number): SignatureChainRow[] {
  const rows: SignatureChainRow[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i++) {
    const p = payload({
      signerUserId: `u000000${i}-0000-0000-0000-000000000000`,
      signedAt: `2026-07-11T10:0${i}:00.000Z`,
      decision: i === count - 1 ? "declined" : "signed",
    });
    const link = buildSignatureLink(prev, p);
    rows.push({ ...link, payload: p });
    prev = link.chainHash;
  }
  return rows;
}

describe("signature-chain", () => {
  it("content hash is deterministic and key-order independent", () => {
    const a = computeContentHash(payload());
    const b = computeContentHash(payload());
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("content hash changes when any payload field changes", () => {
    const base = computeContentHash(payload());
    expect(computeContentHash(payload({ decision: "declined" }))).not.toBe(base);
    expect(computeContentHash(payload({ fileSha256: "b".repeat(64) }))).not.toBe(
      base,
    );
    expect(
      computeContentHash(payload({ signedAt: "2026-07-11T10:00:00.001Z" })),
    ).not.toBe(base);
  });

  it("builds a chain anchored to the previous link", () => {
    const rows = buildChain(3);
    expect(rows[0].previousChainHash).toBeNull();
    expect(rows[1].previousChainHash).toBe(rows[0].chainHash);
    expect(rows[2].previousChainHash).toBe(rows[1].chainHash);
    expect(rows[1].chainHash).toBe(
      computeChainHash(rows[0].chainHash, rows[1].contentHash),
    );
  });

  it("verifies an intact chain (incl. a declined link)", () => {
    const rows = buildChain(4);
    const result = verifySignatureChain(rows);
    expect(result.ok).toBe(true);
    expect(result.brokenAt).toBeNull();
    expect(result.links).toHaveLength(4);
    expect(
      result.links.every((l) => l.contentHashValid && l.chainLinkValid),
    ).toBe(true);
  });

  it("verifies the empty chain", () => {
    const result = verifySignatureChain([]);
    expect(result.ok).toBe(true);
    expect(result.brokenAt).toBeNull();
  });

  it("detects payload tampering (row field changed after signing)", () => {
    const rows = buildChain(3);
    // attacker edits the signer on the middle row
    rows[1].payload.signerUserId = "u9999999-0000-0000-0000-000000000000";
    const result = verifySignatureChain(rows);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(1);
    expect(result.links[1].contentHashValid).toBe(false);
    // link 0 stays valid
    expect(result.links[0].contentHashValid).toBe(true);
    expect(result.links[0].chainLinkValid).toBe(true);
  });

  it("detects a re-hashed row (content hash consistent but chain broken)", () => {
    const rows = buildChain(3);
    // attacker replaces the middle payload AND recomputes its content
    // hash — the chain link to the neighbours must still break
    const forged = payload({
      signerUserId: "u9999999-0000-0000-0000-000000000000",
      signedAt: rows[1].payload.signedAt,
    });
    rows[1].payload = forged;
    rows[1].contentHash = computeContentHash(forged);
    const result = verifySignatureChain(rows);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(1);
    expect(result.links[1].contentHashValid).toBe(true);
    expect(result.links[1].chainLinkValid).toBe(false);
  });

  it("detects a deleted middle link", () => {
    const rows = buildChain(3);
    const truncated = [rows[0], rows[2]];
    const result = verifySignatureChain(truncated);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it("detects reordered links", () => {
    const rows = buildChain(3);
    const reordered = [rows[1], rows[0], rows[2]];
    const result = verifySignatureChain(reordered);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(0);
  });
});
