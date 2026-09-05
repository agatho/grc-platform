// ============================================================================
// Das Umschlagformat der Hinweisgeber-Chiffrate, als eigenes Modul.
//
// [ARCTOS-FULL-2026-08-31 · Welle 5c · OP-128]
//
// `scripts/reseal-wb-secrets.mjs` muss byteweise dasselbe Format lesen und
// schreiben wie `packages/shared/src/wb-crypto.ts`. Eine .mjs kann die
// TypeScript-Quelle nicht importieren, also gibt es die Regeln zweimal — und
// genau das ist die Stelle, an der so etwas auseinanderläuft.
//
// Deshalb steht das Format hier statt im Skript: als Modul lässt es sich
// prüfen. `packages/shared/tests/wb-crypto-reseal-format.test.ts` verschlüsselt
// mit der einen Seite und entschlüsselt mit der anderen, in beide Richtungen,
// mit und ohne AAD-Bindung. Bewegt sich eine Seite, fällt der Test.
//
// Format (siehe wb-crypto.ts `encrypt`/`decrypt`):
//   v2:  `v2:<keyId>:<aadBase64Url>:<base64(ivHex:tagHex:ciphertextHex)>`
//   alt: `base64(ivHex:tagHex:ciphertextHex)` — ohne Kennung, ohne AAD
//
// AES-256-GCM, IV 16 Byte wie `wb-crypto.ts` (`randomBytes(16)`), Tag 16
// Byte, Nutzlast hex-kodiert INNERHALB der base64-Hülle.
//
// Zur IV-Länge, gemessen statt behauptet: eine hier abweichende Länge wäre
// NICHT der gefährliche Fall — die IV steht im Umschlag, GCM nimmt jede
// Länge, und `createDecipheriv` bekommt sie aus derselben Zeichenkette
// zurück. Ein künstlich auf 12 gesetztes `WB_IV_BYTES` lief in der
// Gegenprobe grün durch. Was WIRKLICH bricht, ist jede Änderung an der
// Zerlegung: Präfix, Reihenfolge der drei Teile, Kodierung, AAD-Abschnitt.
// Genau darauf zielt `packages/shared/tests/wb-crypto-reseal-format.test.ts`;
// ein `v3:` statt `v2:` lässt dort fünf Prüfungen fallen.
//
// Gibt niemals Klartext oder Schlüsselmaterial aus.
// ============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const WB_ALGO = "aes-256-gcm";
export const WB_IV_BYTES = 16;
export const WB_HEX_KEY_RE = /^[0-9a-fA-F]{64}$/;

/**
 * Zerlegt ein Chiffrat in seine Bestandteile.
 *
 * Gibt `null` zurück, wenn der Wert nicht wie ein Chiffrat aussieht. Der
 * Aufrufer zählt das getrennt, statt es für einen Schlüsselfehler zu halten —
 * „nicht lesbar" und „gar kein Chiffrat" sind zwei verschiedene Befunde.
 */
export function parseWbEnvelope(value) {
  if (typeof value !== "string" || value === "") return null;

  const isV2 = value.startsWith("v2:");
  let payload = value;
  let aad;
  let keyId = null;

  if (isV2) {
    const parts = value.split(":");
    if (parts.length < 4) return null;
    keyId = parts[1];
    const aadB64 = parts[2];
    payload = parts.slice(3).join(":");
    if (aadB64) {
      aad = Buffer.from(aadB64, "base64url").toString("utf8");
    }
  }

  let combined;
  try {
    combined = Buffer.from(payload, "base64").toString("utf8");
  } catch {
    return null;
  }
  const [ivHex, tagHex, ciphertext] = combined.split(":");
  if (!ivHex || !tagHex || !ciphertext) return null;
  if (!/^[0-9a-f]+$/i.test(ivHex) || !/^[0-9a-f]+$/i.test(tagHex)) return null;
  if (!/^[0-9a-f]*$/i.test(ciphertext)) return null;

  return { ivHex, tagHex, ciphertext, aad, keyId, legacy: !isV2 };
}

/** Entschlüsselt einen zerlegten Umschlag. Wirft bei falschem Schlüssel. */
export function decryptWbEnvelope(key, env) {
  const decipher = createDecipheriv(
    WB_ALGO,
    key,
    Buffer.from(env.ivHex, "hex"),
  );
  if (env.aad !== undefined) decipher.setAAD(Buffer.from(env.aad, "utf8"));
  decipher.setAuthTag(Buffer.from(env.tagHex, "hex"));
  let out = decipher.update(env.ciphertext, "hex", "utf8");
  out += decipher.final("utf8");
  return out;
}

/**
 * Öffnet das Chiffrat oder gibt `null` zurück — ohne je zu werfen.
 *
 * Ein Re-Seal probiert zwei Schlüssel; „passt nicht" ist dort der Normalfall
 * und kein Ausnahmezustand.
 */
export function tryDecryptWbEnvelope(key, env) {
  try {
    return decryptWbEnvelope(key, env);
  } catch {
    return null;
  }
}

/**
 * Schreibt ein Chiffrat im v2-Format.
 *
 * `aad === undefined` erzeugt einen leeren AAD-Abschnitt — genau das, was
 * `wb-crypto.ts` für einen Aufruf ohne Bindung schreibt und beim Lesen als
 * „keine Bindung verlangt" interpretiert.
 */
export function encryptWbEnvelope(key, keyId, plaintext, aad) {
  const iv = randomBytes(WB_IV_BYTES);
  const cipher = createCipheriv(WB_ALGO, key, iv);
  if (aad !== undefined) cipher.setAAD(Buffer.from(aad, "utf8"));
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  const payload = Buffer.from(
    `${iv.toString("hex")}:${tag}:${encrypted}`,
  ).toString("base64");
  const aadPart =
    aad === undefined ? "" : Buffer.from(aad, "utf8").toString("base64url");
  return `v2:${keyId}:${aadPart}:${payload}`;
}
