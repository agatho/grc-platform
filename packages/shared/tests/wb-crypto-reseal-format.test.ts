// [ARCTOS-FULL-2026-08-31 · Welle 5c · OP-128]
//
// `scripts/reseal-wb-secrets.mjs` schreibt die Hinweisgeber-Chiffrate auf
// einen neuen `WB_ENCRYPTION_KEY` um. Es kann `packages/shared/src/wb-crypto.ts`
// nicht importieren (eine .mjs liest keine TypeScript-Quelle), also gibt es
// das Umschlagformat zweimal: dort als `scripts/lib/wb-envelope.mjs`, hier
// als `encrypt()`/`decrypt()`.
//
// Zwei Fassungen desselben Formats an zwei Orten sind genau die Stelle, an
// der ein Re-Seal-Skript unbemerkt Datenmüll erzeugt: es entschlüsselt mit
// dem alten Schlüssel korrekt, schreibt mit dem neuen etwas, das die
// Anwendung nicht mehr lesen kann — und der Klartext ist weg.
//
// Diese Suite verschlüsselt mit der einen Seite und entschlüsselt mit der
// anderen, in beide Richtungen, mit und ohne AAD-Bindung, im Alt- und im
// v2-Format. Bewegt sich eine Seite, fällt sie.
//
// Gegen den Stand vor dieser Welle fällt sie beim Import — weder das Modul
// noch das Skript existierten.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCipheriv, randomBytes } from "node:crypto";

const OLD_KEY = "0".repeat(63) + "1";
const NEW_KEY = "0".repeat(63) + "2";

interface WbEnvelope {
  ivHex: string;
  tagHex: string;
  ciphertext: string;
  aad?: string;
  keyId: string | null;
  legacy: boolean;
}

interface EnvelopeModule {
  parseWbEnvelope(value: unknown): WbEnvelope | null;
  decryptWbEnvelope(key: Buffer, env: WbEnvelope): string;
  tryDecryptWbEnvelope(key: Buffer, env: WbEnvelope): string | null;
  encryptWbEnvelope(
    key: Buffer,
    keyId: string,
    plaintext: string,
    aad?: string,
  ): string;
  WB_IV_BYTES: number;
}

/**
 * Das Skriptmodul über einen berechneten Pfad laden: der TypeScript-Compiler
 * dieses Pakets kennt `scripts/` nicht (`include: ["src", "tests"]`), und ein
 * statischer Import auf eine .mjs ausserhalb des Projekts wäre TS2307. Der
 * Pfad ist die einzige Kopplung — läuft sie ins Leere, fällt der erste Test
 * mit ERR_MODULE_NOT_FOUND statt still zu überspringen.
 */
async function loadEnvelopeModule(): Promise<EnvelopeModule> {
  const href = new URL("../../../scripts/lib/wb-envelope.mjs", import.meta.url)
    .href;
  return (await import(/* @vite-ignore */ href)) as EnvelopeModule;
}

/** Ein Chiffrat im ALTFORMAT, so wie wb-crypto.ts es vor `v2:` schrieb. */
function legacyCiphertext(keyHex: string, plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  let ct = cipher.update(plaintext, "utf8", "hex");
  ct += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return Buffer.from(`${iv.toString("hex")}:${tag}:${ct}`).toString("base64");
}

let saved: Record<string, string | undefined> = {};
const MANAGED = [
  "WB_ENCRYPTION_KEY",
  "WB_ENCRYPTION_KEY_PREVIOUS",
  "WB_ENCRYPTION_KEY_ID",
  "WB_PSEUDONYM_KEY",
];

