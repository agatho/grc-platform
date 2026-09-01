// Sprint 20 / Audit-Remediation WP3 (S02-24): OIDC ID Token Validator
//
// #WP3-S02-24 — the previous implementation base64-decoded the JWT payload and
// checked `iss`/`aud`/`exp`/`iat`/`nonce`. It never verified the signature; the
// JWKS fetcher that sits in this file was never called by the validator, and
// `alg` was never inspected. Any JWT with the right claims was accepted.
//
// `validateIdToken()` is now asynchronous and performs full cryptographic
// verification against the provider's JWKS via `jose`, with an explicit
// algorithm allowlist (no `none`, no HMAC — an HMAC-signed token would let a
// leaked client_secret forge identities, and key-type confusion is the classic
// JWT failure mode). The claim-only checks remain available as
// `validateIdTokenClaims()` for callers that have ALREADY verified the
// signature (and for unit tests); it is deliberately not used on any
// authentication path.

import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  decodeProtectedHeader,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";

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
  /** Provider JWKS endpoint — REQUIRED unless `jwks` is supplied. */
  jwksUri?: string;
  /** Pre-fetched key set (tests, or providers with pinned keys). */
  jwks?: JSONWebKeySet;
  /** Clock skew tolerance in seconds. Default 120. */
  clockToleranceSeconds?: number;
}

/**
 * Asymmetric signature algorithms we accept.
 *
 * `none` and every `HS*` variant are excluded on purpose:
 *  - `none` is the textbook JWT bypass;
 *  - `HS*` would verify against the client secret, so a leaked secret (or a
 *    provider that echoes the JWKS public key as an HMAC key) becomes a
 *    full identity-forgery primitive.
 */
export const ALLOWED_ID_TOKEN_ALGORITHMS = [
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
] as const;

/**
 * Decode a JWT WITHOUT verification (for inspection/logging only).
 *
 * SECURITY: never derive an identity from this. Use `validateIdToken`.
 */
export function decodeJwt(token: string): IdTokenClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format: expected 3 parts");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
  return JSON.parse(payload) as IdTokenClaims;
}

// Remote JWKS resolvers are cached per URI: `jose` handles caching, cooldown
// and rotation internally, but only per resolver instance.
const remoteJwksCache = new Map<string, JWTVerifyGetKey>();

function getKeyResolver(options: IdTokenValidationOptions): JWTVerifyGetKey {
  if (options.jwks) {
    return createLocalJWKSet(options.jwks) as unknown as JWTVerifyGetKey;
  }
  if (!options.jwksUri) {
    // Fail closed — an ID token whose signature we cannot check is worthless.
    throw new Error(
      "ID token cannot be verified: no jwks_uri from OIDC discovery",
    );
  }
  let resolver = remoteJwksCache.get(options.jwksUri);
  if (!resolver) {
    resolver = createRemoteJWKSet(new URL(options.jwksUri), {
      timeoutDuration: 10_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    }) as unknown as JWTVerifyGetKey;
    remoteJwksCache.set(options.jwksUri, resolver);
  }
  return resolver;
}

/** Test/ops hook: drop cached JWKS resolvers (e.g. after an IdP key rotation). */
export function clearJwksCache(): void {
  remoteJwksCache.clear();
}

/**
 * Claim-level checks. Assumes the signature has ALREADY been verified.
 *
 * SECURITY: this function does NOT verify the signature. It exists so the
 * claim rules stay unit-testable and so `validateIdToken` has exactly one
 * implementation of them. Authentication paths must call `validateIdToken`.
 */
export function validateIdTokenClaims(
  claims: IdTokenClaims,
  options: Pick<
    IdTokenValidationOptions,
    "issuer" | "audience" | "nonce" | "clockToleranceSeconds"
  >,
): IdTokenClaims {
  if (claims.iss !== options.issuer) {
    throw new Error(
      `ID token issuer mismatch: expected ${options.issuer}, got ${claims.iss}`,
    );
  }

  const audList = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audList.includes(options.audience)) {
    throw new Error(
      `ID token audience mismatch: expected ${options.audience}, got ${claims.aud}`,
    );
  }
  // With multiple audiences OIDC requires an `azp` naming our client.
  if (audList.length > 1) {
    const azp = claims.azp as string | undefined;
    if (azp && azp !== options.audience) {
      throw new Error("ID token azp does not match the configured client id");
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const clockSkew = options.clockToleranceSeconds ?? 120;
  if (typeof claims.exp !== "number") {
    throw new Error("ID token has no exp claim");
  }
  if (claims.exp < now - clockSkew) {
    throw new Error("ID token has expired");
  }
  if (claims.iat && claims.iat > now + clockSkew) {
    throw new Error("ID token issued in the future");
  }

  // #WP3-S02-24: a nonce was expected but the token carries none → reject.
  // Previously `claims.nonce !== options.nonce` also caught this, but an
  // explicit message keeps the replay case distinguishable in the audit log.
  if (options.nonce) {
    if (!claims.nonce) {
      throw new Error("ID token is missing the nonce claim");
    }
    if (claims.nonce !== options.nonce) {
      throw new Error("ID token nonce mismatch (potential replay attack)");
    }
  }

  if (!claims.sub) {
    throw new Error("ID token has no sub claim");
  }

  return claims;
}

/**
 * Validate an OIDC ID token: signature (JWKS), algorithm, issuer, audience,
 * expiry, nonce.
 *
 * @throws Error when any check fails. Never returns unverified claims.
 */
export async function validateIdToken(
  idToken: string,
  options: IdTokenValidationOptions,
): Promise<IdTokenClaims> {
  if (!idToken || idToken.split(".").length !== 3) {
    throw new Error("Invalid JWT format: expected 3 parts");
  }

  // Reject `alg: none` / HMAC before touching any key material.
  let header: { alg?: string };
  try {
    header = decodeProtectedHeader(idToken);
  } catch {
    throw new Error("ID token header is not decodable");
  }
  if (
    !header.alg ||
    !(ALLOWED_ID_TOKEN_ALGORITHMS as readonly string[]).includes(header.alg)
  ) {
    throw new Error(
      `ID token signed with a disallowed algorithm: ${header.alg ?? "(none)"}`,
    );
  }

  const keys = getKeyResolver(options);
  const clockSkew = options.clockToleranceSeconds ?? 120;

  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(idToken, keys, {
      algorithms: [...ALLOWED_ID_TOKEN_ALGORITHMS],
      issuer: options.issuer,
      audience: options.audience,
      clockTolerance: clockSkew,
    });
    payload = verified.payload as Record<string, unknown>;
  } catch (err) {
    // Keep the reason for the server-side audit log; the route never returns it.
    throw new Error(
      `ID token signature verification failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // Re-run our own claim rules on the VERIFIED payload. jose already enforced
  // iss/aud/exp, but nonce, azp and sub are ours, and running the whole set
  // keeps a single source of truth for the error messages.
  return validateIdTokenClaims(payload as unknown as IdTokenClaims, options);
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
  const email =
    (claims[claimMapping.email ?? "email"] as string) ?? claims.email ?? "";
  const firstName =
    (claims[claimMapping.firstName ?? "given_name"] as string) ??
    claims.given_name;
  const lastName =
    (claims[claimMapping.lastName ?? "family_name"] as string) ??
    claims.family_name;
  const groupsClaim = claims[claimMapping.groups ?? "groups"];
  const groups = Array.isArray(groupsClaim)
    ? (groupsClaim as string[])
    : undefined;

  if (!email) {
    throw new Error("No email claim found in ID token");
  }

  return { email, firstName, lastName, groups };
}
