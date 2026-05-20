// Hash-chain helpers for sign-off tables (process / audit / vendor).
//
// Pure functions so they can be unit-tested without DB access.
//
// ── Payload field names are historical and deliberately frozen ─────────
// The interface originated for BPM (process_sign_off), so the keys are
// `processId / processName / processVersionId`. When audit and vendor
// adopted the same chain library they reuse these field names by
// convention: an audit's id is passed as `processId`, etc.
//
// **Do NOT rename the keys.** computePayloadHash() serializes the object
// with sorted keys via JSON.stringify, so the field NAMES are part of the
// hash. Renaming would change every hash and break verifyChain() on every
// historical row in production (process_sign_off, audit_sign_off,
// vendor_sign_off all exist with v1-keyed hashes).
//
// To keep call sites readable despite the lying field names, use the
// `buildProcessSignOffPayload / buildAuditSignOffPayload /
//  buildVendorSignOffPayload` helpers below — they accept
// entity-appropriate parameter names and produce the canonical payload.

import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export interface SignOffPayload {
  /** Entity ID. Historical name — holds processId, auditId, or vendorId. */
  processId: string;
  /** Optional display name (process title / audit title / vendor name). */
  processName?: string;
  /** Process-version FK; null for audit and vendor sign-offs. */
  processVersionId: string | null;
  signerId: string;
  signerRole: string;
  signoffType: string;
  comments: string | null;
  statusAtSign?: string;
  signedAt: string; // ISO timestamp
}

interface CommonFields {
  signerId: string;
  signerRole: string;
  signoffType: string;
  comments: string | null;
  statusAtSign?: string;
  signedAt: string;
}

/** Build a sign-off payload for a process. Use this in BPM routes. */
export function buildProcessSignOffPayload(
  args: CommonFields & {
    processId: string;
    processName?: string;
    processVersionId: string | null;
  },
): SignOffPayload {
  return {
    processId: args.processId,
    processName: args.processName,
    processVersionId: args.processVersionId,
    signerId: args.signerId,
    signerRole: args.signerRole,
    signoffType: args.signoffType,
    comments: args.comments,
    statusAtSign: args.statusAtSign,
    signedAt: args.signedAt,
  };
}

/** Build a sign-off payload for an audit. Use this in audit-mgmt routes. */
export function buildAuditSignOffPayload(
  args: CommonFields & { auditId: string; auditTitle?: string },
): SignOffPayload {
  return {
    processId: args.auditId,
    processName: args.auditTitle,
    processVersionId: null,
    signerId: args.signerId,
    signerRole: args.signerRole,
    signoffType: args.signoffType,
    comments: args.comments,
    statusAtSign: args.statusAtSign,
    signedAt: args.signedAt,
  };
}

/** Build a sign-off payload for a vendor. Use this in TPRM routes. */
export function buildVendorSignOffPayload(
  args: CommonFields & { vendorId: string; vendorName?: string },
): SignOffPayload {
  return {
    processId: args.vendorId,
    processName: args.vendorName,
    processVersionId: null,
    signerId: args.signerId,
    signerRole: args.signerRole,
    signoffType: args.signoffType,
    comments: args.comments,
    statusAtSign: args.statusAtSign,
    signedAt: args.signedAt,
  };
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
