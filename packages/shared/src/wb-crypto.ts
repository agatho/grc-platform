// Whistleblowing encryption utilities — AES-256-GCM
// Encryption is handled at the API layer; DB stores ciphertext.

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const keyHex = process.env.WB_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "SECURITY: WB_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a single string: base64(iv:tag:ciphertext)
 */
export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  // Format: iv:tag:ciphertext (all hex), then base64 the whole thing
  const combined = `${iv.toString("hex")}:${tag}:${encrypted}`;
  return Buffer.from(combined).toString("base64");
}

/**
 * Decrypt a string produced by encrypt().
 */
export function decrypt(encryptedBase64: string): string {
  const combined = Buffer.from(encryptedBase64, "base64").toString("utf8");
  const [ivHex, tagHex, ciphertext] = combined.split(":");
  if (!ivHex || !tagHex || !ciphertext) {
    throw new Error("Invalid encrypted format");
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Hash an IP address using SHA-256 (for privacy-preserving duplicate detection).
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Generate a 128-character alphanumeric mailbox token.
 */
export function generateMailboxToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(128);
  let token = "";
  for (let i = 0; i < 128; i++) {
    token += chars[bytes[i]! % chars.length];
  }
  return token;
}