beforeEach(() => {
  saved = Object.fromEntries(MANAGED.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const key of MANAGED) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Re-Seal-Format: Anwendung schreibt, Skript liest", () => {
  it("liest ein Chiffrat ohne AAD", async () => {
    const env = await loadEnvelopeModule();
    process.env.WB_ENCRYPTION_KEY = OLD_KEY;
    const { encrypt } = await import("../src/wb-crypto");

    const sealed = encrypt("Meldung ohne Bindung");
    const parsed = env.parseWbEnvelope(sealed);
    expect(parsed, "Umschlag nicht lesbar").not.toBeNull();
    if (!parsed) return;
    expect(parsed.legacy).toBe(false);
    expect(parsed.keyId).toBe("default");
    expect(parsed.aad).toBeUndefined();
    expect(env.decryptWbEnvelope(Buffer.from(OLD_KEY, "hex"), parsed)).toBe(
      "Meldung ohne Bindung",
    );
  });

  it("liest ein Chiffrat MIT AAD und behält die Bindung", async () => {
    const env = await loadEnvelopeModule();
    process.env.WB_ENCRYPTION_KEY = OLD_KEY;
    const { encrypt } = await import("../src/wb-crypto");

    const aad = "wb_case_message:11111111-2222-3333-4444-555555555555";
    const parsed = env.parseWbEnvelope(encrypt("Nachricht", aad));
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(parsed.aad).toBe(aad);
    expect(env.decryptWbEnvelope(Buffer.from(OLD_KEY, "hex"), parsed)).toBe(
      "Nachricht",
    );
  });

  it("liest das Altformat ohne Präfix", async () => {
    const env = await loadEnvelopeModule();
    const parsed = env.parseWbEnvelope(legacyCiphertext(OLD_KEY, "Bestand"));
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(parsed.legacy).toBe(true);
    expect(parsed.keyId).toBeNull();
    expect(env.decryptWbEnvelope(Buffer.from(OLD_KEY, "hex"), parsed)).toBe(
      "Bestand",
    );
  });

  it("gibt bei falschem Schlüssel null zurück, statt zu werfen", async () => {
    // Auf dieser Antwort beruht die Idempotenz des Skripts: „öffnet der
    // NEUE Schlüssel die Zeile?" muss beantwortbar sein, ohne dass ein
    // Fehlversuch den Lauf abbricht.
    const env = await loadEnvelopeModule();
    process.env.WB_ENCRYPTION_KEY = OLD_KEY;
    const { encrypt } = await import("../src/wb-crypto");

    const parsed = env.parseWbEnvelope(encrypt("geheim"));
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(env.tryDecryptWbEnvelope(Buffer.from(NEW_KEY, "hex"), parsed)).toBe(
      null,
    );
    expect(env.tryDecryptWbEnvelope(Buffer.from(OLD_KEY, "hex"), parsed)).toBe(
      "geheim",
    );
  });

  it("erkennt Werte, die gar kein Chiffrat sind", async () => {
    const env = await loadEnvelopeModule();
    for (const value of ["", "Klartext ohne alles", "v2:default", 42, null]) {
      expect(env.parseWbEnvelope(value), String(value)).toBeNull();
    }
  });
});

describe("Re-Seal-Format: Skript schreibt, Anwendung liest", () => {
  it("schreibt einen Umschlag, den decrypt() öffnet", async () => {
    const env = await loadEnvelopeModule();
    const sealed = env.encryptWbEnvelope(
      Buffer.from(NEW_KEY, "hex"),
      "default",
      "Umgeschlüsselt",
    );

    process.env.WB_ENCRYPTION_KEY = NEW_KEY;
    delete process.env.WB_ENCRYPTION_KEY_PREVIOUS;
    const { decrypt } = await import("../src/wb-crypto");
    expect(decrypt(sealed)).toBe("Umgeschlüsselt");
  });

  it("erhält die AAD-Bindung aus S07-19.3", async () => {
    const env = await loadEnvelopeModule();
    const aad = "wb_case_message:99999999-8888-7777-6666-555555555555";
    const sealed = env.encryptWbEnvelope(
      Buffer.from(NEW_KEY, "hex"),
      "rot-2026",
      "Gebundene Nachricht",
      aad,
    );

    process.env.WB_ENCRYPTION_KEY = NEW_KEY;
    const { decrypt } = await import("../src/wb-crypto");
    expect(decrypt(sealed, aad)).toBe("Gebundene Nachricht");
    // An eine andere Zeile gebunden: muss werfen, nicht still öffnen.
    expect(() => decrypt(sealed, "wb_case_message:andere")).toThrow(
      /different record/,
    );
  });

  it("trägt die Schlüsselkennung, die WB_ENCRYPTION_KEY_ID setzt", async () => {
    const env = await loadEnvelopeModule();
    const sealed = env.encryptWbEnvelope(
      Buffer.from(NEW_KEY, "hex"),
      "rot-2026",
      "x",
    );
    expect(sealed.startsWith("v2:rot-2026:")).toBe(true);
  });
});

