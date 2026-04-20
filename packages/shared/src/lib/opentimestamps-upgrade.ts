/**
 * OpenTimestamps proof upgrade — zero-dep stub.
 *
 * The upgrade step turns a "pending" OTS stub (calendar acceptance
 * receipt) into a full Bitcoin-anchored proof. Historically this module
 * wrapped `javascript-opentimestamps`, which transitively pulls in
 * `bitcore-lib`, `web3`, `request`, and `crypto-js` — 14 CVEs, six of
 * them critical (see ADR-011 rev.3 and the audit log for the removal
 * rationale).
 *
 * We dropped that library. OTS **submission** (`opentimestamps.ts`)
 * still works with zero deps and keeps providing redundant
 * tamper-evidence for every daily anchor. The **upgrade** path —
 * implementing the OTS op-tree walker plus calendar poll against the
 * binary `.ots` format — is non-trivial (~250-400 LOC of careful binary
 * parsing) and isn't blocking for Alpha because:
 *
 *   1. FreeTSA (RFC 3161) is the primary tamper-evidence channel and
 *      already yields a full signed timestamp on submit — no upgrade
 *      step needed.
 *   2. Stored OTS pending stubs are still valid standalone artefacts.
 *      Any external `ots` CLI can upgrade and verify them offline when
 *      regulatory evidence is needed.
 *
 * When someone picks this up, the zero-dep reimplementation lives here
 * — submit protocol is in opentimestamps.ts, format docs are in
 * https://github.com/opentimestamps/python-opentimestamps/blob/master/FILE_FORMAT.md.
 */

export interface UpgradeResult {
  /** Whether the upgrade changed the proof. Always false in the stub. */
  upgraded: boolean;
  /** The new proof as base64 if upgraded, otherwise undefined. */
  newProofBase64?: string;
  /** Best-effort Bitcoin block height extracted from the proof. */
  bitcoinBlockHeight?: number;
  /** Human-readable info dump. */
  info?: string;
}

/**
 * Upgrade a single OpenTimestamps proof.
 *
 * Current behaviour: no-op. Returns `upgraded: false` so callers keep
 * polling; existing pending rows remain valid artefacts that external
 * tooling can upgrade on demand.
 */
export async function upgradeOtsProof(
  _stubBase64: string,
  _merkleRootHex: string,
): Promise<UpgradeResult> {
  return {
    upgraded: false,
    info: "OTS in-process upgrade disabled; use external `ots` CLI.",
  };
}
