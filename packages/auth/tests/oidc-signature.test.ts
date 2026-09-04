// #WP3-S02-24 — OIDC ID-token signature negative tests.
//
// Pre-fix, `validateIdToken` base64-decoded the payload and checked claims
// only; the JWKS fetcher in the same file was never called. A token signed
// with an attacker key — or with `alg: none` — was accepted as long as
// iss/aud/exp/nonce matched. These tests fail against that implementation.

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
  type JSONWebKeySet,
  type JWK,
} from "jose";
import {
  validateIdToken,
  clearJwksCache,
} from "../src/oidc/id-token-validator";

const ISS = "https://idp.example.test";
const AUD = "arctos-client-id";

async function makeIdp() {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const jwk = (await exportJWK(publicKey)) as JWK;
  jwk.kid = "test-key-1";
  jwk.alg = "RS256";
  jwk.use = "sig";
  const jwks: JSONWebKeySet = { keys: [jwk] };
  return { privateKey, jwks };
}

async function sign(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
  alg = "RS256",
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg, kid: "test-key-1" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

describe("S02-24 — OIDC ID token signature verification", () => {
  beforeEach(() => clearJwksCache());

  it("accepts a token signed by the provider key", async () => {
    const idp = await makeIdp();
    const token = await sign(idp.privateKey as CryptoKey, {
      sub: "user-1",
      email: "a@example.test",
      iss: ISS,
      aud: AUD,
      nonce: "n1",
    });
    const claims = await validateIdToken(token, {
      issuer: ISS,
      audience: AUD,
      nonce: "n1",
      jwks: idp.jwks,
    });
    expect(claims.sub).toBe("user-1");
  });

  it("REJECTS a token signed with a foreign key (S02-24 PoC)", async () => {
    const idp = await makeIdp();
    const attacker = await makeIdp();
    const forged = await sign(attacker.privateKey as CryptoKey, {
      sub: "attacker",
      email: "admin@victim-org.test",
      iss: ISS,
      aud: AUD,
    });
    await expect(
      validateIdToken(forged, {
        issuer: ISS,
        audience: AUD,
        jwks: idp.jwks,
      }),
    ).rejects.toThrow(/signature verification failed/i);
  });

  it("REJECTS a token whose payload was edited after signing", async () => {
    const idp = await makeIdp();
    const token = await sign(idp.privateKey as CryptoKey, {
      sub: "user-1",
      email: "low.priv@example.test",
      iss: ISS,
      aud: AUD,
    });
    const [h, p, s] = token.split(".");
    // [OP-065] Ein JWT hat drei Abschnitte. Fehlt einer, ist der Test kaputt
    // und soll das sagen — nicht mit `!` behaupten, alles sei in Ordnung.
    if (h === undefined || p === undefined || s === undefined) {
      throw new Error("erzeugtes Token hat nicht drei Abschnitte");
    }
    const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    payload.email = "admin@victim-org.test";
    const tampered = `${h}.${Buffer.from(JSON.stringify(payload)).toString(
      "base64url",
    )}.${s}`;
    await expect(
      validateIdToken(tampered, {
        issuer: ISS,
        audience: AUD,
        jwks: idp.jwks,
      }),
    ).rejects.toThrow(/signature verification failed/i);
  });

  it("REJECTS alg:none", async () => {
    const idp = await makeIdp();
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "attacker",
        iss: ISS,
        aud: AUD,
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    ).toString("base64url");
    await expect(
      validateIdToken(`${header}.${payload}.`, {
        issuer: ISS,
        audience: AUD,
        jwks: idp.jwks,
      }),
    ).rejects.toThrow(/disallowed algorithm|Invalid JWT format/i);
  });

  it("REJECTS an HMAC-signed token (key-confusion)", async () => {
    const idp = await makeIdp();
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "attacker",
        iss: ISS,
        aud: AUD,
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    ).toString("base64url");
    await expect(
      validateIdToken(`${header}.${payload}.AAAA`, {
        issuer: ISS,
        audience: AUD,
        jwks: idp.jwks,
      }),
    ).rejects.toThrow(/disallowed algorithm/i);
  });

  it("REJECTS verification when neither jwks nor jwks_uri is available", async () => {
    const idp = await makeIdp();
    const token = await sign(idp.privateKey as CryptoKey, {
      sub: "u",
      iss: ISS,
      aud: AUD,
    });
    await expect(
      validateIdToken(token, { issuer: ISS, audience: AUD }),
    ).rejects.toThrow(/no jwks_uri/i);
  });

  it("REJECTS a validly signed token with the wrong issuer/audience/nonce", async () => {
    const idp = await makeIdp();
    const token = await sign(idp.privateKey as CryptoKey, {
      sub: "u",
      iss: "https://evil.test",
      aud: AUD,
    });
    await expect(
      validateIdToken(token, { issuer: ISS, audience: AUD, jwks: idp.jwks }),
    ).rejects.toThrow();

    const token2 = await sign(idp.privateKey as CryptoKey, {
      sub: "u",
      iss: ISS,
      aud: AUD,
      nonce: "wrong",
    });
    await expect(
      validateIdToken(token2, {
        issuer: ISS,
        audience: AUD,
        nonce: "expected",
        jwks: idp.jwks,
      }),
    ).rejects.toThrow(/nonce/i);
  });
});
