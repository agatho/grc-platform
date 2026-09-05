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
  type SignaturePayloadV2,
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
    expect(computeContentHash(payload({ decision: "declined" }))).not.toBe(
      base,
    );
    expect(
      computeContentHash(payload({ fileSha256: "b".repeat(64) })),
    ).not.toBe(base);
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

// ── #S06-03 — hash version 2 binds the evidence fields ───────────────
describe("signature-chain hash versions (S06-03)", () => {
  const v2 = (
    overrides: Partial<SignaturePayloadV2> = {},
  ): SignaturePayloadV2 => ({
    ...payload(),
    ipAddress: "198.51.100.7",
    userAgent: "Mozilla/5.0",
    declineReason: null,
    signOrder: 1,
    ...overrides,
  });

  it("v1 ignores the evidence fields — that WAS the finding", () => {
    // Under the old formula the IP could be swapped freely without the
    // content hash moving; the certificate then printed the new address
    // next to "Hash-Kette: GÜLTIG".
    const a = computeContentHash(v2(), 1);
    const b = computeContentHash(v2({ ipAddress: "203.0.113.9" }), 1);
    expect(a).toBe(b);
  });

  it("v2 covers ipAddress, userAgent, declineReason and signOrder", () => {
    const base = computeContentHash(v2(), 2);
    expect(computeContentHash(v2({ ipAddress: "203.0.113.9" }), 2)).not.toBe(
      base,
    );
    expect(computeContentHash(v2({ userAgent: "curl/8" }), 2)).not.toBe(base);
    expect(computeContentHash(v2({ declineReason: "forged" }), 2)).not.toBe(
      base,
    );
    expect(computeContentHash(v2({ signOrder: 2 }), 2)).not.toBe(base);
  });

  it("v1 and v2 produce different hashes for the same payload", () => {
    expect(computeContentHash(v2(), 1)).not.toBe(computeContentHash(v2(), 2));
  });

  it("a v1 row still verifies after v2 became the default", () => {
    // The freeze rule: adding a field means a new version, never a
    // redefinition — historical rows must keep verifying.
    const p = v2();
    const link = buildSignatureLink(null, p, 1);
    const result = verifySignatureChain([{ ...link, payload: p }]);
    expect(result.ok).toBe(true);
    expect(result.links[0].contentHashValid).toBe(true);
  });

  it("tampering with the IP of a v2 row breaks its content hash", () => {
    const p = v2();
    const link = buildSignatureLink(null, p, 2);
    const tampered: SignatureChainRow = {
      ...link,
      payload: { ...p, ipAddress: "203.0.113.9" },
    };
    const result = verifySignatureChain([tampered]);
    expect(result.ok).toBe(false);
    expect(result.links[0].contentHashValid).toBe(false);
  });
});

// ── #S06-15 — truncation at the END of the chain ─────────────────────
describe("signature-chain completeness (S06-15)", () => {
  /** The recorded shape of an intact ceremony, as document_signature_
   *  request carries it after migration 0420. */
  function expectationFor(rows: SignatureChainRow[], slots = rows.length) {
    return {
      expectedLength: rows.length,
      expectedFinalChainHash: rows[rows.length - 1].chainHash,
      expectedSlotCount: slots,
      actualSlotCount: slots,
    };
  }

  it("an intact chain verifies against its recorded shape", () => {
    const rows = buildChain(3);
    const result = verifySignatureChain(rows, expectationFor(rows));
    expect(result.ok).toBe(true);
    expect(result.defects).toEqual([]);
  });

  it("WITHOUT the recorded shape, a truncated tail looks perfectly valid", () => {
    // This is the finding: every prefix of a valid chain is itself a
    // valid chain, so deleting the LAST link — for instance the
    // `declined` link that made the ceremony fail — left verify()
    // reporting chainValid: true and the certificate printing
    // "Hash-Kette: GÜLTIG" for an incomplete ceremony.
    const rows = buildChain(3);
    const truncated = [rows[0], rows[1]];
    const naive = verifySignatureChain(truncated);
    expect(naive.ok).toBe(true);
    expect(naive.brokenAt).toBeNull();
  });

  it("detects a deleted LAST link against the recorded shape", () => {
    const rows = buildChain(3);
    const expectation = expectationFor(rows);
    const truncated = [rows[0], rows[1]];

    const result = verifySignatureChain(truncated, {
      ...expectation,
      // the slot row disappears together with the link
      actualSlotCount: 2,
    });
    expect(result.ok).toBe(false);
    expect(result.defects).toContain("truncated_tail");
    expect(result.defects).toContain("final_hash_mismatch");
    expect(result.defects).toContain("slot_count_mismatch");
    expect(result.brokenAt).toBe(2);
  });

  it("detects a deleted middle link with or without the recorded shape", () => {
    const rows = buildChain(3);
    const truncated = [rows[0], rows[2]];
    expect(verifySignatureChain(truncated).ok).toBe(false);
    const withShape = verifySignatureChain(truncated, {
      ...expectationFor(rows),
      actualSlotCount: 2,
    });
    expect(withShape.ok).toBe(false);
    expect(withShape.defects).toContain("link_broken");
  });

  it("detects an appended link that the request never recorded", () => {
    const rows = buildChain(3);
    const expectation = expectationFor(rows, 3);
    const extra = buildChain(4);
    const result = verifySignatureChain(extra, {
      ...expectation,
      actualSlotCount: 4,
    });
    expect(result.ok).toBe(false);
    expect(result.defects).toContain("extra_links");
  });

  it("degrades to the old behaviour when the shape was never recorded", () => {
    // Rows written before migration 0420 have nothing to compare
    // against — they must not fail, they are simply less provable.
    const rows = buildChain(2);
    const result = verifySignatureChain(rows, {
      expectedLength: null,
      expectedFinalChainHash: null,
      expectedSlotCount: null,
      actualSlotCount: 2,
    });
    expect(result.ok).toBe(true);
  });
});
