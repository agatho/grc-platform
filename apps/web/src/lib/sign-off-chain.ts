// BPM Overhaul Phase 6: Hash-chain helpers for process_sign_off rows.
//
// Pure functions so they can be unit-tested without DB access.

import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export interface SignOffPayload {
  processId: string;
  processName?: string;
  processVersionId: string | null;
  signerId: string;
  signerRole: string;
  signoffType: string;
  comments: string | null;
  statusAtSign?: string;
  signedAt: string; // ISO timestamp
}

export interface ChainLink {
  payloadHash: string;
  previousChainHash: string | null;
  chainHash: string;
}

export function computePayloadHash(payload: SignOffPayload): string {
  // Stable key order for determinism
  const ordered: Record<string, unknown> = {};
  for (const k of Object.keys(payload).sort()) {
    ordered[k] = (payload as any)[k];
  }
  return sha256(JSON.stringify(ordered));
}

export function computeChainHash(
  previous: string | null,
  payloadHash: string,
): string {
  return sha256((previous ?? "") + payloadHash);
}

export function buildLink(
  previous: string | null,
  payload: SignOffPayload,
): ChainLink {
  const payloadHash = computePayloadHash(payload);
  const chainHash = computeChainHash(previous, payloadHash);
  return { payloadHash, previousChainHash: previous, chainHash };
}

export interface ChainRow {
  payloadHash: string;
  previousChainHash: string | null;
  chainHash: string;
}

/** Verifies a chronologically ordered list of rows. */
export function verifyChain(rowsChrono: ChainRow[]): {
  ok: boolean;
  brokenAt: number | null;
} {
  let prev: string | null = null;
  for (let i = 0; i < rowsChrono.length; i++) {
    const r = rowsChrono[i];
    const expected = computeChainHash(prev, r.payloadHash);
    if (r.previousChainHash !== prev || r.chainHash !== expected) {
      return { ok: false, brokenAt: i };
    }
    prev = r.chainHash;
  }
  return { ok: true, brokenAt: null };
}
