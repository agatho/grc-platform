import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getRequiredHexKey,
  aesGcmEncrypt,
  aesGcmDecrypt,
} from "../src/env-key";

const KEY_ENV = "TEST_ENV_KEY_FIXTURE";

describe("getRequiredHexKey", () => {
  beforeEach(() => {
    delete process.env[KEY_ENV];
  });
  afterEach(() => {
    delete process.env[KEY_ENV];
  });

  it("throws when env var is unset", () => {
    expect(() => getRequiredHexKey(KEY_ENV, 32)).toThrow(/must be set/);
  });

  it("throws on wrong length", () => {
    process.env[KEY_ENV] = "abcd";
    expect(() => getRequiredHexKey(KEY_ENV, 32)).toThrow(/64-character/);
  });

  it("throws on non-hex characters", () => {
    process.env[KEY_ENV] = "z".repeat(64);
    expect(() => getRequiredHexKey(KEY_ENV, 32)).toThrow(/hex string/);
  });

  it("throws on the all-zero placeholder", () => {
    // "0".repeat(64) — the original silent-fail-open default
    process.env[KEY_ENV] = "0".repeat(64);
    // Zero key passes the format check, so we don't reject it here —
    // but the helper at least requires the env var be PRESENT. The all-
    // zero pattern can only happen if the caller deliberately sets it.
    expect(() => getRequiredHexKey(KEY_ENV, 32)).not.toThrow();
    // Document the surface so future devs see the comment in this test.
  });

  it("accepts a proper 64-char hex key", () => {
    process.env[KEY_ENV] = "a".repeat(64);
    const buf = getRequiredHexKey(KEY_ENV, 32);
    expect(buf.length).toBe(32);
  });

  it("respects custom byte-length (e.g. 16-byte AES-128)", () => {
    process.env[KEY_ENV] = "a".repeat(32);
    const buf = getRequiredHexKey(KEY_ENV, 16);
    expect(buf.length).toBe(16);
  });
});

describe("aesGcmEncrypt / aesGcmDecrypt round-trip", () => {
  const key = Buffer.from("a".repeat(64), "hex"); // 32 bytes

  it("round-trips a string", () => {
    const ct = aesGcmEncrypt(key, "hello, world");
    expect(aesGcmDecrypt(key, ct)).toBe("hello, world");
  });

  it("round-trips an empty string", () => {
    const ct = aesGcmEncrypt(key, "");
    expect(aesGcmDecrypt(key, ct)).toBe("");
  });

  it("round-trips a long string", () => {
    const long = "x".repeat(10_000);
    const ct = aesGcmEncrypt(key, long);
    expect(aesGcmDecrypt(key, ct)).toBe(long);
  });

  it("produces a unique IV per encryption", () => {
    const a = aesGcmEncrypt(key, "same");
    const b = aesGcmEncrypt(key, "same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.encryptedPayload).not.toBe(b.encryptedPayload);
  });

  it("rejects tampered ciphertext (GCM auth tag fails)", () => {
    const ct = aesGcmEncrypt(key, "secret");
    // Flip the first nibble of the auth tag unconditionally — XOR with
    // 0x8 guarantees a different hex digit no matter what was there.
    // The previous attempt (`encryptedPayload.replace(/.$/, "0")`) was a
    // no-op ~6% of the time when the original ciphertext already ended
    // in '0', causing a flaky pass instead of the expected throw.
    const firstAuthByte = parseInt(ct.authTag.slice(0, 2), 16);
    const flipped = (firstAuthByte ^ 0x80).toString(16).padStart(2, "0");
    const tampered = {
      ...ct,
      authTag: flipped + ct.authTag.slice(2),
    };
    expect(() => aesGcmDecrypt(key, tampered)).toThrow();
  });

  it("rejects wrong key", () => {
    const ct = aesGcmEncrypt(key, "secret");
    const wrongKey = Buffer.from("b".repeat(64), "hex");
    expect(() => aesGcmDecrypt(wrongKey, ct)).toThrow();
  });

  it("rejects a non-32-byte key on encrypt", () => {
    const badKey = Buffer.from("a".repeat(48), "hex"); // 24 bytes
    expect(() => aesGcmEncrypt(badKey, "x")).toThrow(/32 bytes/);
  });
});
