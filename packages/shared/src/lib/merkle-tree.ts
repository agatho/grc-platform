import { createHash } from "node:crypto";

/**
 * Merkle tree over SHA-256 hashes.
 *
 * The tree is built bottom-up by pairing leaves, hashing each pair, and
 * repeating. If a level has an odd number of nodes the last node is
 * duplicated (promoted) to pair with itself — the Bitcoin convention —
 * so the tree always has a single root.
 *
 * Leaves are expected to be 32-byte SHA-256 hashes (64-char lowercase
 * hex). The `entry_hash` column in `audit_log` is already that format.
 *
 * Deterministic byte-for-byte: for a given ordered list of leaves, the
 * root is always identical. That is the only property the external
 * anchor needs — it commits to the root and we later rebuild the tree
 * from stored leaves to prove individual entries were covered.
 *
 * Proofs are encoded as arrays of `{ sibling: hex, side: "L" | "R" }`
 * from leaf to root. Verification walks the proof, hashing the running
 * value with each sibling in the specified order; the result must
 * equal the root.
 */

export interface MerkleProof {
  /** Hex-encoded sibling hash */
  sibling: string;
  /** Which side the sibling is on when pairing with the running hash */
  side: "L" | "R";
}

function sha256Hex(input: string | Buffer): string {
  const h = createHash("sha256");
  h.update(input);
  return h.digest("hex");
}

function hashPair(left: string, right: string): string {
  // Concatenate the raw 32-byte values (parse from hex) then hash.
  // Using concatenated hex strings would bloat the input 2x and change
  // the root compared to "standard" Merkle implementations in other
  // ecosystems.
  const buf = Buffer.concat([Buffer.from(left, "hex"), Buffer.from(right, "hex")]);
  return sha256Hex(buf);
}

/**
 * Build the Merkle root over an ordered list of hex-encoded SHA-256 hashes.
 * Returns `null` for an empty input — the caller must decide what to do
 * with a tenant that had zero audit events on a given day.
 */
export function merkleRoot(leaves: string[]): string | null {
  if (leaves.length === 0) return null;

  let level = leaves.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(hashPair(left, right));
    }
    level = next;
  }
  return level[0];
}

/**
 * Build a Merkle inclusion proof for the leaf at `index`.
 * Returns `null` if the index is out of range.
 */
export function merkleProof(leaves: string[], index: number): MerkleProof[] | null {
  if (index < 0 || index >= leaves.length) return null;
  if (leaves.length === 1) return []; // single-leaf tree: root == leaf

  const proof: MerkleProof[] = [];
  let level = leaves.slice();
  let idx = index;

  while (level.length > 1) {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = pairIdx < level.length ? level[pairIdx] : level[idx];
    proof.push({
      sibling,
      side: idx % 2 === 0 ? "R" : "L", // sibling is on the right when we are the left
    });

    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(hashPair(left, right));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }

  return proof;
}

/**
 * Verify a Merkle inclusion proof. Returns true iff the derived root
 * matches the claimed root.
 */
export function verifyMerkleProof(
  leaf: string,
  proof: MerkleProof[],
  expectedRoot: string,
): boolean {
  let running = leaf;
  for (const step of proof) {
    running =
      step.side === "R" ? hashPair(running, step.sibling) : hashPair(step.sibling, running);
  }
  return running === expectedRoot;
}

/**
 * Convenience: build root from hex strings of arbitrary input data.
 * Useful for tests — the audit_log callers already have SHA-256 hashes.
 */
export function rootOfRawValues(values: Array<string | Buffer>): string | null {
  return merkleRoot(values.map((v) => sha256Hex(v)));
}
