/**
 * CPE 2.3 Matching Utilities
 *
 * CPE format: cpe:2.3:part:vendor:product:version:update:edition:language:sw_edition:target_sw:target_hw:other
 * Wildcard '*' matches any value in that position.
 *
 * Matching rules:
 * - Exact match on part, vendor, product
 * - Wildcard in asset CPE means "any version" of that product
 * - Wildcard in CVE CPE means "all versions affected"
 * - Version matching: exact or wildcard
 */

export interface ParsedCpe {
  raw: string;
  part: string; // a=application, h=hardware, o=os
  vendor: string;
  product: string;
  version: string;
  update: string;
  edition: string;
  language: string;
  swEdition: string;
  targetSw: string;
  targetHw: string;
  other: string;
}

/**
 * Parse a CPE 2.3 URI string into components.
 */
export function parseCpe(cpeUri: string): ParsedCpe | null {
  if (!cpeUri || !cpeUri.startsWith("cpe:2.3:")) return null;

  const parts = cpeUri.split(":");
  if (parts.length < 5) return null;

  return {
    raw: cpeUri,
    part: parts[2] ?? "*",
    vendor: (parts[3] ?? "*").toLowerCase(),
    product: (parts[4] ?? "*").toLowerCase(),
    version: (parts[5] ?? "*").toLowerCase(),
    update: (parts[6] ?? "*").toLowerCase(),
    edition: (parts[7] ?? "*").toLowerCase(),
    language: (parts[8] ?? "*").toLowerCase(),
    swEdition: (parts[9] ?? "*").toLowerCase(),
    targetSw: (parts[10] ?? "*").toLowerCase(),
    targetHw: (parts[11] ?? "*").toLowerCase(),
    other: (parts[12] ?? "*").toLowerCase(),
  };
}

/**
 * Check if a single CPE component matches.
 * '*' on either side matches anything.
 * '-' means "not applicable" and matches only '-' or '*'.
 */
function componentMatches(cvePart: string, assetPart: string): boolean {
  if (cvePart === "*" || assetPart === "*") return true;
  if (cvePart === "-" && assetPart === "-") return true;
  if (cvePart === "-" || assetPart === "-") return false;
  return cvePart === assetPart;
}

/**
 * Check whether a CVE's affected CPE matches an asset's CPE.
 * Both are CPE 2.3 format strings.
 */
export function cpeMatchesSingle(cveCpe: string, assetCpe: string): boolean {
  const cve = parseCpe(cveCpe);
  const asset = parseCpe(assetCpe);

  if (!cve || !asset) return false;

  // Must match: part, vendor, product
  if (!componentMatches(cve.part, asset.part)) return false;
  if (!componentMatches(cve.vendor, asset.vendor)) return false;
  if (!componentMatches(cve.product, asset.product)) return false;

  // Version matching
  if (!componentMatches(cve.version, asset.version)) return false;

  return true;
}

/**
 * Check whether any of the CVE's affected CPEs match the asset CPE.
 */
export function cpeMatches(cveCpes: string[], assetCpe: string): boolean {
  return cveCpes.some((cveCpe) => cpeMatchesSingle(cveCpe, assetCpe));
}

/**
 * Extract vendor and product from a CPE URI string.
 */
export function extractCpeVendorProduct(
  cpeUri: string,
): { vendor: string; product: string; version: string } | null {
  const parsed = parseCpe(cpeUri);
  if (!parsed) return null;
  return {
    vendor: parsed.vendor,
    product: parsed.product,
    version: parsed.version,
  };
}

/**
 * Calculate CVSS severity from score.
 */
export function cvssToSeverity(
  score: number,
): "critical" | "high" | "medium" | "low" | "none" {
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  if (score > 0) return "low";
  return "none";
}

// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06]
//
// Die Vorgängerfassung war eine Blocklist:
//
//   .replace(/\bignore\s+(all\s+)?previous\s+instructions?\b/gi, "")
//   .replace(/\bsystem\s*:\s*/gi, "")
//   .replace(/```/g, "") …
//
// Sie hatte drei Defekte, die der Audit einzeln reproduziert hat
// (`evidence/S05_prompt_injection_sanitizer.txt`):
//
//  1. **Sprachgebunden.** „Ignoriere alle vorherigen Anweisungen" und
//     „Disregard the prior directives" passierten unverändert. Eine
//     Blocklist gegen natürliche Sprache ist grundsätzlich nicht
//     vollständig — jede Umschreibung umgeht sie.
//  2. **Kein Delimiter-Schutz.** `</grc_data>` wurde nicht angetastet;
//     genau das Tag, auf dem die Instruktionshärtung beruht, konnte im
//     Klartext aus den Daten heraus geschlossen werden.
//  3. **Datenverfälschung.** Das Löschen von Treffern verändert
//     GRC-Fachtexte still (ein Risiko namens „System: Kernbanksystem"
//     verlor seinen Anfang), ohne die Injection zu verhindern.
//
// Der Ersatz verfolgt deshalb nicht mehr das Ziel, Angriffsabsicht zu
// ERKENNEN. Die Trennung von Instruktion und Daten ist strukturell und
// liegt in `@grc/ai` → `prompt-safety.ts` (`buildDataPrompt`): Nutzdaten
// werden JSON-kodiert in einen Umschlag mit einem pro Aufruf zufälligen
// Nonce-Delimiter gelegt, den der Angreifer nicht erraten kann.
//
// Diese Funktion leistet nur noch das, was sich verlustfrei und
// sprachunabhängig begründen lässt: Normalisierung von Zeichen, die die
// STRUKTUR des Prompts verfälschen können (Steuerzeichen, Bidi-/
// Zero-Width-Overrides, Unicode-Homoglyph-Normalisierung) plus eine
// Längenkappe. Fachlicher Inhalt bleibt unangetastet.

/** Zeichen, die im Prompt nichts zu suchen haben, aber Struktur verfaelschen. */
// C0 (ohne \t \n \r), DEL, C1
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Bidi-Overrides + Zero-Width/Invisible: "Trojan Source"-Klasse. Diese
// Zeichen erlauben es, im Rohtext etwas anderes zu zeigen als das Modell
// liest — die einzige Klasse, deren Entfernung wirklich Angriffe verhindert.
const INVISIBLE_CHARS =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/**
 * Normalisiert von Nutzern stammenden Text, bevor er als DATEN in einen
 * LLM-Prompt gelegt wird.
 *
 * Wichtig: das ist **keine** Injection-Abwehr. Die Abwehr ist die
 * strukturelle Trennung in `buildDataPrompt()` (@grc/ai). Diese Funktion
 * entfernt ausschließlich Zeichen, die die Struktur des Umschlags oder
 * die Darstellung verfälschen, und begrenzt die Länge.
 *
 * @param text     Rohtext aus der Datenbank oder vom Client
 * @param maxChars Längenkappe (Default 2000, wie zuvor)
 */
export function sanitizeForPrompt(text: string, maxChars = 2000): string {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFKC")
    .replace(CONTROL_CHARS, " ")
    .replace(INVISIBLE_CHARS, "")
    .slice(0, maxChars);
}
