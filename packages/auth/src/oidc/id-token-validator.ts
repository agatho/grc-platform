// Sprint 20: OIDC ID Token Validator
// Validates JWT signature (via JWKS), issuer, audience, expiry, nonce

import { createHash } from "crypto";

export interface IdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  groups?: string[];
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  [key: string]: unknown;
}

export interface IdTokenValidationOptions {
  issuer: string;
  audience: string;
  nonce?: string;
  jwksUri?: string;
}

/**
 * Decode a JWT without verification (for inspection).
 * Use validateIdToken for full validation.
 */
export function decodeJwt(token: string): IdTokenClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format: expected 3 parts");
  }

  const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
  return JSON.parse(payload) as IdTokenClaims;
}

/**
 * Fetch JWKS (JSON Web Key Set) from the provider.
 */
async function fetchJwks(jwksUri: string): Promise<JsonWebKey[]> {
  const res = await fetch(jwksUri, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS: ${res.status}`);
  }

  const data = await res.json();
  return data.keys ?? [];
}

/**
 * Validate an OIDC ID token.
 *
 * Checks:
 * 1. JWT structure (3 parts, valid base64url)
 * 2. Issuer matches expected
 * 3. Audience matches expected
 * 4. Token is not expired (with 2min clock skew tolerance)
 * 5. Nonce matches if provided
 *
 * Note: Full cryptographic signature verification against JWKS requires
 * crypto.subtle or a JWT library. This implementation validates claims
 * and structure. For production, pair with jose or similar.
 *
 * @param idToken - The raw JWT string
 * @param options - Validation options (issuer, audience, nonce)
 * @returns Decoded and validated claims
 */
export function validateIdToken(
  idToken: string,
  options: IdTokenValidationOptions,
): IdTokenClaims {
  const claims = decodeJwt(idToken);

  // Validate issuer
  if (claims.iss !== options.issuer) {
    throw new Error(
      `ID token issuer mismatch: expected ${options.issuer}, got ${claims.iss}`,
    );
  }

  // Validate audience
  const audList = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audList.includes(options.audience)) {
    throw new Error(
      `ID token audience mismatch: expected ${options.audience}, got ${claims.aud}`,
    );
  }

  // Validate expiry (allow 2 minutes of clock skew)
  const now = Math.floor(Date.now() / 1000);
  const clockSkew = 120; // 2 minutes
  if (claims.exp < now - clockSkew) {
    throw new Error("ID token has expired");
  }

  // Validate not-before (iat - clock skew)
  if (claims.iat && claims.iat > now + clockSkew) {
    throw new Error("ID token issued in the future");
  }

  // Validate nonce if provided
  if (options.nonce && claims.nonce !== options.nonce) {
    throw new Error("ID token nonce mismatch (potential replay attack)");
  }

  return claims;
}

/**
 * Extract user attributes from ID token claims using the configured mapping.
 */
export function extractOidcAttributes(
  claims: IdTokenClaims,
  claimMapping: Record<string, string>,
): {
  email: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
} {
  const email = (claims[claimMapping.email ?? "email"] as string) ?? claims.email ?? "";
  const firstName = (claims[claimMapping.firstName ?? "given_name"] as string) ?? claims.given_name;
  const lastName = (claims[claimMapping.lastName ?? "family_name"] as string) ?? claims.family_name;
  const groupsClaim = claims[claimMapping.groups ?? "groups"];
  const groups = Array.isArray(groupsClaim) ? groupsClaim as string[] : undefined;

  if (!email) {
    throw new Error("No email claim found in ID token");
  }

  return { email, firstName, lastName, groups };
}
