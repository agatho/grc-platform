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

  it("ciphertext carries the v2 envelope (key id + AAD binding)", async () => {
    const { encrypt } = await load();
    // #WP8-S07-19: Chiffrate tragen jetzt `v2:<keyId>:<aad>:<base64>`.
    // Die Schluesselkennung ist die Voraussetzung fuer Rotation, die
    // AAD-Bindung verhindert, dass ein Chiffrat zwischen Zeilen
    // verschoben werden kann.
    expect(encrypt("test")).toMatch(/^v2:default::[A-Za-z0-9+/]+=*$/);
    expect(encrypt("test", "wb_case_message:abc")).toMatch(
      /^v2:default:[A-Za-z0-9_-]+:[A-Za-z0-9+/]+=*$/,
    );
  });

  it("still decrypts ciphertext written in the pre-WP8 format", async () => {
    const { decrypt } = await load();
    const { createCipheriv, randomBytes } = await import("crypto");
    const iv = randomBytes(16);
    const c = createCipheriv(
      "aes-256-gcm",
      Buffer.from(TEST_KEY, "hex"),
      iv,
    );
    let enc = c.update("Bestandsmeldung", "utf8", "hex");
    enc += c.final("hex");
    const legacy = Buffer.from(
      `${iv.toString("hex")}:${c.getAuthTag().toString("hex")}:${enc}`,
    ).toString("base64");
    expect(decrypt(legacy)).toBe("Bestandsmeldung");
  });

  it("refuses a ciphertext that belongs to a different record (AAD)", async () => {
    const { encrypt, decrypt } = await load();
    // S07-19.3: ohne AAD-Bindung konnte das Chiffrat von Meldung A nach
    // Meldung B kopiert werden und die Entschluesselung gelang unbemerkt.
    const ct = encrypt("Hinweis A", "wb_case_message:aaaa");
    expect(decrypt(ct, "wb_case_message:aaaa")).toBe("Hinweis A");
    expect(() => decrypt(ct, "wb_case_message:bbbb")).toThrow(/AAD mismatch/);
  });

  it("decrypts with the previous key after a rotation", async () => {
    const { encrypt, decrypt } = await load();
    const OLD = process.env.WB_ENCRYPTION_KEY!;
    const NEW = "f".repeat(64);
    const ct = encrypt("vor der Rotation");
    process.env.WB_ENCRYPTION_KEY = NEW;
    process.env.WB_ENCRYPTION_KEY_PREVIOUS = OLD;
    try {
      // S07-19.2: vorher gab es keinen Rotationspfad — ein
      // Schluesselwechsel machte alle Bestandsmeldungen unlesbar.
      expect(decrypt(ct)).toBe("vor der Rotation");
    } finally {
      process.env.WB_ENCRYPTION_KEY = OLD;
      delete process.env.WB_ENCRYPTION_KEY_PREVIOUS;
    }
  });

  it("decrypt fails for invalid format", async () => {
    const { decrypt } = await load();
    expect(() => decrypt("not-valid-base64-!!!")).toThrow();
  });

  it("decrypt fails for tampered ciphertext (auth tag mismatch)", async () => {
    const { encrypt, decrypt } = await load();
    const ct = encrypt("Original-Hinweis");
    // Decode, flip last byte of the ciphertext part, re-encode
    const payload = ct.startsWith("v2:") ? ct.split(":").slice(3).join(":") : ct;
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    const [iv, tag, ciphertext] = decoded.split(":");
    const tamperedHex =
      ciphertext.slice(0, -1) + (ciphertext.slice(-1) === "0" ? "1" : "0");
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
    const mod = await import(
      "../src/wb-crypto?case-missing-key" as never
    ).catch(() => null);
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

  // #WP8-S07-02 — dieser Test stand vorher hier:
  //
  //   it("matches SHA-256 reference for a known input", ...)
  //     expect(hashIp("127.0.0.1")).toBe("12ca17b4…")   // sha256("127.0.0.1")
  //
  // Er hat den Defekt nicht gefunden, sondern festgeschrieben: die
  // Uebereinstimmung mit dem ungesalzenen SHA-256 einer bekannten Eingabe
  // IST die Rueckrechenbarkeit. Er ist durch die drei folgenden ersetzt.
  it("is not the unsalted SHA-256 of the address (dictionary attack)", async () => {
    const { hashIp } = await load();
    const { createHash } = await import("crypto");
    for (const ip of ["127.0.0.1", "10.20.30.44", "203.0.113.9"]) {
      expect(hashIp(ip)).not.toBe(
        createHash("sha256").update(ip).digest("hex"),
      );
    }
  });

  it("resists a dictionary attack over a whole /24 network", async () => {
    const { hashIp } = await load();
    const { createHash } = await import("crypto");
    // Genau der Angriff aus dem Auditbericht: 256 Hashes reichten, um die
    // Adresse der hinweisgebenden Person zu benennen.
    const target = hashIp("10.20.30.44");
    const guesses = new Set<string>();
    for (let i = 0; i < 256; i++) {
      guesses.add(createHash("sha256").update(`10.20.30.${i}`).digest("hex"));
    }
    expect(guesses.has(target)).toBe(false);
  });

  it("does not link the same address across tenants", async () => {
    const { hashIp } = await load();
    const a = hashIp("203.0.113.42", "11111111-1111-1111-1111-111111111111");
    const b = hashIp("203.0.113.42", "22222222-2222-2222-2222-222222222222");
    expect(a).not.toBe(b);
    // innerhalb eines Mandanten bleibt die Duplikaterkennung erhalten
    expect(a).toBe(hashIp("203.0.113.42", "11111111-1111-1111-1111-111111111111"));
  });

  it("verifies a candidate address only with the key", async () => {
    const { hashIp, ipMatchesHash } = await load();
    const h = hashIp("198.51.100.7", "org-a");
    expect(ipMatchesHash("198.51.100.7", h, "org-a")).toBe(true);
    expect(ipMatchesHash("198.51.100.8", h, "org-a")).toBe(false);
    expect(ipMatchesHash("198.51.100.7", h, "org-b")).toBe(false);
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
