// Pure helpers for control-embedding content hashing + invalidation
// (control_embedding table, migration 0377; sync cron
// apps/worker/src/crons/control-embedding-sync.ts).
//
// IMPORTANT: the canonical text and hash MUST stay in sync with the
// SQL-side candidate filter in the sync cron:
//   encode(digest(coalesce(title,'') || E'\n' || coalesce(description,''),
//          'sha256'), 'hex')
// If you change the canonicalisation here, change it there too —
// otherwise every control looks permanently stale (or never stale).

import { createHash } from "crypto";

/** Canonical text an embedding is computed over. */
export function controlEmbeddingText(
  title: string | null | undefined,
  description: string | null | undefined,
): string {
  return `${title ?? ""}\n${description ?? ""}`;
}

/** SHA-256 hex over the canonical text — stored in content_hash. */
export function controlEmbeddingContentHash(
  title: string | null | undefined,
  description: string | null | undefined,
): string {
  return createHash("sha256")
    .update(controlEmbeddingText(title, description), "utf8")
    .digest("hex");
}

/**
 * Invalidation rule: an embedding needs (re-)generation when no row
 * exists yet, when it was produced by a different model, or when the
 * control text changed since it was computed.
 */
export function embeddingNeedsRefresh(input: {
  existingHash: string | null;
  existingModel: string | null;
  currentHash: string;
  model: string;
}): boolean {
  if (input.existingHash === null) return true;
  if (input.existingModel !== input.model) return true;
  return input.existingHash !== input.currentHash;
}
