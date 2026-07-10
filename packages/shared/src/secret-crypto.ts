// Versioned encrypt-at-rest envelope for application-managed secrets
// (connector refresh tokens, SSO OIDC client secrets, future API secrets).
//
// Closes Wave-24 alpha-blocker F#1 (`connector_credential.refresh_token`
// was a plaintext column; see docs/audits/wave-24-alpha-blockers-status-
// 2026-05-21.md). Complements — does not replace — the two existing
// crypto modules in this package:
//
//   - `env-key.ts`   → three-column AES-256-GCM layout used by
//                      `connector_credential.encrypted_payload/iv/auth_tag`
//                      with CONNECTOR_ENCRYPTION_KEY. Keep using it there.
//   - `wb-crypto.ts` → whistleblowing envelope with WB_ENCRYPTION_KEY.
//
// This module is for SINGLE-COLUMN secrets: the whole envelope lives in
// one text column, is self-describing (version prefix), and supports key
// rotation without a schema change:
//
//   v1:<iv_base64>:<auth_tag_base64>:<ciphertext_base64>
//
// Keys:
//   SECRET_ENCRYPTION_KEY           — active key. 32 bytes, base64
//                                     (`openssl rand -base64 32`) or
//                                     64-char hex. Validated on first
//                                     use, NOT at import time.
//   SECRET_ENCRYPTION_KEY_PREVIOUS  — optional. During rotation, set the
//                                     old key here; decryptSecret() falls
//                                     back to it, and every write re-seals
//                                     under the active key ("encrypt on
//                                     write" re-wrap).
//
// Never log key material or plaintext secrets from this module.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENVELOPE_VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // NIST-recommended IV size for GCM
const TAG_BYTES = 16;
const KEY_BYTES = 32;

const ACTIVE_KEY_ENV = "SECRET_ENCRYPTION_KEY";
const PREVIOUS_KEY_ENV = "SECRET_ENCRYPTION_KEY_PREVIOUS";

// Strict base64 (standard alphabet, correct padding). Buffer.from(_,
// "base64") is forgiving about garbage, so validate with a regex first.
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const HEX_KEY_RE = /^[0-9a-fA-F]{64}$/;

/**
 * Parse a 32-byte key from env-var content. Accepts base64 (44 chars,
 * `openssl rand -base64 32`) or hex (64 chars). Throws a descriptive
 * error that never echoes the provided value.
 */
function parseKeyMaterial(raw: string, envVarName: string): Buffer {
  if (HEX_KEY_RE.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  if (BASE64_RE.test(raw)) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === KEY_BYTES) return decoded;
  }
  throw new Error(
    `SECURITY: ${envVarName} must be a 32-byte key encoded as base64 ` +
      `(generate with: openssl rand -base64 32) or as a 64-character hex ` +
      `string (generate with: openssl rand -hex 32). The current value ` +
      `has the wrong length or encoding.`,
  );
}

/** Active key — required. Validated lazily on first use, not at import. */
function getActiveKey(): Buffer {
  const raw = process.env[ACTIVE_KEY_ENV];
  if (!raw) {
    throw new Error(
      `SECURITY: ${ACTIVE_KEY_ENV} is not set but an application secret ` +
        `needs to be encrypted/decrypted at rest. Generate a key with ` +
        `"openssl rand -base64 32" and set it in the environment ` +
        `(see .env.example). Never use a placeholder value.`,
    );
  }
  return parseKeyMaterial(raw, ACTIVE_KEY_ENV);
}

/** Optional previous key for rotation. null when unset/empty. */
function getPreviousKey(): Buffer | null {
  const raw = process.env[PREVIOUS_KEY_ENV];
  if (!raw) return null;
  return parseKeyMaterial(raw, PREVIOUS_KEY_ENV);
}

/**
 * True when `value` is a well-formed `v1:` envelope produced by
 * encryptSecret(): four colon-separated parts, valid base64, 12-byte IV,
 * 16-byte auth tag. Used to tell encrypted values apart from legacy
 * plaintext rows ("encrypt on write" migration).
 */
