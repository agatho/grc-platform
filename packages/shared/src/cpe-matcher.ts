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

/**
 * Sanitize user-generated content before including in LLM prompts.
 * Removes potential injection patterns.
 */
export function sanitizeForPrompt(text: string): string {
  return text
    .replace(/```/g, "")
    .replace(/\{[{%]/g, "")
    .replace(/[%}]\}/g, "")
    .replace(/<\/?script>/gi, "")
    .replace(/\bignore\s+(all\s+)?previous\s+instructions?\b/gi, "")
    .replace(/\bsystem\s*:\s*/gi, "")
    .slice(0, 2000); // cap length
}
