// Sprint 20: SCIM Bearer Token Authentication
// Validates bearer tokens against scim_token table (SHA-256 hashed)

import { createHash } from "crypto";
import { db, scimToken } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";

export interface ScimAuthContext {
  orgId: string;
  tokenId: string;
}

/**
 * Hash a SCIM bearer token using SHA-256.
 * Tokens are stored hashed in the database; the plaintext is shown only once on creation.
 */
export function hashScimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Validate a SCIM bearer token from the Authorization header.
 *
 * @param authHeader - The full Authorization header value (e.g., "Bearer scim_...")
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

  const [found] = await db
    .select({
      id: scimToken.id,
      orgId: scimToken.orgId,
      isActive: scimToken.isActive,
    })
    .from(scimToken)
    .where(
      and(eq(scimToken.tokenHash, tokenHash), eq(scimToken.isActive, true)),
    );

  if (!found) return null;

  // Update last_used_at
  await db.execute(
    sql`UPDATE scim_token SET last_used_at = now() WHERE id = ${found.id}`,
  );

  return {
    orgId: found.orgId,
    tokenId: found.id,
  };
}

/**
 * Generate a new SCIM token (random, prefixed with "scim_" for identification).
 * Returns the plaintext token. Caller is responsible for hashing before storage.
 */
export function generateScimToken(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  const random = randomBytes(48).toString("base64url");
  return `scim_${random}`;
}