export function isEncryptedSecret(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) return false;
  const [, ivB64, tagB64, ctB64] = parts as [string, string, string, string];
  if (!BASE64_RE.test(ivB64) || !BASE64_RE.test(tagB64) || !BASE64_RE.test(ctB64)) {
    return false;
  }
  return (
    Buffer.from(ivB64, "base64").length === IV_BYTES &&
    Buffer.from(tagB64, "base64").length === TAG_BYTES
  );
}

/**
 * AES-256-GCM encrypt `plaintext` under SECRET_ENCRYPTION_KEY.
 * Returns the `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>` envelope.
 * Throws (with a setup hint) when the key is missing or malformed.
 */
export function encryptSecret(plaintext: string): string {
  const key = getActiveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    ENVELOPE_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

function decryptWithKey(key: Buffer, ivB64: string, tagB64: string, ctB64: string): string {
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

/**
 * Decrypt a `v1:` envelope. Tries SECRET_ENCRYPTION_KEY first, then
 * SECRET_ENCRYPTION_KEY_PREVIOUS (if set) as a rotation fallback.
 *
 * Throws when:
 * - `value` is not a v1 envelope (call isEncryptedSecret() first when a
 *   legacy plaintext value is possible — or use openSecret()),
 * - the key env-var is missing/malformed,
 * - no configured key authenticates the ciphertext (tampering or lost key).
 */
export function decryptSecret(value: string): string {
  if (!isEncryptedSecret(value)) {
    throw new Error(
      `secret-crypto: value is not a ${ENVELOPE_VERSION} envelope ` +
        `("${ENVELOPE_VERSION}:<iv>:<tag>:<ciphertext>", base64 parts). ` +
        `For legacy plaintext columns, check isEncryptedSecret() first ` +
        `or use openSecret().`,
    );
  }
  const [, ivB64, tagB64, ctB64] = value.split(":") as [
    string,
    string,
    string,
    string,
  ];

  try {
    return decryptWithKey(getActiveKey(), ivB64, tagB64, ctB64);
  } catch (err) {
    // Missing/malformed key config → surface the setup error as-is.
    if (err instanceof Error && err.message.startsWith("SECURITY:")) {
      throw err;
    }
    const previous = getPreviousKey();
    if (previous) {
      try {
        return decryptWithKey(previous, ivB64, tagB64, ctB64);
      } catch {
        // fall through to the combined error below
      }
    }
    throw new Error(
      `secret-crypto: decryption failed — the ciphertext does not ` +
        `authenticate under ${ACTIVE_KEY_ENV}` +
        (previous ? ` or ${PREVIOUS_KEY_ENV}` : "") +
        `. Either the value was tampered with or it was encrypted under a ` +
        `key that is no longer configured (set the old key as ` +
        `${PREVIOUS_KEY_ENV} during rotation).`,
    );
  }
}

/**
 * Write-side helper ("encrypt on write"): returns the value ready for
 * INSERT/UPDATE into a secret column.
 *
 * - null/undefined → null (nothing to store)
 * - ""             → "" (explicit clear, kept as-is)
 * - v1 envelope    → unchanged (idempotent; safe for re-saves and for
 *                    the backfill script)
 * - anything else  → encryptSecret(value)
 */
export function sealSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value === "" || isEncryptedSecret(value)) return value;
  return encryptSecret(value);
}

export interface OpenedSecret {
  /** decrypted (or legacy plaintext) secret */
  plaintext: string;
  /**
   * false → the stored value was a legacy plaintext row. Callers that
   * own a write path should re-store via sealSecret() to migrate it.
   */
  wasEncrypted: boolean;
}

/**
 * Read-side helper: decrypts v1 envelopes, passes legacy plaintext
 * through (flagged via `wasEncrypted: false` so write paths can re-seal).
 * null/undefined/"" → null.
 */
export function openSecret(
  stored: string | null | undefined,
): OpenedSecret | null {
  if (stored == null || stored === "") return null;
  if (isEncryptedSecret(stored)) {
    return { plaintext: decryptSecret(stored), wasEncrypted: true };
  }
  return { plaintext: stored, wasEncrypted: false };
}
