// Sprint 20: OIDC PKCE — Proof Key for Code Exchange (RFC 7636)
// Always uses S256 method (never plain)

import { randomBytes, createHash } from "crypto";
import type { PkceChallenge } from "@grc/shared";

/**
 * Generate a PKCE code_verifier and code_challenge pair.
 * Uses S256 method as mandated by security requirements.
 *
 * @returns Object with verifier (random string) and challenge (SHA-256 hash, base64url)
 */
export function generatePKCE(): PkceChallenge {
  // code_verifier: 43-128 character random string (RFC 7636 Section 4.1)
  const verifier = randomBytes(32).toString("base64url").slice(0, 64);

  // code_challenge: BASE64URL(SHA256(code_verifier)) (RFC 7636 Section 4.2)
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  return { verifier, challenge };
}

/**
 * Verify that a code_verifier matches a code_challenge using S256.
 *
 * @param verifier - The code_verifier to check
 * @param challenge - The stored code_challenge
 * @returns true if the verifier matches the challenge
 */
export function verifyPKCE(verifier: string, challenge: string): boolean {
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return computed === challenge;
}