// Die Sperre in `scripts/reseal-wb-secrets.mjs` behauptet zweierlei: dass
// ein Wechsel von WB_ENCRYPTION_KEY die IP-Pseudonyme mitreisst, und dass
// der ausgedruckte Befehl den Wert liefert, mit dem man das verhindert.
// Beides wird hier nachgerechnet — eine Sperre mit einem Ratschlag, der
// nicht stimmt, ist schlimmer als keine.
describe("Pseudonymschlüssel-Sperre des Re-Seal-Skripts (OP-128)", () => {
  it("reisst die IP-Pseudonyme mit, wenn WB_PSEUDONYM_KEY nicht gesetzt ist", async () => {
    const wb = await import("../src/wb-crypto");
    delete process.env.WB_PSEUDONYM_KEY;

    process.env.WB_ENCRYPTION_KEY = OLD_KEY;
    const before = wb.hashIp("203.0.113.7", "org-1");

    process.env.WB_ENCRYPTION_KEY = NEW_KEY;
    const after = wb.hashIp("203.0.113.7", "org-1");

    expect(after).not.toBe(before);
    expect(wb.ipMatchesHash("203.0.113.7", before, "org-1")).toBe(false);
  });

  it("hält sie, wenn WB_PSEUDONYM_KEY auf den abgeleiteten Wert steht", async () => {
    const { createHmac } = await import("node:crypto");
    const wb = await import("../src/wb-crypto");

    delete process.env.WB_PSEUDONYM_KEY;
    process.env.WB_ENCRYPTION_KEY = OLD_KEY;
    const before = wb.hashIp("203.0.113.7", "org-1");

    // Exakt der Ausdruck, den das Skript in seiner Fehlermeldung ausgibt.
    const derived = createHmac("sha256", Buffer.from(OLD_KEY, "hex"))
      .update("wb-pseudonym-v1")
      .digest("hex");

    process.env.WB_ENCRYPTION_KEY = NEW_KEY;
    process.env.WB_PSEUDONYM_KEY = derived;
    expect(wb.hashIp("203.0.113.7", "org-1")).toBe(before);
    expect(wb.ipMatchesHash("203.0.113.7", before, "org-1")).toBe(true);
    delete process.env.WB_PSEUDONYM_KEY;
  });
});

describe("Re-Seal: der ganze Vorgang", () => {
  it("macht aus einem Bestandschiffrat eines, das ohne PREVIOUS lesbar ist", async () => {
    const env = await loadEnvelopeModule();

    // 1. Bestand: unter dem ALTEN Schlüssel geschrieben, mit Bindung.
    process.env.WB_ENCRYPTION_KEY = OLD_KEY;
    const wb = await import("../src/wb-crypto");
    const aad = "wb_case_message:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const before = wb.encrypt("Vertrauliche Meldung", aad);

    // 2. Re-Seal, genau wie das Skript es tut.
    const parsed = env.parseWbEnvelope(before);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(
      env.tryDecryptWbEnvelope(Buffer.from(NEW_KEY, "hex"), parsed),
      "vor dem Re-Seal darf der neue Schlüssel nicht passen",
    ).toBe(null);
    const plaintext = env.tryDecryptWbEnvelope(
      Buffer.from(OLD_KEY, "hex"),
      parsed,
    );
    expect(plaintext).toBe("Vertrauliche Meldung");
    const after = env.encryptWbEnvelope(
      Buffer.from(NEW_KEY, "hex"),
      "default",
      plaintext ?? "",
      parsed.aad,
    );

    // 3. Danach ist der alte Schlüssel entbehrlich — genau das ist der
    //    Zweck: WB_ENCRYPTION_KEY_PREVIOUS darf aus der Umgebung raus.
    process.env.WB_ENCRYPTION_KEY = NEW_KEY;
    delete process.env.WB_ENCRYPTION_KEY_PREVIOUS;
    expect(wb.decrypt(after, aad)).toBe("Vertrauliche Meldung");

    // 4. Und ein zweiter Lauf schreibt nichts mehr (Idempotenz).
    const second = env.parseWbEnvelope(after);
    expect(second).not.toBeNull();
    if (!second) return;
    expect(env.tryDecryptWbEnvelope(Buffer.from(NEW_KEY, "hex"), second)).toBe(
      "Vertrauliche Meldung",
    );
  });

  it("hebt ein Altformat-Chiffrat auf v2 ohne Bindung", async () => {
    const env = await loadEnvelopeModule();
    const legacy = legacyCiphertext(OLD_KEY, "Alte Meldung");

    const parsed = env.parseWbEnvelope(legacy);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    const plaintext = env.tryDecryptWbEnvelope(
      Buffer.from(OLD_KEY, "hex"),
      parsed,
    );
    const after = env.encryptWbEnvelope(
      Buffer.from(NEW_KEY, "hex"),
      "default",
      plaintext ?? "",
      parsed.aad,
    );

    process.env.WB_ENCRYPTION_KEY = NEW_KEY;
    delete process.env.WB_ENCRYPTION_KEY_PREVIOUS;
    const { decrypt } = await import("../src/wb-crypto");
    // Ohne Bindung geschrieben, also auch ohne verlangt lesbar.
    expect(decrypt(after)).toBe("Alte Meldung");
  });
});
