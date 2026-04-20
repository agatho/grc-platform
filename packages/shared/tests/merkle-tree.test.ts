import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  merkleRoot,
  merkleProof,
  verifyMerkleProof,
  rootOfRawValues,
} from "../src/lib/merkle-tree";

const h = (s: string) => createHash("sha256").update(s).digest("hex");

describe("merkleRoot", () => {
  it("returns null for empty input", () => {
    expect(merkleRoot([])).toBeNull();
  });

  it("returns the leaf unchanged for a single-leaf tree", () => {
    const leaf = h("audit-entry-1");
    expect(merkleRoot([leaf])).toBe(leaf);
  });

  it("is deterministic", () => {
    const leaves = [h("a"), h("b"), h("c"), h("d")];
    expect(merkleRoot(leaves)).toBe(merkleRoot(leaves));
  });

  it("changes when any leaf changes", () => {
    const base = [h("a"), h("b"), h("c")];
    const changed = [h("a"), h("B"), h("c")];
    expect(merkleRoot(base)).not.toBe(merkleRoot(changed));
  });

  it("handles odd-sized levels by promoting the last leaf", () => {
    // Three leaves: pair(a,b) at level 0, then pair(ab, c-duplicated) at level 1
    const a = h("a");
    const b = h("b");
    const c = h("c");
    const pair = (l: string, r: string) =>
      createHash("sha256")
        .update(Buffer.concat([Buffer.from(l, "hex"), Buffer.from(r, "hex")]))
        .digest("hex");
    const expected = pair(pair(a, b), pair(c, c));
    expect(merkleRoot([a, b, c])).toBe(expected);
  });
});

describe("merkleProof + verifyMerkleProof", () => {
  const leaves = Array.from({ length: 10 }, (_, i) => h(`audit-${i}`));
  const root = merkleRoot(leaves)!;

  it("produces a valid proof for every leaf", () => {
    for (let i = 0; i < leaves.length; i++) {
      const proof = merkleProof(leaves, i);
      expect(proof).not.toBeNull();
      expect(verifyMerkleProof(leaves[i], proof!, root)).toBe(true);
    }
  });

  it("rejects a tampered leaf", () => {
    const proof = merkleProof(leaves, 3)!;
    const tampered = h("audit-3-TAMPERED");
    expect(verifyMerkleProof(tampered, proof, root)).toBe(false);
  });

  it("rejects a valid proof against a wrong root", () => {
    const proof = merkleProof(leaves, 5)!;
    const wrongRoot = h("not-the-real-root");
    expect(verifyMerkleProof(leaves[5], proof, wrongRoot)).toBe(false);
  });

  it("returns an empty proof for a single-leaf tree", () => {
    const single = [h("only")];
    const proof = merkleProof(single, 0);
    expect(proof).toEqual([]);
    expect(verifyMerkleProof(single[0], proof!, single[0])).toBe(true);
  });

  it("returns null for an out-of-range index", () => {
    expect(merkleProof(leaves, -1)).toBeNull();
    expect(merkleProof(leaves, leaves.length)).toBeNull();
  });
});

describe("rootOfRawValues", () => {
  it("matches manual hashing", () => {
    const values = ["one", "two", "three"];
    const hashed = values.map((v) => h(v));
    expect(rootOfRawValues(values)).toBe(merkleRoot(hashed));
  });
});
