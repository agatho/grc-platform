// Sprint 20: OIDC Service Unit Tests
import { describe, it, expect } from "vitest";
import { generatePKCE, verifyPKCE } from "../src/oidc/pkce";
import { validateIdToken, decodeJwt, extractOidcAttributes } from "../src/oidc/id-token-validator";

// ── PKCE ────────────────────────────────────────────────────

describe("OIDCPkce", () => {
  it("should generate PKCE code_verifier and code_challenge", () => {
    const { verifier, challenge } = generatePKCE();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).not.toBe(verifier); // S256 hashed
    expect(typeof challenge).toBe("string");
  });

  it("should generate unique PKCE pairs", () => {
    const pair1 = generatePKCE();
    const pair2 = generatePKCE();
    expect(pair1.verifier).not.toBe(pair2.verifier);
    expect(pair1.challenge).not.toBe(pair2.challenge);
  });

  it("should verify a valid PKCE pair", () => {
    const { verifier, challenge } = generatePKCE();
    expect(verifyPKCE(verifier, challenge)).toBe(true);
  });

  it("should reject an invalid PKCE pair", () => {
    const { challenge } = generatePKCE();
    expect(verifyPKCE("wrong-verifier", challenge)).toBe(false);
  });
});

// ── ID Token Validator ──────────────────────────────────────

describe("OIDCIdTokenValidator", () => {
  // Build a valid JWT for testing (no signature verification in claim validator)
  function buildTestJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${body}.fake-signature`;
  }

  it("should decode a JWT and extract claims", () => {
    const token = buildTestJwt({
      sub: "user123",
      email: "test@example.de",
      iss: "https://accounts.example.com",
      aud: "client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    const claims = decodeJwt(token);
    expect(claims.sub).toBe("user123");
    expect(claims.email).toBe("test@example.de");
  });

  it("should throw on invalid JWT format", () => {
    expect(() => decodeJwt("not-a-jwt")).toThrow("Invalid JWT format");
    expect(() => decodeJwt("only.two")).toThrow("Invalid JWT format");
  });

  it("should validate id_token claims", () => {
    const token = buildTestJwt({
      sub: "user123",
      email: "test@example.de",
      iss: "https://accounts.example.com",
      aud: "client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    const decoded = validateIdToken(token, {
      issuer: "https://accounts.example.com",
      audience: "client-id",
    });
    expect(decoded.sub).toBe("user123");
    expect(decoded.email).toBe("test@example.de");
  });

  it("should reject token with wrong issuer", () => {
    const token = buildTestJwt({
      sub: "user123",
      iss: "https://wrong-issuer.com",
      aud: "client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    expect(() =>
      validateIdToken(token, {
        issuer: "https://accounts.example.com",
        audience: "client-id",
      }),
    ).toThrow("issuer mismatch");
  });

  it("should reject token with wrong audience", () => {
    const token = buildTestJwt({
      sub: "user123",
      iss: "https://accounts.example.com",
      aud: "wrong-client",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    expect(() =>
      validateIdToken(token, {
        issuer: "https://accounts.example.com",
        audience: "client-id",
      }),
    ).toThrow("audience mismatch");
  });

  it("should reject expired token", () => {
    const token = buildTestJwt({
      sub: "user123",
      iss: "https://accounts.example.com",
      aud: "client-id",
      exp: Math.floor(Date.now() / 1000) - 300, // 5 min ago, past 2min skew
      iat: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(() =>
      validateIdToken(token, {
        issuer: "https://accounts.example.com",
        audience: "client-id",
      }),
    ).toThrow("expired");
  });

  it("should reject token with wrong nonce", () => {
    const token = buildTestJwt({
      sub: "user123",
      iss: "https://accounts.example.com",
      aud: "client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      nonce: "wrong-nonce",
    });
    expect(() =>
      validateIdToken(token, {
        issuer: "https://accounts.example.com",
        audience: "client-id",
        nonce: "expected-nonce",
      }),
    ).toThrow("nonce mismatch");
  });

  it("should accept token with matching nonce", () => {
    const token = buildTestJwt({
      sub: "user123",
      iss: "https://accounts.example.com",
      aud: "client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      nonce: "correct-nonce",
    });
    const claims = validateIdToken(token, {
      issuer: "https://accounts.example.com",
      audience: "client-id",
      nonce: "correct-nonce",
    });
    expect(claims.nonce).toBe("correct-nonce");
  });
});

// ── OIDC Attribute Extraction ───────────────────────────────

describe("OIDCAttributeExtraction", () => {
  it("should extract user attributes from ID token claims", () => {
    const claims = {
      sub: "user123",
      email: "test@example.de",
      given_name: "Max",
      family_name: "Mustermann",
      groups: ["GRC-Admins", "Risk-Team"],
      iss: "https://accounts.example.com",
      aud: "client-id",
      exp: 0,
      iat: 0,
    };
    const attrs = extractOidcAttributes(claims, {
      email: "email",
      firstName: "given_name",
      lastName: "family_name",
      groups: "groups",
    });
    expect(attrs.email).toBe("test@example.de");
    expect(attrs.firstName).toBe("Max");
    expect(attrs.lastName).toBe("Mustermann");
    expect(attrs.groups).toEqual(["GRC-Admins", "Risk-Team"]);
  });

  it("should use custom claim mapping", () => {
    const claims = {
      sub: "user123",
      custom_email: "custom@example.de",
      first: "Hans",
      last: "Schmidt",
      iss: "test",
      aud: "test",
      exp: 0,
      iat: 0,
    };
    const attrs = extractOidcAttributes(claims, {
      email: "custom_email",
      firstName: "first",
      lastName: "last",
      groups: "groups",
    });
    expect(attrs.email).toBe("custom@example.de");
    expect(attrs.firstName).toBe("Hans");
  });

  it("should throw when no email claim found", () => {
    const claims = {
      sub: "user123",
      iss: "test",
      aud: "test",
      exp: 0,
      iat: 0,
    };
    expect(() =>
      extractOidcAttributes(claims, {
        email: "nonexistent",
        firstName: "first",
        lastName: "last",
        groups: "groups",
      }),
    ).toThrow("No email claim found");
  });
});
