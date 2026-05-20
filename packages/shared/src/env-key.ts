// Shared hex-env-var helpers + AES-256-GCM primitives.
//
// Background: we had two copies of "load a hex key from env, AES-256-GCM
// encrypt some bytes" — `wb-crypto.ts` (whistleblowing, fail-hard, good)
// and the connector credential route (fail-open with all-zero key, fixed
// in PR #196). The cross-cutting takeaway from the overnight 2026-05-18
// triage was: one helper, used everywhere, so the next instance of this
// pattern can't ship a silent fail-open variant.
//
// This module is intentionally framework-free (only `crypto`) so it works
// in apps/web (Next.js), apps/worker (Hono), and packages/* alike.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Read a hex-encoded symmetric key from process.env. Throws on missing,
 * wrong length, or non-hex characters — never silently falls back to a
 * weak/zero key.
 *
 * @param envVarName  e.g. "CONNECTOR_ENCRYPTION_KEY"
 * @param byteLength  expected raw byte length. For AES-256 use 32.
 */
export function getRequiredHexKey(
  envVarName: string,
  byteLength: number,
): Buffer {
  const expectedHexLen = byteLength * 2;
  const keyHex = process.env[envVarName];
  if (
    !keyHex ||
    keyHex.length !== expectedHexLen ||
    !/^[0-9a-fA-F]+$/.test(keyHex)
  ) {
    throw new Error(
      `SECURITY: ${envVarName} must be set to a ${expectedHexLen}-character hex string (${byteLength} bytes). ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(${byteLength}).toString('hex'))". ` +
        `Do NOT use a placeholder or all-zero value.`,
    );
  }
  return Buffer.from(keyHex, "hex");
}

export interface AesGcmCiphertext {
  /** ciphertext as hex */
  encryptedPayload: string;
  /** 12-byte IV (NIST-recommended for GCM) as hex */
  iv: string;
  /** 16-byte auth tag as hex */
  authTag: string;
}

/**
 * AES-256-GCM encrypt. Returns separately-stored iv / authTag / ciphertext
 * (matches the existing connector_credential column layout).
 *
 * @param key   32-byte Buffer from getRequiredHexKey(..., 32)
 * @param plain UTF-8 string
 */
export function aesGcmEncrypt(key: Buffer, plain: string): AesGcmCiphertext {
  if (key.length !== 32) {
    throw new Error("aesGcmEncrypt: key must be 32 bytes for AES-256-GCM");
  }
  const iv = randomBytes(12); // GCM standard
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plain, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encryptedPayload: encrypted, iv: iv.toString("hex"), authTag };
}

/**
 * AES-256-GCM decrypt. Reverse of `aesGcmEncrypt`. Throws on tampering
 * (GCM's auth tag check fails → exception).
 */
export function aesGcmDecrypt(key: Buffer, ct: AesGcmCiphertext): string {
  if (key.length !== 32) {
    throw new Error("aesGcmDecrypt: key must be 32 bytes for AES-256-GCM");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ct.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(ct.authTag, "hex"));
  let decrypted = decipher.update(ct.encryptedPayload, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
