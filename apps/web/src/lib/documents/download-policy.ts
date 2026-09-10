// Shared decision + integrity logic for the two DMS download routes
// (documents/[id]/download and documents/[id]/files/[fileId]/download).
//
// Both routes carried a byte-for-byte copy of this logic, and S06-06 /
// S06-07 / S06-09 were consequently present twice. One module now owns
// the rules so a future change cannot drift between them.

import { createHash } from "node:crypto";

/**
 * #S06-07 — statuses whose PDFs must never leave the DMS unmarked.
 *
 * The old rule was `status === "published"` only. `archived` and
 * `expired` are precisely the revisions whose unmarked circulation is
 * most damaging (a printout of a superseded policy carries no hint that
 * it is void), and `approved` is a released state as well. Only `draft`
 * and `in_review` — states that have not been released to anyone — are
 * served unmarked by default; `?watermarked=1` still forces the stamp
 * for those.
 */
export const WATERMARK_REQUIRED_STATUSES: ReadonlySet<string> = new Set([
  "approved",
  "published",
  "archived",
  "expired",
]);

export function watermarkRequiredForStatus(status: string | null): boolean {
  return status !== null && WATERMARK_REQUIRED_STATUSES.has(status);
}

/**
 * #S06-01 / #S06-14 — statuses in which the stored bytes and the
 * content of a document are frozen. An upload or content edit in these
 * states would change what was approved/published without passing the
 * four-eyes transition in `[id]/status/route.ts`.
 */
export const CONTENT_MUTABLE_STATUSES: ReadonlySet<string> = new Set([
  "draft",
  "in_review",
]);

export function contentMutableForStatus(status: string | null): boolean {
  return status !== null && CONTENT_MUTABLE_STATUSES.has(status);
}

export interface StoredIntegrity {
  ok: boolean;
  expected: string | null;
  actual: string;
}

/**
 * #S06-09 — verify the bytes we just read from the object store against
 * the hash recorded in the database.
 *
 * The download handler advertised `X-File-SHA256` from the DB column
 * while never checking that the object store had actually returned
 * those bytes. Anyone able to write into the bucket (the MinIO sidecar
 * with unauthenticated-write CVEs, leaked S3 credentials, host access
 * under STORAGE_BACKEND=local) could swap a document's content without
 * touching the database, and every read path — download header,
 * signature verification, certificate — kept asserting integrity.
 *
 * Returns `ok: true` when no hash was ever recorded (pre-D3 uploads):
 * there is nothing to compare against, and refusing those would break
 * historical documents. The caller reports that state separately.
 */
export function verifyStoredBytes(
  buffer: Buffer,
  expected: string | null,
): StoredIntegrity {
  const actual = createHash("sha256").update(buffer).digest("hex");
  return { ok: expected === null || actual === expected, expected, actual };
}
