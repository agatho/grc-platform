// Hash-chain helpers for the document multi-signer e-signature workflow
// (W21-DMS-MULTISIGN-01, tables document_signature_request /
// document_signature — migration 0375).
//
// Pure functions so they can be unit-tested without DB access
// (pattern: apps/web/src/lib/sign-off-chain.ts).
//
// ── Canonical payload ───────────────────────────────────────────────
// content_hash = SHA-256 over the JSON serialization (sorted keys) of
//   { decision, documentId, fileSha256, signedAt, signerUserId, versionId }
// chain_hash   = SHA-256(previous_chain_hash ?? "" + content_hash)
//
// The field NAMES are part of the hash — do NOT rename them once rows
// exist in production (same freeze rule as sign-off-chain.ts).
//
// signedAt is the millisecond-precision ISO-8601 string produced by
// `new Date().toISOString()`. The same string is stored in
// document_signature.signed_at (timestamptz); a JS-Date roundtrip through
// PostgreSQL is lossless at millisecond precision, so verification can
// recompute the hash from the stored row.

import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export type SignatureDecision = "signed" | "declined";

export interface SignaturePayload {
  documentId: string;
  versionId: string;
  /** Frozen file hash from document_signature_request.file_sha256. */
  fileSha256: string;
  signerUserId: string;
  /** ISO timestamp (new Date().toISOString()). */
  signedAt: string;
  decision: SignatureDecision;
}

export function computeContentHash(payload: SignaturePayload): string {
  // Stable key order for determinism
  const ordered: Record<string, unknown> = {};
  for (const k of Object.keys(payload).sort()) {
    ordered[k] = payload[k as keyof SignaturePayload];
  }
  return sha256(JSON.stringify(ordered));
}

export function computeChainHash(
  previous: string | null,
  contentHash: string,
): string {
  return sha256((previous ?? "") + contentHash);
}

export interface SignatureChainLink {
  contentHash: string;
  previousChainHash: string | null;
  chainHash: string;
}

export function buildSignatureLink(
  previous: string | null,
  payload: SignaturePayload,
): SignatureChainLink {
  const contentHash = computeContentHash(payload);
  const chainHash = computeChainHash(previous, contentHash);
  return { contentHash, previousChainHash: previous, chainHash };
}

// ── Verification ────────────────────────────────────────────────────

export interface SignatureChainRow extends SignatureChainLink {
  /** Recompute input — the payload as reconstructed from the DB row. */
  payload: SignaturePayload;
}

export interface SignatureLinkVerification {
  /** Stored content_hash matches the recomputed payload hash. */
  contentHashValid: boolean;
  /** previous_chain_hash continuity + chain_hash recomputation. */
  chainLinkValid: boolean;
}

export interface SignatureChainVerification {
  ok: boolean;
  /** Index (chronological) of the first broken link, or null. */
  brokenAt: number | null;
  links: SignatureLinkVerification[];
}

/**
 * Verifies a chronologically ordered list of decided signature rows.
 * Checks per link: (1) the stored content_hash still matches the
 * payload reconstructed from the row (tamper detection on row fields),
 * (2) previous_chain_hash points at the predecessor and chain_hash is
 * the correct SHA-256 over (previous + content_hash).
 */
export function verifySignatureChain(
  rowsChrono: SignatureChainRow[],
): SignatureChainVerification {
  const links: SignatureLinkVerification[] = [];
  let prev: string | null = null;
  let brokenAt: number | null = null;

  for (let i = 0; i < rowsChrono.length; i++) {
    const row = rowsChrono[i];
    const recomputedContent = computeContentHash(row.payload);
    const contentHashValid = row.contentHash === recomputedContent;
    const expectedChain = computeChainHash(prev, row.contentHash);
    const chainLinkValid =
      row.previousChainHash === prev && row.chainHash === expectedChain;

    links.push({ contentHashValid, chainLinkValid });
    if ((!contentHashValid || !chainLinkValid) && brokenAt === null) {
      brokenAt = i;
    }
    prev = row.chainHash;
  }

  return { ok: brokenAt === null, brokenAt, links };
}
