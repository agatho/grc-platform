// Whistleblowing encryption utilities — AES-256-GCM
// Encryption is handled at the API layer; DB stores ciphertext.
//
// ── ARCTOS-FULL-2026-08-31 · WP8 · S07-02 (High), S07-19 (Low) ────────
//
// S07-02: `hashIp()` war ein UNGESALZENER SHA-256 über die IP-Adresse. Der
// Auditor hat den Wert aus einem /24-Netz mit 256 Hash-Operationen
// zurückgerechnet; der gesamte IPv4-Raum ist auf handelsüblicher Hardware
// in Minuten durchgerechnet. Der Wert steht in `wb_report.ip_hash`, dessen
// Schema-Kommentar "NOT plaintext" behauptet. Faktisch war die IP-Adresse
// der hinweisgebenden Person im Klartext gespeichert — über DHCP-, VPN-
// und Proxy-Protokolle einer konkreten Person zuzuordnen (HinSchG §8).
//
// S07-19, fünf Einzelbefunde zum Schlüsselmanagement:
//   1. ein Schlüssel für alle Mandanten und Fälle
//   2. kein Rotationspfad (anders als bei SECRET_ENCRYPTION_KEY, wo es
//      SECRET_ENCRYPTION_KEY_PREVIOUS + Re-Seal-Skript gibt)
//   3. GCM ohne AAD — ein Chiffrat ist nicht an seine Zeile gebunden; wer
//      UPDATE-Rechte hat, kann es von Meldung A nach Meldung B kopieren
//      und die Entschlüsselung gelingt unbemerkt
//   4. Doku-Drift: "Ende-zu-Ende-Verschluesselung der Case-Attachments" —
//      weder Ende-zu-Ende (der Server hält den Schlüssel und entschlüsselt
//      selbst) noch Anhänge (die wurden gar nicht gespeichert, S07-20)
//   5. kein Startzeit-Check: eine Installation ohne Schlüssel startet, das
//      Meldeportal nimmt Meldungen an und quittiert sie mit 500 — der nach
//      HinSchG §12 vorgeschriebene Meldekanal ist unbemerkt tot
//
// Was diese Datei jetzt leistet:
//   * `hashIp()` ist ein HMAC unter WB_PSEUDONYM_KEY (ersatzweise aus
//     WB_ENCRYPTION_KEY abgeleitet, damit eine Bestandsinstallation nicht
//     ohne Pseudonymisierung dasteht) mit Mandanten-Diskriminator. Die
//     Rückrechnung ist damit nicht mehr ein Wörterbuch über 2^32 Adressen,
//     sondern das Raten eines 256-Bit-Schlüssels.
//   * `encrypt()/decrypt()` binden das Chiffrat per AAD an seine Zeile und
//     tragen eine Schlüsselkennung; `WB_ENCRYPTION_KEY_PREVIOUS` erlaubt
//     Rotation ohne Datenverlust.
//   * `assertWbCryptoConfigured()` ist der Startzeit-Check.
//
// Kompatibilität: Chiffrate im alten Format (`base64(iv:tag:ct)`) werden
// weiterhin entschlüsselt. Neue Chiffrate tragen das Präfix `v2:`.
//
// Was hier NICHT gelöst ist und in "Bedarf an andere Pakete" steht:
// ein Schlüssel PRO MANDANT (S07-19.1). Das ist eine Betriebs- und
// KMS-Entscheidung, keine Codeänderung — die Schlüsselkennung im Chiffrat
// ist die Vorarbeit dafür.

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

const ALGO = "aes-256-gcm";

