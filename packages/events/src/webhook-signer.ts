// Sprint 22: HMAC-SHA256 webhook signing
// Signs payload with secret, produces X-Arctos-Signature header

import { createHmac, randomBytes, createHash } from "crypto";

/**
 * Generate a cryptographically random webhook secret.
 * Returns: { secret: plaintext, hash: SHA-256 hash for storage, last4: last 4 chars }
 */
export function generateWebhookSecret(): {
  secret: string;
  hash: string;
  last4: string;
} {
  const secret = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(secret).digest("hex");
  const last4 = secret.slice(-4);
  return { secret, hash, last4 };
}

/**
 * Hash a secret for storage comparison.
 */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Sign a payload with HMAC-SHA256.
 * Returns the signature string for X-Arctos-Signature header.
 */
export function signPayload(payload: string, secretHash: string): string {
  const hmac = createHmac("sha256", secretHash);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Verify an HMAC signature.
 */
export function verifySignature(
  payload: string,
  signature: string,
  secretHash: string,
): boolean {
  const expected = signPayload(payload, secretHash);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}
