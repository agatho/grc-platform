import { describe, it, expect } from "vitest";
import {
  merkleRoot,
  merkleRootV2,
  merkleRootVersioned,
  merkleProof,
  merkleProofV2,
  verifyMerkleProof,
  verifyMerkleProofV2,
  MERKLE_VERSION_LEGACY,
  MERKLE_VERSION_RFC6962,
} from "../src/lib/merkle-tree";

// [OP-065] `arr[i]` ist unter `noUncheckedIndexedAccess` `T | undefined`.
// In einem Test ist ein fehlendes Element kein Randfall, den man mit `!`
// wegdrückt, sondern ein Fehlschlag mit Namen — `at` macht ihn dazu.
function at<T>(arr: readonly T[], i: number): T {
  const value = arr[i];
  if (value === undefined) {
    throw new Error(`erwartetes Element ${i} fehlt (Länge ${arr.length})`);
  }
  return value;
}

/** 64-char hex leaves, deterministic. */
const L = (n: number) => n.toString(16).padStart(2, "0").repeat(32);

describe("S03-17 — the v1 construction is ambiguous", () => {
  it("v1: [a,b,c] and [a,b,c,c] produce the SAME root (CVE-2012-2459 class)", () => {
    // This is the defect, asserted so it cannot be reintroduced silently
    // and so the reason v2 exists is visible in the test suite.
    const three = [L(1), L(2), L(3)];
    const four = [L(1), L(2), L(3), L(3)];
    expect(merkleRoot(three)).toBe(merkleRoot(four));
  });

  it("v2: the same two leaf sets produce DIFFERENT roots", () => {
    const three = [L(1), L(2), L(3)];
    const four = [L(1), L(2), L(3), L(3)];
    expect(merkleRootV2(three)).not.toBe(merkleRootV2(four));
  });

  it("v2: a root commits to the number of leaves it covers", () => {
    // Two different leaf counts can no longer share a root even if the
    // tree above them happens to coincide — the count is hashed in.
    const a = merkleRootV2([L(1), L(2)]);
    const b = merkleRootV2([L(1), L(2), L(1), L(2)]);
    expect(a).not.toBe(b);
  });

  it("v2: leaf and inner-node hashes use different domains", () => {
    // A single-leaf v2 tree must not equal the raw leaf, otherwise an
    // inner node could be presented as a leaf.
    expect(merkleRootV2([L(7)])).not.toBe(L(7));
    expect(merkleRoot([L(7)])).toBe(L(7)); // v1 did exactly that
  });
});

describe("merkleRootVersioned", () => {
  it("reproduces v1 for anchors written before ADR-011 rev.4", () => {
    const leaves = [L(1), L(2), L(3), L(4), L(5)];
    expect(merkleRootVersioned(leaves, MERKLE_VERSION_LEGACY)).toBe(
      merkleRoot(leaves),
    );
    expect(merkleRootVersioned(leaves, MERKLE_VERSION_RFC6962)).toBe(
      merkleRootV2(leaves),
    );
  });

  it("returns null for an empty leaf set in both versions", () => {
    expect(merkleRootVersioned([], MERKLE_VERSION_LEGACY)).toBeNull();
    expect(merkleRootVersioned([], MERKLE_VERSION_RFC6962)).toBeNull();
  });

  it("is deterministic and order-sensitive", () => {
    expect(merkleRootV2([L(1), L(2)])).toBe(merkleRootV2([L(1), L(2)]));
    expect(merkleRootV2([L(1), L(2)])).not.toBe(merkleRootV2([L(2), L(1)]));
  });
});

describe("inclusion proofs", () => {
  const sizes = [1, 2, 3, 5, 8, 9, 16, 17];

  for (const n of sizes) {
    it(`v2 proof verifies for every leaf of a ${n}-leaf tree`, () => {
      const leaves = Array.from({ length: n }, (_, i) => L(i + 1));
      const root = merkleRootV2(leaves)!;
      for (let i = 0; i < n; i++) {
        const proof = merkleProofV2(leaves, i)!;
        expect(verifyMerkleProofV2(at(leaves, i), proof, root, n)).toBe(true);
      }
    });
  }

  it("v2 proof is rejected when the claimed leaf count is wrong", () => {
    const leaves = [L(1), L(2), L(3), L(4)];
    const root = merkleRootV2(leaves)!;
    const proof = merkleProofV2(leaves, 2)!;
    expect(verifyMerkleProofV2(at(leaves, 2), proof, root, 4)).toBe(true);
    expect(verifyMerkleProofV2(at(leaves, 2), proof, root, 5)).toBe(false);
  });

  it("v2 proof is rejected for a leaf that is not in the tree", () => {
    const leaves = [L(1), L(2), L(3), L(4)];
    const root = merkleRootV2(leaves)!;
    const proof = merkleProofV2(leaves, 1)!;
    expect(verifyMerkleProofV2(L(99), proof, root, 4)).toBe(false);
  });

  it("v1 proofs still verify for historic anchors", () => {
    const leaves = [L(1), L(2), L(3), L(4), L(5)];
    const root = merkleRoot(leaves)!;
    for (let i = 0; i < leaves.length; i++) {
      expect(
        verifyMerkleProof(at(leaves, i), merkleProof(leaves, i)!, root),
      ).toBe(true);
    }
  });
});