function parseKey(raw: string | undefined, varName: string): Buffer | null {
  if (!raw) return null;
  const hex = raw.trim();
  if (hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `SECURITY: ${varName} must be a 64-character hex string (32 bytes). ` +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(hex, "hex");
}

function getKey(): Buffer {
  const key = parseKey(process.env.WB_ENCRYPTION_KEY, "WB_ENCRYPTION_KEY");
  if (!key) {
    throw new Error(
      "SECURITY: WB_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return key;
}

function getPreviousKey(): Buffer | null {
  return parseKey(
    process.env.WB_ENCRYPTION_KEY_PREVIOUS,
    "WB_ENCRYPTION_KEY_PREVIOUS",
  );
}

/**
 * Schlüssel für die Pseudonymisierung (IP-Adressen, Duplikaterkennung).
 *
 * Bevorzugt `WB_PSEUDONYM_KEY`. Fehlt er, wird er aus `WB_ENCRYPTION_KEY`
 * abgeleitet — mit eigener Domäne, damit er nicht derselbe Schlüssel ist.
 * Es gibt bewusst KEINEN stillen Rückfall auf einen ungesalzenen Hash:
 * ohne jeden Schlüssel wirft die Funktion.
 */
function getPseudonymKey(): Buffer {
  const explicit = parseKey(process.env.WB_PSEUDONYM_KEY, "WB_PSEUDONYM_KEY");
  if (explicit) return explicit;
  return createHmac("sha256", getKey()).update("wb-pseudonym-v1").digest();
}

export function wbKeyId(): string {
  return process.env.WB_ENCRYPTION_KEY_ID?.trim() || "default";
}

/**
 * Startzeit-Prüfung (S07-19.5). Aufrufen, bevor das Meldeportal Anfragen
 * annimmt. Wirft mit einer Meldung, die sagt, was fehlt — statt jede
 * einzelne Meldung mit einem 500 zu quittieren.
 */
export function assertWbCryptoConfigured(): void {
  getKey();
  getPseudonymKey();
  getPreviousKey(); // validiert nur das Format, wenn gesetzt
}

/** True, wenn das Meldemodul kryptografisch betriebsbereit ist. */
export function isWbCryptoConfigured(): boolean {
  try {
    assertWbCryptoConfigured();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param aad Additional Authenticated Data — die Identität des Datensatzes,
 *   zu dem das Chiffrat gehört (z. B. `wb_case_message:<uuid>`). Ohne sie
 *   ist ein Chiffrat beliebig zwischen Zeilen verschiebbar (S07-19.3).
 *   Optional, damit Bestandsaufrufer weiterlaufen; neue Aufrufer setzen sie.
 * @returns `v2:<keyId>:<aadBase64Url>:<base64(iv:tag:ciphertext)>`
 */
export function encrypt(text: string, aad?: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  const combined = `${iv.toString("hex")}:${tag}:${encrypted}`;
  const payload = Buffer.from(combined).toString("base64");
  const aadPart = aad ? Buffer.from(aad, "utf8").toString("base64url") : "";
  return `v2:${wbKeyId()}:${aadPart}:${payload}`;
}

function decryptWith(
  key: Buffer,
  ivHex: string,
  tagHex: string,
  ciphertext: string,
  aad: string | undefined,
): string {
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Decrypt a string produced by encrypt().
 *
 * Versteht beide Formate und probiert den vorherigen Schlüssel, wenn der
 * aktuelle nicht passt — das ist der Rotationspfad aus S07-19.2.
 * Ist das Chiffrat an eine andere Zeile gebunden als die, für die es
 * angefordert wird, wirft die Funktion statt still zu entschlüsseln.
 */
export function decrypt(encrypted: string, aad?: string): string {
  let payload = encrypted;
  let boundAad = aad;

  if (encrypted.startsWith("v2:")) {
    const parts = encrypted.split(":");
    if (parts.length < 4) {
      throw new Error("Invalid encrypted format");
    }
    const aadB64 = parts[2]!;
    payload = parts.slice(3).join(":");
    if (aadB64) {
      boundAad = Buffer.from(aadB64, "base64url").toString("utf8");
      if (aad && aad !== boundAad) {
        throw new Error(
          "Ciphertext is bound to a different record (AAD mismatch)",
        );
      }
    } else {
      boundAad = undefined;
    }
  } else {
    // Altformat: es gibt keine AAD im Chiffrat, also darf auch keine
    // verlangt werden — sonst wird jede Bestandsmeldung unlesbar.
    boundAad = undefined;
  }

  const combined = Buffer.from(payload, "base64").toString("utf8");
  const [ivHex, tagHex, ciphertext] = combined.split(":");
  if (!ivHex || !tagHex || !ciphertext) {
    throw new Error("Invalid encrypted format");
  }

  try {
    return decryptWith(getKey(), ivHex, tagHex, ciphertext, boundAad);
  } catch (err) {
    const prev = getPreviousKey();
    if (!prev) throw err;
    return decryptWith(prev, ivHex, tagHex, ciphertext, boundAad);
  }
}

/**
 * Pseudonymise an IP address for duplicate detection.
 *
 * S07-02: vorher `sha256(ip)` — ungesalzen und damit über den gesamten
 * IPv4-Raum rückrechenbar. Jetzt HMAC-SHA256 unter einem Schlüssel, der
 * nicht in der Datenbank liegt, mit Mandanten-Diskriminator: derselbe
 * Absender bleibt innerhalb einer Organisation als Wiederholung erkennbar
 * (der fachliche Zweck), ist aber nicht über Mandanten hinweg verknüpfbar
 * und nicht auf die Adresse zurückzuführen.
 *
 * Rückgabe: 64 Hex-Zeichen — passt unverändert in `wb_report.ip_hash`.
 */
export function hashIp(ip: string, orgId?: string): string {
  return createHmac("sha256", getPseudonymKey())
    .update(`wb-ip|${orgId ?? "global"}|${ip}`)
    .digest("hex");
}

/**
 * Prüft, ob eine IP-Adresse zu einem gespeicherten Pseudonym gehört — der
 * einzige legitime Weg, ein solches Pseudonym aufzulösen, und nur mit dem
 * Schlüssel möglich.
 */
export function ipMatchesHash(
  ip: string,
  hash: string,
  orgId?: string,
): boolean {
  const expected = Buffer.from(hashIp(ip, orgId), "hex");
  let actual: Buffer;
  try {
    actual = Buffer.from(hash, "hex");
  } catch {
    return false;
  }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Generate a 128-character alphanumeric mailbox token.
 *
 * Werte ≥ 248 werden verworfen, damit die Modulo-Reduktion auf 62 Zeichen
 * nicht verzerrt ist.
 */
export function generateMailboxToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const limit = Math.floor(256 / chars.length) * chars.length; // 248
  let token = "";
  while (token.length < 128) {
    const bytes = randomBytes(128);
    for (let i = 0; i < bytes.length && token.length < 128; i++) {
      const b = bytes[i]!;
      if (b >= limit) continue;
      token += chars[b % chars.length];
    }
  }
  return token;
}
