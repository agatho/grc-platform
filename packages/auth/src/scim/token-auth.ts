// Sprint 20 / Audit-Remediation WP3: SCIM Bearer Token Authentication
// Validates bearer tokens against scim_token (SHA-256 hashed).
//
// #WP3-S02-05: the lookup ran through the plain `db` proxy without an org
// context. `scim_token` has FORCE RLS, so under the production runtime role
// `grc_app` it matched no policy and returned 0 rows — every valid Bearer token
// was answered with 401 and SCIM provisioning AND deprovisioning of leavers
// silently never worked. The lookup now goes through the narrow SECURITY
// DEFINER resolver from migration 0412.
//
// #WP3-S02-15: `scim_token` had no expiry, `revoked_at` was never read, and the
// `last_used_at` UPDATE ran without try/catch (so it could turn a successful
// authentication into a 500). All three are fixed here.

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { resolveScimTokenHash, touchScimToken } from "../anonymous-token";

export interface ScimAuthContext {
  orgId: string;
  tokenId: string;
}

/**
 * Hash a SCIM bearer token using SHA-256.
 * Tokens are stored hashed; the plaintext is shown only once on creation.
 */
export function hashScimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Validate a SCIM bearer token from the Authorization header.
 *
 * @param authHeader - The full Authorization header value (e.g. "Bearer scim_...")
 * @returns Auth context with orgId and tokenId, or null if invalid
 */
export async function validateScimToken(
  authHeader: string | null,
): Promise<ScimAuthContext | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const tokenHash = hashScimToken(token);

  const found = await resolveScimTokenHash(tokenHash);
  if (!found) return null;

  // #WP3-S02-15 — explicit lifecycle checks. `revoked_at` existed in the table
  // but was never read, and there was no expiry at all: a token that leaked
  // into an IdP configuration backup, a ticket or a log stayed valid forever
  // and authorised create/update/deactivate on every user of the org.
  if (!found.isActive) return null;
  if (found.revokedAt && found.revokedAt.getTime() <= Date.now()) return null;
  if (found.expiresAt && found.expiresAt.getTime() <= Date.now()) return null;

  // Best-effort; never fails the authentication (see module header).
  await touchScimToken(found.id);

  return {
    orgId: found.orgId,
    tokenId: found.id,
  };
}

/** Default validity of a newly issued SCIM token (S02-15). */
export const SCIM_TOKEN_DEFAULT_TTL_DAYS = 90;

export function scimTokenDefaultExpiry(
  from: Date = new Date(),
  days: number = SCIM_TOKEN_DEFAULT_TTL_DAYS,
): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Generate a new SCIM token (random, prefixed with "scim_" for identification).
 * Returns the plaintext token. The caller hashes it before storage.
 *
 * #WP3: was `require("crypto")` inside an ESM module — it only worked because
 * the bundler transpiled it.
 */
export function generateScimToken(): string {
  const random = randomBytes(48).toString("base64url");
  return `scim_${random}`;
}

/**
 * Constant-time comparison for callers that compare two token hashes directly
 * (the rotation flow compares the old and the new hash).
 */
export function tokenHashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
