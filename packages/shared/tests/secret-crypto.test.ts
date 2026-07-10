import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";
import {
  encryptSecret,
  decryptSecret,
  isEncryptedSecret,
  sealSecret,
  openSecret,
} from "../src/secret-crypto";

const KEY_ENV = "SECRET_ENCRYPTION_KEY";
const PREV_ENV = "SECRET_ENCRYPTION_KEY_PREVIOUS";

const keyA = randomBytes(32);
const keyB = randomBytes(32);

function useKey(key: Buffer, encoding: "base64" | "hex" = "base64") {
  process.env[KEY_ENV] = key.toString(encoding);
}

beforeEach(() => {
  delete process.env[KEY_ENV];
  delete process.env[PREV_ENV];
});
afterEach(() => {
  delete process.env[KEY_ENV];
  delete process.env[PREV_ENV];
});

describe("key loading", () => {
  it("throws a setup-hint error when SECRET_ENCRYPTION_KEY is unset", () => {
    expect(() => encryptSecret("x")).toThrow(/SECRET_ENCRYPTION_KEY/);
    expect(() => encryptSecret("x")).toThrow(/openssl rand -base64 32/);
  });

  it("does not throw at import time (lazy validation)", () => {
    // If the module validated at import, this test file could not even
    // have loaded with the env var deleted. Reaching this line proves it.
    expect(typeof encryptSecret).toBe("function");
  });

  it("accepts a base64-encoded 32-byte key", () => {
    useKey(keyA, "base64");
    expect(decryptSecret(encryptSecret("hello"))).toBe("hello");
  });

  it("accepts a 64-char hex key", () => {
    useKey(keyA, "hex");
    expect(decryptSecret(encryptSecret("hello"))).toBe("hello");
  });

  it("rejects a key with wrong length", () => {
    process.env[KEY_ENV] = randomBytes(16).toString("base64"); // 16 bytes
    expect(() => encryptSecret("x")).toThrow(/32-byte/);
  });

  it("rejects garbage key material without echoing it", () => {
    process.env[KEY_ENV] = "not-a-valid-key!!";
    let message = "";
    try {
      encryptSecret("x");
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/SECRET_ENCRYPTION_KEY/);
    expect(message).not.toContain("not-a-valid-key!!");
  });
});

describe("encryptSecret / decryptSecret round-trip", () => {
  beforeEach(() => useKey(keyA));

  it("round-trips a simple string", () => {
    expect(decryptSecret(encryptSecret("refresh-token-123"))).toBe(
      "refresh-token-123",
    );
  });

  it("round-trips unicode and colons", () => {
    const plain = "gehe:im — Pässwörter:🔑:v1:fake";
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });

  it("round-trips an empty string", () => {
    expect(decryptSecret(encryptSecret(""))).toBe("");
  });

  it("round-trips a long secret (10k chars)", () => {
    const plain = "x".repeat(10_000);
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });

  it("produces the documented v1 envelope format", () => {
    const value = encryptSecret("s");
    const parts = value.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    expect(Buffer.from(parts[1]!, "base64")).toHaveLength(12); // IV
    expect(Buffer.from(parts[2]!, "base64")).toHaveLength(16); // GCM tag
  });

  it("uses a fresh IV per call (same plaintext, different ciphertext)", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext (GCM auth tag mismatch)", () => {
    const value = encryptSecret("secret");
    const parts = value.split(":");
    const ct = Buffer.from(parts[3]!, "base64");
    if (ct.length > 0) {
      ct[0] = ct[0]! ^ 0xff; // flip a ciphertext byte
    }
    const tampered = [parts[0], parts[1], parts[2], ct.toString("base64")].join(
      ":",
    );
    expect(() => decryptSecret(tampered)).toThrow(/decryption failed/);
  });

  it("throws on wrong key", () => {
    const value = encryptSecret("secret");
    useKey(keyB);
    expect(() => decryptSecret(value)).toThrow(/decryption failed/);
  });

  it("throws a clear error for non-envelope input", () => {
    expect(() => decryptSecret("plaintext-legacy-value")).toThrow(
      /not a v1 envelope/,
    );
  });

  it("throws the key-setup error (not a generic one) when key is missing on decrypt", () => {
    const value = encryptSecret("secret");
    delete process.env[KEY_ENV];
    expect(() => decryptSecret(value)).toThrow(/SECRET_ENCRYPTION_KEY/);
  });
});

