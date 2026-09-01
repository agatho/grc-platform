// [ARCTOS-FULL-2026-08-31 / WP6 · S05-13]
//
// Gemeinsame Behandlung der Per-Org-KI-Konfiguration des EAM-Moduls.
//
// Vier Befunde, alle hier adressiert:
//
//  1. **Der API-Schlüssel lag im Klartext.** Die PUT-Route schrieb
//         const encrypted = Buffer.from(configJson).toString("base64");
//     in eine Spalte namens `config_encrypted`. Base64 ist Kodierung.
//     Jeder mit Lesezugriff auf die DB oder auf ein Backup hatte den
//     Schlüssel. Es wird jetzt `encryptSecret()` aus `@grc/shared`
//     benutzt — dasselbe AES-256-GCM-Envelope-Format (`v1:iv:tag:ct`)
//     wie für Connector- und SSO-Secrets, mit Schlüsselrotation über
//     `SECRET_ENCRYPTION_KEY_PREVIOUS`.
//
//     Bestandszeilen sind Base64 ohne Versionspräfix. Sie werden beim
//     Lesen erkannt, mit einer Warnung entschlüsselt und beim nächsten
//     Schreiben neu versiegelt. Ein stiller Bruch bestehender
//     Installationen wäre die schlechtere Wahl — aber der Zustand wird
//     im GET als `atRestEncryption: "legacy_base64"` ausgewiesen, statt
//     ihn zu verschweigen.
//
//  2. **`maskApiKey` maskierte den falschen Wert.** Sie lief über den
//     Base64-BLOB (`maskApiKey(config[0].configEncrypted)`) — die
//     Funktion maskierte also nicht das, was sie zu maskieren vorgab.
//     Sie läuft jetzt über den entschlüsselten `apiKey`.
//
//  3. **Frei setzbare `baseUrl` als SSRF-Fläche.** `aiConfigSchema`
//     akzeptiert `z.string().url().max(2000)`. Solange
//     `llm-provider.ts` toter Code war, war das latent; die Datei ist
//     mit S05-16 entfernt, und wo die URL hier verwendet wird, läuft sie
//     durch `assertUrlIsSafe()` (DNS-Rebind-Schutz inklusive) — genau
//     den Helfer, den WP5 für dieselbe Fehlerklasse eingeführt hat.
//
//  4. **Das Feature führte gar keinen LLM-Aufruf durch** — siehe die
//     einzelnen Routen.

import { db, eamAiConfig } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@grc/shared";
import { assertUrlIsSafe } from "@grc/shared/lib/url-safety-server";

export interface EamAiConfigValues {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  organizationId?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
}

export interface LoadedEamAiConfig {
  id: string;
  provider: string;
  values: EamAiConfigValues;
  validationStatus: string;
  lastValidatedAt: Date | null;
  /** `aes_256_gcm` = korrekt verschlüsselt, `legacy_base64` = Altbestand. */
  atRestEncryption: "aes_256_gcm" | "legacy_base64";
}

/** Maskiert einen API-Schlüssel — auf dem SCHLÜSSEL, nicht auf dem Blob. */
export function maskApiKey(key: string | undefined | null): string {
  if (!key || key.length < 8) return "****";
  return `${key.substring(0, 4)}…****${key.slice(-2)}`;
}

/** Versiegelt die Konfiguration für die Spalte `config_encrypted`. */
export function sealEamAiConfig(values: EamAiConfigValues): string {
  return encryptSecret(JSON.stringify(values));
}

function openEamAiConfig(stored: string): {
  values: EamAiConfigValues;
  atRestEncryption: LoadedEamAiConfig["atRestEncryption"];
} {
  if (isEncryptedSecret(stored)) {
    return {
      values: JSON.parse(decryptSecret(stored)) as EamAiConfigValues,
      atRestEncryption: "aes_256_gcm",
    };
  }
  // Altbestand: Base64 ohne Envelope. Wird beim nächsten Schreiben neu
  // versiegelt; bis dahin ausdrücklich als ungeschützt ausgewiesen.
  console.warn(
    "[eam/ai/config] legacy base64 payload found in eam_ai_config.config_encrypted — " +
      "re-save the configuration to seal it with SECRET_ENCRYPTION_KEY",
  );
  return {
    values: JSON.parse(
      Buffer.from(stored, "base64").toString("utf8"),
    ) as EamAiConfigValues,
    atRestEncryption: "legacy_base64",
  };
}

/** Lädt die aktive Konfiguration einer Organisation, oder `null`. */
export async function loadEamAiConfig(
  orgId: string,
): Promise<LoadedEamAiConfig | null> {
  const rows = await db
    .select()
    .from(eamAiConfig)
    .where(and(eq(eamAiConfig.orgId, orgId), eq(eamAiConfig.isActive, true)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const opened = openEamAiConfig(row.configEncrypted);
  return {
    id: row.id,
    provider: row.provider,
    values: opened.values,
    validationStatus: row.validationStatus ?? "untested",
    lastValidatedAt: row.lastValidatedAt ?? null,
    atRestEncryption: opened.atRestEncryption,
  };
}

/**
 * Prüft eine vom Org-Admin gesetzte `baseUrl` gegen die SSRF-Regeln
 * (private Netze, Link-Local, Metadaten-Endpunkte, DNS-Rebind).
 * Wirft `SsrfBlockedError`.
 */
export async function assertBaseUrlSafe(baseUrl: string): Promise<void> {
  await assertUrlIsSafe(baseUrl);
}
