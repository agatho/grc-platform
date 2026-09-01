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
  const buf = Buffer.concat([
    Buffer.from(left, "hex"),
    Buffer.from(right, "hex"),
  ]);
  return sha256Hex(buf);
}

/**
 * ── Merkle v2, RFC 6962 domain separation (ARCTOS / S03-17) ───────────
 *
 * v1 (`merkleRoot`) follows the Bitcoin convention: an odd level pairs
 * its last node with itself. That convention carries the CVE-2012-2459
 * ambiguity — `[a,b,c]` and `[a,b,c,c]` produce the same root — and it
 * hashes leaves and inner nodes with the same function, so an inner node
 * can formally be presented as a leaf. The anchored root therefore does
 * not uniquely determine the set of audit entries it covers; the only
 * disambiguating value was `audit_anchor.leaf_count`, which lived in the
 * same unprotected table as the root itself.
 *
 * v2 fixes both, following RFC 6962 §2:
 *
 *   leaf hash  = SHA256(0x00 || leaf_bytes)
 *   node hash  = SHA256(0x01 || left || right)
 *   odd level  = the last node is PROMOTED unchanged to the next level,
 *                never paired with itself
 *   root       = SHA256(0x02 || leaf_count_be64 || tree_root)
 *
 * The final leaf-count binding means a root commits to how many entries
 * it covers, so `leaf_count` no longer has to be trusted separately.
 *
 * v1 is retained unchanged: anchors already issued were computed with it
 * and must stay verifiable for ever. `audit_anchor.merkle_version`
 * records which construction produced a given root (migration 0403).
 */
export const MERKLE_VERSION_LEGACY = 1;
export const MERKLE_VERSION_RFC6962 = 2;

function leafHash(leafHex: string): Buffer {
  return createHash("sha256")
    .update(Buffer.concat([Buffer.from([0x00]), Buffer.from(leafHex, "hex")]))
    .digest();
}

function nodeHash(left: Buffer, right: Buffer): Buffer {
  return createHash("sha256")
    .update(Buffer.concat([Buffer.from([0x01]), left, right]))
    .digest();
}

/**
 * Build the v2 (RFC 6962) Merkle root over an ordered list of
 * hex-encoded SHA-256 leaves. Returns `null` for an empty input.
 */
export function merkleRootV2(leaves: string[]): string | null {
  if (leaves.length === 0) return null;

  let level = leaves.map(leafHash);
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      // Odd tail: promote, do NOT duplicate. Duplication is what makes
      // [a,b,c] and [a,b,c,c] collide.
      next.push(
        i + 1 < level.length ? nodeHash(level[i], level[i + 1]) : level[i],
      );
    }
    level = next;
  }

  const count = Buffer.alloc(8);
  count.writeBigUInt64BE(BigInt(leaves.length));
  return createHash("sha256")
    .update(Buffer.concat([Buffer.from([0x02]), count, level[0]]))
    .digest("hex");
}

/**
 * Version-dispatching root. Used by the anchor writers (always v2) and by
 * the verifiers, which must reproduce whichever version an anchor was
 * written with.
 */
export function merkleRootVersioned(
  leaves: string[],
  version: number,
): string | null {
  return version >= MERKLE_VERSION_RFC6962
    ? merkleRootV2(leaves)
    : merkleRoot(leaves);
}

/**
 * Build the Merkle root over an ordered list of hex-encoded SHA-256 hashes.
 * Returns `null` for an empty input — the caller must decide what to do
 * with a tenant that had zero audit events on a given day.
 *
 * **v1 — kept for anchors issued before ADR-011 rev.4.** New anchors use
 * `merkleRootV2`. See the block comment above for why.
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
export function merkleProof(
  leaves: string[],
  index: number,
): MerkleProof[] | null {
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
      step.side === "R"
        ? hashPair(running, step.sibling)
        : hashPair(step.sibling, running);
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

/**
 * v2 inclusion proof. The odd tail is promoted rather than duplicated, so
 * a level with an odd count contributes no proof step for its last node.
 */
export function merkleProofV2(
  leaves: string[],
  index: number,
): MerkleProof[] | null {
  if (index < 0 || index >= leaves.length) return null;

  const proof: MerkleProof[] = [];
  let level = leaves.map(leafHash);
  let idx = index;

  while (level.length > 1) {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (pairIdx < level.length) {
      proof.push({
        sibling: level[pairIdx].toString("hex"),
        side: idx % 2 === 0 ? "R" : "L",
      });
    }
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(
        i + 1 < level.length ? nodeHash(level[i], level[i + 1]) : level[i],
      );
    }
    level = next;
    idx = Math.floor(idx / 2);
  }

  return proof;
}

/**
 * Verify a v2 inclusion proof against a root produced by `merkleRootV2`.
 * `leafCount` is required because the v2 root commits to it — a proof
 * that reaches the right tree root but claims the wrong number of leaves
 * is rejected, which is the property v1 lacked.
 */
export function verifyMerkleProofV2(
  leaf: string,
  proof: MerkleProof[],
  expectedRoot: string,
  leafCount: number,
): boolean {
  let running = leafHash(leaf);
  for (const step of proof) {
    const sib = Buffer.from(step.sibling, "hex");
    running =
      step.side === "R" ? nodeHash(running, sib) : nodeHash(sib, running);
  }
  const count = Buffer.alloc(8);
  count.writeBigUInt64BE(BigInt(leafCount));
  const root = createHash("sha256")
    .update(Buffer.concat([Buffer.from([0x02]), count, running]))
    .digest("hex");
  return root === expectedRoot;
}
