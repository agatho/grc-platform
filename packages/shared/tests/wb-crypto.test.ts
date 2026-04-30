// Tests für Whistleblowing-Crypto-Helpers (sicherheitskritisch)
// Bezug: packages/shared/src/wb-crypto.ts — AES-256-GCM für anonyme Whistleblower-Mailboxen

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test-Key (32 Bytes hex = 64 chars). Nur für Tests verwendet.
const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

beforeAll(() => {
  process.env.WB_ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  delete process.env.WB_ENCRYPTION_KEY;
});

// Lazy import: nach env-setup
async function load() {
  return await import("../src/wb-crypto");
}

describe("encrypt / decrypt", () => {
  it("round-trip: plaintext -> ciphertext -> plaintext", async () => {
    const { encrypt, decrypt } = await load();
    const plaintext = "Beobachtete Verstoss am 2026-04-30";
    const ct = encrypt(plaintext);
    const dec = decrypt(ct);
    expect(dec).toBe(plaintext);
  });

  it("encrypts unicode/emoji content correctly", async () => {
    const { encrypt, decrypt } = await load();
    const plaintext = "Hinweis 🚨 mit ÄÖÜ und 中文";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("encrypts single character (minimum non-empty input)", async () => {
    const { encrypt, decrypt } = await load();
    expect(decrypt(encrypt("x"))).toBe("x");
  });

  it("encrypts very long content (10 KB)", async () => {
    const { encrypt, decrypt } = await load();
    const plaintext = "A".repeat(10_000);
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const { encrypt } = await load();
    const a = encrypt("identisch");
    const b = encrypt("identisch");
    expect(a).not.toBe(b); // unterschiedliche IVs garantieren das
  });

  it("ciphertext is base64 encoded", async () => {
    const { encrypt } = await load();
    const ct = encrypt("test");
    // base64 = nur A-Z a-z 0-9 + / =
    expect(ct).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("decrypt fails for invalid format", async () => {
    const { decrypt } = await load();
    expect(() => decrypt("not-valid-base64-!!!")).toThrow();
  });

  it("decrypt fails for tampered ciphertext (auth tag mismatch)", async () => {
    const { encrypt, decrypt } = await load();
    const ct = encrypt("Original-Hinweis");
    // Decode, flip last byte of the ciphertext part, re-encode
    const decoded = Buffer.from(ct, "base64").toString("utf8");
    const [iv, tag, ciphertext] = decoded.split(":");
    const tamperedHex = ciphertext.slice(0, -1) +
      (ciphertext.slice(-1) === "0" ? "1" : "0");
    const tampered = Buffer.from(`${iv}:${tag}:${tamperedHex}`).toString(
      "base64",
    );
    expect(() => decrypt(tampered)).toThrow();
  });

  it("decrypt fails when missing IV/tag/ciphertext fields", async () => {
    const { decrypt } = await load();
    const broken = Buffer.from("only-one-segment").toString("base64");
    expect(() => decrypt(broken)).toThrow("Invalid encrypted format");
  });
});

describe("getKey behaviour (via encrypt/decrypt)", () => {
  it("throws when WB_ENCRYPTION_KEY is missing", async () => {
    const old = process.env.WB_ENCRYPTION_KEY;
    delete process.env.WB_ENCRYPTION_KEY;
    // Re-import to bypass module cache: vitest evaluates per-test
    const mod = await import("../src/wb-crypto?case-missing-key" as never).catch(
      () => null,
    );
    if (mod) {
      expect(() => mod.encrypt("x")).toThrow(/WB_ENCRYPTION_KEY/);
    } else {
      // Fallback: direct error from existing module after deleting env
      const { encrypt } = await load();
      expect(() => encrypt("x")).toThrow(/WB_ENCRYPTION_KEY/);
    }
    process.env.WB_ENCRYPTION_KEY = old;
  });

  it("throws when WB_ENCRYPTION_KEY has wrong length", async () => {
    const old = process.env.WB_ENCRYPTION_KEY;
    process.env.WB_ENCRYPTION_KEY = "tooShort";
    const { encrypt } = await load();
    expect(() => encrypt("x")).toThrow(/64-character hex/);
    process.env.WB_ENCRYPTION_KEY = old;
  });
});

describe("hashIp", () => {
  it("returns 64-char hex string (SHA-256)", async () => {
    const { hashIp } = await load();
    const hash = hashIp("192.168.1.1");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("produces deterministic output for the same input", async () => {
    const { hashIp } = await load();
    expect(hashIp("203.0.113.42")).toBe(hashIp("203.0.113.42"));
  });

  it("produces different outputs for different IPs", async () => {
    const { hashIp } = await load();
    expect(hashIp("203.0.113.42")).not.toBe(hashIp("203.0.113.43"));
  });

  it("handles IPv6 addresses", async () => {
    const { hashIp } = await load();
    const h = hashIp("2001:db8::1");
    expect(h).toHaveLength(64);
  });

  it("matches SHA-256 reference for a known input", async () => {
    const { hashIp } = await load();
    // SHA-256 of "127.0.0.1"
    expect(hashIp("127.0.0.1")).toBe(
      "12ca17b49af2289436f303e0166030a21e525d266e209267433801a8fd4071a0",
    );
  });
});

describe("generateMailboxToken", () => {
  it("produces a 128-character token", async () => {
    const { generateMailboxToken } = await load();
    const token = generateMailboxToken();
    expect(token).toHaveLength(128);
  });

  it("produces alphanumeric tokens only (A-Z a-z 0-9)", async () => {
    const { generateMailboxToken } = await load();
    for (let i = 0; i < 50; i++) {
      const token = generateMailboxToken();
      expect(token).toMatch(/^[A-Za-z0-9]{128}$/);
    }
  });

  it("produces unique tokens (no collisions in 1000 iterations)", async () => {
    const { generateMailboxToken } = await load();
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(generateMailboxToken());
    }
    expect(seen.size).toBe(1000);
  });

  it("token entropy: ≥ 30 distinct characters across 5 tokens (sanity)", async () => {
    const { generateMailboxToken } = await load();
    const distinct = new Set<string>();
    for (let i = 0; i < 5; i++) {
      for (const c of generateMailboxToken()) distinct.add(c);
    }
    expect(distinct.size).toBeGreaterThanOrEqual(30);
  });
});
