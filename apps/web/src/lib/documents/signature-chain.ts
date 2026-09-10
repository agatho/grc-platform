// Hash-chain helpers for the document multi-signer e-signature workflow
// (W21-DMS-MULTISIGN-01, tables document_signature_request /
// document_signature — migration 0375, extended by 0420/0421).
//
// Pure functions so they can be unit-tested without DB access
// (pattern: apps/web/src/lib/sign-off-chain.ts).
//
// ── Canonical payload ───────────────────────────────────────────────
// hash_version 1 (rows written before ARCTOS-FULL-2026-08-31):
//   content_hash = SHA-256 over the JSON serialization (sorted keys) of
//     { decision, documentId, fileSha256, signedAt, signerUserId, versionId }
//
// hash_version 2 (#S06-03) additionally covers the evidence fields the
// signing dialog promises to record:
//     { …v1, declineReason, ipAddress, signOrder, userAgent }
//   The UI told the signer "Zeitpunkt, IP-Adresse und ein
//   kryptografischer Hash des Dokuments werden protokolliert" while the
//   IP, the user agent, the decline reason and the sign order were all
//   OUTSIDE the hash — anyone with UPDATE rights could swap them and
//   the chain still verified. They are inside it now.
//
// chain_hash = SHA-256(previous_chain_hash ?? "" + content_hash)
//
// The field NAMES are part of the hash — do NOT rename them once rows
// exist in production (same freeze rule as sign-off-chain.ts). Adding a
// field means a NEW hash_version, never a redefinition of an old one:
// existing rows must keep verifying under the formula they were
// written with.
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

/** Hash formula in force for newly written links. */
export const CURRENT_SIGNATURE_HASH_VERSION = 2;

export interface SignaturePayloadV1 {
  documentId: string;
  versionId: string;
  /** Frozen file hash from document_signature_request.file_sha256. */
  fileSha256: string;
  signerUserId: string;
  /** ISO timestamp (new Date().toISOString()). */
  signedAt: string;
  decision: SignatureDecision;
}

/** #S06-03 — v2 binds the evidence fields into the chain. */
export interface SignaturePayloadV2 extends SignaturePayloadV1 {
  /** Resolved client IP, or null when it could not be established. */
  ipAddress: string | null;
  userAgent: string | null;
  declineReason: string | null;
  signOrder: number;
}

export type SignaturePayload = SignaturePayloadV1 | SignaturePayloadV2;

const V1_KEYS = [
  "decision",
  "documentId",
  "fileSha256",
  "signedAt",
  "signerUserId",
  "versionId",
] as const;

const V2_KEYS = [
  ...V1_KEYS,
  "declineReason",
  "ipAddress",
  "signOrder",
  "userAgent",
] as const;

function keysForVersion(version: number): readonly string[] {
  return version >= 2 ? [...V2_KEYS].sort() : [...V1_KEYS].sort();
}

/**
 * Canonical content hash. `version` selects the field set, so a v1 row
 * keeps verifying with the exact bytes it was written with even after
 * v2 became the default.
 */
export function computeContentHash(
  payload: SignaturePayload,
  version: number = CURRENT_SIGNATURE_HASH_VERSION,
): string {
  const source = payload as unknown as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (const k of keysForVersion(version)) {
    ordered[k] = source[k] ?? null;
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
  hashVersion: number;
}

export function buildSignatureLink(
  previous: string | null,
  payload: SignaturePayload,
  version: number = CURRENT_SIGNATURE_HASH_VERSION,
): SignatureChainLink {
  const contentHash = computeContentHash(payload, version);
  const chainHash = computeChainHash(previous, contentHash);
  return {
    contentHash,
    previousChainHash: previous,
    chainHash,
    hashVersion: version,
  };
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

/**
 * #S06-15 — a hash chain verified from the head forward cannot see that
 * something was cut off the END: every prefix of a valid chain is
 * itself a valid chain. `verify()` therefore reported chainValid:true
 * for a ceremony whose final (e.g. `declined`) link had been deleted,
 * and the certificate printed "Hash-Kette: GÜLTIG" for an incomplete
 * ceremony.
 *
 * The request row now carries the expected shape (0420:
 * signature_count, chain_length, final_chain_hash) and passes it in
 * here. Without these fields the check degrades to the old behaviour
 * rather than failing — rows written before the migration have nothing
 * to compare against.
 */
export interface SignatureChainExpectation {
  /** Number of decided links the request row recorded. */
  expectedLength?: number | null;
  /** chain_hash of the last decided link the request row recorded. */
  expectedFinalChainHash?: string | null;
  /** Number of signer slots the request was created with. */
  expectedSlotCount?: number | null;
  /** Number of signer slots actually present. */
  actualSlotCount?: number | null;
}

export type SignatureChainDefect =
  | "link_broken"
  | "truncated_tail"
  | "extra_links"
  | "final_hash_mismatch"
  | "slot_count_mismatch";

export interface SignatureChainVerification {
  ok: boolean;
  /** Index (chronological) of the first broken link, or null. */
  brokenAt: number | null;
  links: SignatureLinkVerification[];
  /** Every defect found, including the completeness checks. */
  defects: SignatureChainDefect[];
}

/**
 * Verifies a chronologically ordered list of decided signature rows.
 * Checks per link: (1) the stored content_hash still matches the
 * payload reconstructed from the row (tamper detection on row fields),
 * (2) previous_chain_hash points at the predecessor and chain_hash is
 * the correct SHA-256 over (previous + content_hash).
 *
 * With an `expectation` it additionally checks that the chain is
 * COMPLETE — see SignatureChainExpectation (#S06-15).
 */
export function verifySignatureChain(
  rowsChrono: SignatureChainRow[],
  expectation: SignatureChainExpectation = {},
): SignatureChainVerification {
  const links: SignatureLinkVerification[] = [];
  const defects: SignatureChainDefect[] = [];
  let prev: string | null = null;
  let brokenAt: number | null = null;

  for (let i = 0; i < rowsChrono.length; i++) {
    const row = rowsChrono[i];
    const recomputedContent = computeContentHash(
      row.payload,
      row.hashVersion ?? 1,
    );
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
  if (brokenAt !== null) defects.push("link_broken");

  // ── Completeness (#S06-15) ────────────────────────────────────────
  const expectedLength = expectation.expectedLength;
  if (typeof expectedLength === "number") {
    if (rowsChrono.length < expectedLength) {
      defects.push("truncated_tail");
      if (brokenAt === null) brokenAt = rowsChrono.length;
    } else if (rowsChrono.length > expectedLength) {
      defects.push("extra_links");
      if (brokenAt === null) brokenAt = expectedLength;
    }
  }

  const expectedFinal = expectation.expectedFinalChainHash;
  if (typeof expectedFinal === "string" && expectedFinal.length > 0) {
    const actualFinal =
      rowsChrono.length > 0
        ? rowsChrono[rowsChrono.length - 1].chainHash
        : null;
    if (actualFinal !== expectedFinal) {
      defects.push("final_hash_mismatch");
      if (brokenAt === null) {
        brokenAt = Math.max(rowsChrono.length - 1, 0);
      }
    }
  }

  if (
    typeof expectation.expectedSlotCount === "number" &&
    typeof expectation.actualSlotCount === "number" &&
    expectation.expectedSlotCount !== expectation.actualSlotCount
  ) {
    defects.push("slot_count_mismatch");
  }

  return { ok: defects.length === 0, brokenAt, links, defects };
}
