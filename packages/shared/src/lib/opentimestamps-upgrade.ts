/**
 * OpenTimestamps proof upgrade.
 *
 * A freshly submitted proof contains a "pending" attestation — the
 * calendar server accepted our hash and added it to its in-memory
 * Merkle tree, but has not yet committed its aggregate root to a
 * Bitcoin block. Roughly every hour the calendar batches all pending
 * submissions into one transaction; within 1-2 hours of our submit
 * that transaction is included in a block and confirmed.
 *
 * "Upgrading" means: ask the calendar whether the commit is done, and
 * if yes, fetch the full attestation tree that chains:
 *   our hash → calendar Merkle ops → Bitcoin block header hash
 *
 * We use the `javascript-opentimestamps` library for this step rather
 * than re-implementing the OTS tree walker from scratch. The library
 * handles the ~7 operation types, the attestation tags, the
 * interaction with the calendar's /timestamp/<commitment> endpoint,
 * and the final verification math — none of which we want to
 * re-derive by hand.
 *
 * The result is stored back in audit_anchor.proof as base64, with
 * proof_status flipped to 'complete' and bitcoin_block_height set.
 */

// The library is published as CommonJS with a deprecated main field, so we
// pull it dynamically to avoid ESM/CJS interop errors at Next.js build time.
// Using Function('require') lets the bundler leave the call alone.
type OtsExports = {
  DetachedTimestampFile: {
    deserialize: (ctx: unknown) => unknown;
    fromBytes: (op: unknown, bytes: Uint8Array) => unknown;
    fromHash: (op: unknown, hash: Uint8Array) => unknown;
  };
  Context: {
    StreamDeserialization: new (bytes: Uint8Array) => unknown;
  };
  Ops: {
    OpSHA256: new () => unknown;
  };
  upgrade: (dtf: unknown) => Promise<boolean>;
  info: (dtf: unknown) => string;
};

function getOts(): OtsExports {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("javascript-opentimestamps");
}

export interface UpgradeResult {
  /** Whether the upgrade changed the proof (i.e. Bitcoin has confirmed). */
  upgraded: boolean;
  /** The new proof as base64 if upgraded is true, otherwise undefined. */
  newProofBase64?: string;
  /** Best-effort Bitcoin block height extracted from the proof, if present. */
  bitcoinBlockHeight?: number;
  /** Human-readable info dump (for debugging / the lastError field on failure). */
  info?: string;
}

/**
 * Upgrade a single OpenTimestamps proof.
 *
 * Input is the base64-encoded proof we originally stored. We need to
 * reconstruct a full .ots file header around the stub because the
 * calendar's response alone is not a complete DetachedTimestampFile —
 * that structure also needs the file hash op + digest preamble.
 *
 * @param stubBase64  base64 of the pending stub returned by the calendar
 * @param merkleRootHex  the 32-byte SHA-256 that was submitted (our tenant's daily Merkle root)
 */
export async function upgradeOtsProof(
  stubBase64: string,
  merkleRootHex: string,
): Promise<UpgradeResult> {
  const ots = getOts();

  // Build a complete DetachedTimestampFile from our stored stub:
  //   - File hash op = SHA-256
  //   - Digest = the Merkle root we submitted
  //   - Operation tree = the stub returned by the calendar
  // javascript-opentimestamps' fromBytes() expects a complete .ots
  // format (magic header + version + hash-op + digest + tree), which
  // we reconstruct here.
  const magic = Buffer.concat([
    Buffer.from([0x00]),
    Buffer.from("OpenTimestamps", "ascii"),
    Buffer.from([0x00, 0x00]),
    Buffer.from("Proof", "ascii"),
    Buffer.from([0x00]),
    // Proof format magic per python-opentimestamps/timestamp.py
    Buffer.from([0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94]),
  ]);
  const version = Buffer.from([0x01]);
  const sha256Op = Buffer.from([0x08]);
  const digest = Buffer.from(merkleRootHex, "hex");
  const stub = Buffer.from(stubBase64, "base64");

  const full = Buffer.concat([magic, version, sha256Op, digest, stub]);

  const ctx = new ots.Context.StreamDeserialization(full);
  const detached = ots.DetachedTimestampFile.deserialize(ctx);

  // Ask the library to attempt an upgrade. It queries each pending
  // attestation's calendar and splices in the result if available.
  // Returns true if anything changed.
  const changed = await ots.upgrade(detached);

  const info = ots.info(detached);

  // Library serializes the upgraded DetachedTimestampFile back out.
  // We strip our magic header back off so the stored "proof" stays a
  // simple stub (the header is stable and we re-add it on later upgrades).
  let newProofBase64: string | undefined;
  if (changed) {
    // Serialize back. The library exposes a .serialize() method on
    // DetachedTimestampFile that writes into a StreamSerializationContext.
    const out = new (ots as unknown as { Context: { StreamSerialization: new () => { getOutput: () => Uint8Array } } })
      .Context.StreamSerialization();
    (detached as unknown as { serialize: (c: unknown) => void }).serialize(out);
    const serialized = Buffer.from(out.getOutput());

    // Strip the 41-byte header (magic 33 + version 1 + hash-op 1 + digest 32 = 67).
    // Actually: magic = 1 + 14 + 2 + 5 + 1 + 8 = 31 bytes
    //          + version 1 + hash-op 1 + digest 32 = 65 bytes total header
    const headerLen = magic.length + version.length + sha256Op.length + digest.length;
    newProofBase64 = serialized.subarray(headerLen).toString("base64");
  }

  const blockHeight = extractBitcoinBlockHeight(info);

  return {
    upgraded: changed,
    newProofBase64,
    bitcoinBlockHeight: blockHeight,
    info,
  };
}

/**
 * Scan the human-readable info dump for a Bitcoin block attestation.
 * Format looks like:
 *   verify BitcoinBlockHeaderAttestation(840234)
 */
function extractBitcoinBlockHeight(info: string): number | undefined {
  const m = /BitcoinBlockHeaderAttestation\(\s*(\d+)\s*\)/.exec(info);
  return m ? parseInt(m[1], 10) : undefined;
}
