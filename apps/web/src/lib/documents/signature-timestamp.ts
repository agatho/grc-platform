// RFC 3161 trusted timestamping for the document signature chain.
//
// ── #S06-05 (ARCTOS-FULL-2026-08-31, Medium) ────────────────────────
// `signed_at` was `new Date().toISOString()` on the app container. That
// value goes INTO the content hash and is the whole evidential weight of
// a simple electronic signature — and it was covered by nothing: no
// token, no anchor, no external source. Anyone who could move the
// container clock (or write signed_at and recompute the unkeyed hashes)
// produced a ceremony with an arbitrary date that the platform's own
// verification called "GÜLTIG".
//
// The building block existed the whole time: packages/shared/src/lib/
// freetsa.ts, a full RFC 3161 client that WP4 validated end to end for
// the audit anchor. It just was never wired to the signature chain.
//
// Design decisions, deliberately conservative:
//   * The TSA call happens AFTER the chain link is computed and covers
//     the chain_hash, so the token attests exactly the link. It runs
//     BEFORE the database write, so a granted token is stored together
//     with the row it belongs to.
//   * It is best-effort with a short timeout. An outage of an external
//     service must not make signing impossible. What it must not do is
//     lie: the outcome is recorded per row (`tsa_status`), the
//     certificate prints it, and `verify()` reports it. A signature
//     without a token is shown as one, not as an anchored one.
//   * `SIGNATURE_TSA_ENABLED=0` disables it explicitly (air-gapped
//     installations) — status "disabled", which is again visible rather
//     than indistinguishable from a failure.

import { createHash } from "node:crypto";
import { requestTimestamp } from "@grc/shared/lib/freetsa";

import { log } from "@/lib/logger";
export type SignatureTsaStatus =
  "granted" | "unavailable" | "disabled" | "error";

export interface SignatureTimestamp {
  status: SignatureTsaStatus;
  genTime: Date | null;
  serialNumber: string | null;
  policyOid: string | null;
  proof: Buffer | null;
  /** True only when the TSA chain was verified against a pinned CA. */
  chainVerified: boolean;
  error?: string;
}

const DISABLED: SignatureTimestamp = {
  status: "disabled",
  genTime: null,
  serialNumber: null,
  policyOid: null,
  proof: null,
  chainVerified: false,
};

export function isSignatureTsaEnabled(): boolean {
  // Opt-out rather than opt-in: the whole point of the finding is that
  // the timestamp SHOULD be anchored. An installation that cannot reach
  // a TSA sets the flag and gets an honest "disabled".
  return process.env.SIGNATURE_TSA_ENABLED !== "0";
}

/**
 * Obtain an RFC 3161 token over a signature chain link.
 * Never throws — the outcome is the return value.
 */
export async function timestampChainLink(
  chainHash: string,
): Promise<SignatureTimestamp> {
  if (!isSignatureTsaEnabled()) return DISABLED;

  const imprint = createHash("sha256").update(chainHash, "utf8").digest();
  try {
    const result = await requestTimestamp(imprint, {
      endpoint: process.env.FREETSA_ENDPOINT || undefined,
      timeoutMs: Number(process.env.SIGNATURE_TSA_TIMEOUT_MS ?? 8000),
      // Without a pinned CA the response is still fully signature-checked;
      // chainVerified stays false and is reported as such.
      allowUnpinnedChain: !process.env.FREETSA_CA_PEM,
    });
    if (!result.verified || result.statusCode !== 0) {
      return {
        ...DISABLED,
        status: "error",
        error: `TSA response not granted (status ${result.statusCode}, verified=${result.verified})`,
      };
    }
    return {
      status: "granted",
      genTime: result.genTime ?? null,
      serialNumber: result.serialNumber ?? null,
      policyOid: result.policyOid ?? null,
      proof: result.proof,
      chainVerified: result.chainVerified,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("[signature-timestamp] RFC 3161 timestamp unavailable", {
      err: message,
    });
    return { ...DISABLED, status: "unavailable", error: message };
  }
}