describe("key rotation via SECRET_ENCRYPTION_KEY_PREVIOUS", () => {
  it("decrypts old-key ciphertext when the old key is set as PREVIOUS", () => {
    useKey(keyA);
    const value = encryptSecret("rotate-me");
    // rotate: keyB becomes active, keyA moves to PREVIOUS
    useKey(keyB);
    process.env[PREV_ENV] = keyA.toString("base64");
    expect(decryptSecret(value)).toBe("rotate-me");
  });

  it("prefers the active key when both could apply", () => {
    useKey(keyB);
    process.env[PREV_ENV] = keyA.toString("base64");
    const value = encryptSecret("active"); // sealed under active keyB
    expect(decryptSecret(value)).toBe("active");
  });

  it("fails without PREVIOUS after rotation and mentions the fallback", () => {
    useKey(keyA);
    const value = encryptSecret("rotate-me");
    useKey(keyB);
    expect(() => decryptSecret(value)).toThrow(
      /SECRET_ENCRYPTION_KEY_PREVIOUS/,
    );
  });

  it("accepts PREVIOUS in hex while active is base64", () => {
    useKey(keyA);
    const value = encryptSecret("mixed-encodings");
    useKey(keyB, "base64");
    process.env[PREV_ENV] = keyA.toString("hex");
    expect(decryptSecret(value)).toBe("mixed-encodings");
  });
});

describe("isEncryptedSecret", () => {
  beforeEach(() => useKey(keyA));

  it("recognizes envelopes produced by encryptSecret", () => {
    expect(isEncryptedSecret(encryptSecret("x"))).toBe(true);
  });

  it("rejects plaintext, wrong prefixes and malformed envelopes", () => {
    expect(isEncryptedSecret("plain-old-refresh-token")).toBe(false);
    expect(isEncryptedSecret("v2:AAAA:BBBB:CCCC")).toBe(false);
    expect(isEncryptedSecret("v1:only-three-parts:x")).toBe(false);
    expect(isEncryptedSecret("v1:!!!:???:###")).toBe(false); // not base64
    // valid base64 but wrong IV/tag sizes
    const b64 = Buffer.from("shorty").toString("base64");
    expect(isEncryptedSecret(`v1:${b64}:${b64}:${b64}`)).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isEncryptedSecret(null)).toBe(false);
    expect(isEncryptedSecret(undefined)).toBe(false);
    expect(isEncryptedSecret(42)).toBe(false);
    expect(isEncryptedSecret({})).toBe(false);
  });
});

describe("access layer: sealSecret (write) / openSecret (read)", () => {
  beforeEach(() => useKey(keyA));

  it("sealSecret encrypts plaintext before it would hit the DB", () => {
    const sealed = sealSecret("oauth-refresh-token");
    expect(sealed).not.toBeNull();
    expect(isEncryptedSecret(sealed)).toBe(true);
    expect(sealed).not.toContain("oauth-refresh-token");
  });

  it("sealSecret is idempotent for already-sealed values (re-save, backfill)", () => {
    const sealed = sealSecret("once")!;
    expect(sealSecret(sealed)).toBe(sealed);
  });

  it("sealSecret passes through null/undefined/empty", () => {
    expect(sealSecret(null)).toBeNull();
    expect(sealSecret(undefined)).toBeNull();
    expect(sealSecret("")).toBe("");
  });

  it("openSecret decrypts sealed values and flags them as encrypted", () => {
    const sealed = sealSecret("client-secret-456")!;
    expect(openSecret(sealed)).toEqual({
      plaintext: "client-secret-456",
      wasEncrypted: true,
    });
  });

  it("openSecret passes legacy plaintext through and flags it for re-seal", () => {
    expect(openSecret("legacy-plaintext-secret")).toEqual({
      plaintext: "legacy-plaintext-secret",
      wasEncrypted: false,
    });
  });

  it("openSecret returns null for null/undefined/empty", () => {
    expect(openSecret(null)).toBeNull();
    expect(openSecret(undefined)).toBeNull();
    expect(openSecret("")).toBeNull();
  });

  it("legacy plaintext read works even WITHOUT any key configured", () => {
    delete process.env[KEY_ENV];
    expect(openSecret("legacy-value")?.plaintext).toBe("legacy-value");
  });

  it("seal → open round-trip survives key rotation", () => {
    const sealed = sealSecret("survives-rotation")!;
    useKey(keyB);
    process.env[PREV_ENV] = keyA.toString("base64");
    expect(openSecret(sealed)?.plaintext).toBe("survives-rotation");
    // re-seal under the new active key (encrypt-on-write migration)
    const resealed = sealSecret(openSecret(sealed)!.plaintext)!;
    delete process.env[PREV_ENV];
    expect(openSecret(resealed)?.plaintext).toBe("survives-rotation");
  });
});
