import { describe, it, expect } from "vitest";
import {
  parseCpe,
  cpeMatchesSingle,
  cpeMatches,
  cvssToSeverity,
  extractCpeVendorProduct,
  sanitizeForPrompt,
} from "../src/cpe-matcher";

describe("parseCpe", () => {
  it("should parse a valid CPE 2.3 string", () => {
    const result = parseCpe("cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*");
    expect(result).not.toBeNull();
    expect(result!.part).toBe("a");
    expect(result!.vendor).toBe("apache");
    expect(result!.product).toBe("log4j");
    expect(result!.version).toBe("2.14.1");
  });

  it("should return null for invalid CPE", () => {
    expect(parseCpe("")).toBeNull();
    expect(parseCpe("not-a-cpe")).toBeNull();
    expect(parseCpe("cpe:1.0:something")).toBeNull();
  });

  it("should handle wildcard-only CPE", () => {
    const result = parseCpe("cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*");
    expect(result!.version).toBe("*");
  });

  it("should lowercase vendor and product", () => {
    const result = parseCpe("cpe:2.3:a:Apache:Log4J:2.14:*:*:*:*:*:*:*");
    expect(result!.vendor).toBe("apache");
    expect(result!.product).toBe("log4j");
  });
});

describe("cpeMatchesSingle", () => {
  it("should match exact vendor+product with wildcard version on asset", () => {
    const cveCpe = "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*";
    const assetCpe = "cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*";
    expect(cpeMatchesSingle(cveCpe, assetCpe)).toBe(true);
  });

  it("should NOT match different vendor", () => {
    const cveCpe = "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*";
    const assetCpe = "cpe:2.3:a:microsoft:iis:*:*:*:*:*:*:*:*";
    expect(cpeMatchesSingle(cveCpe, assetCpe)).toBe(false);
  });

  it("should NOT match different product", () => {
    const cveCpe = "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*";
    const assetCpe = "cpe:2.3:a:apache:httpd:*:*:*:*:*:*:*:*";
    expect(cpeMatchesSingle(cveCpe, assetCpe)).toBe(false);
  });

  it("should match when both sides have wildcard version", () => {
    const cveCpe = "cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*";
    const assetCpe = "cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*";
    expect(cpeMatchesSingle(cveCpe, assetCpe)).toBe(true);
  });

  it("should match exact versions", () => {
    const cveCpe = "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*";
    const assetCpe = "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*";
    expect(cpeMatchesSingle(cveCpe, assetCpe)).toBe(true);
  });

  it("should NOT match different exact versions", () => {
    const cveCpe = "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*";
    const assetCpe = "cpe:2.3:a:apache:log4j:2.15.0:*:*:*:*:*:*:*";
    expect(cpeMatchesSingle(cveCpe, assetCpe)).toBe(false);
  });

  it("should match hardware (h) part type", () => {
    const cveCpe = "cpe:2.3:h:cisco:asr_1001:*:*:*:*:*:*:*:*";
    const assetCpe = "cpe:2.3:h:cisco:asr_1001:*:*:*:*:*:*:*:*";
    expect(cpeMatchesSingle(cveCpe, assetCpe)).toBe(true);
  });

  it("should NOT match different part types", () => {
    const cveCpe = "cpe:2.3:a:cisco:asr_1001:*:*:*:*:*:*:*:*";
    const assetCpe = "cpe:2.3:h:cisco:asr_1001:*:*:*:*:*:*:*:*";
    expect(cpeMatchesSingle(cveCpe, assetCpe)).toBe(false);
  });

  it("should return false for invalid CPE strings", () => {
    expect(cpeMatchesSingle("invalid", "cpe:2.3:a:apache:log4j:*")).toBe(false);
    expect(cpeMatchesSingle("cpe:2.3:a:apache:log4j:*", "invalid")).toBe(false);
  });
});

describe("cpeMatches", () => {
  it("should match when any CVE CPE matches the asset CPE", () => {
    const cveCpes = [
      "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*",
      "cpe:2.3:a:apache:log4j:2.14.0:*:*:*:*:*:*:*",
    ];
    const assetCpe = "cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*";
    expect(cpeMatches(cveCpes, assetCpe)).toBe(true);
  });

  it("should NOT match when no CVE CPE matches", () => {
    const cveCpes = ["cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*"];
    const assetCpe = "cpe:2.3:a:microsoft:iis:*:*:*:*:*:*:*:*";
    expect(cpeMatches(cveCpes, assetCpe)).toBe(false);
  });

  it("should handle empty CVE CPE list", () => {
    expect(cpeMatches([], "cpe:2.3:a:apache:log4j:*")).toBe(false);
  });
});

describe("cvssToSeverity", () => {
  it("should return critical for score >= 9.0", () => {
    expect(cvssToSeverity(9.0)).toBe("critical");
    expect(cvssToSeverity(9.5)).toBe("critical");
    expect(cvssToSeverity(10.0)).toBe("critical");
  });

  it("should return high for score 7.0-8.9", () => {
    expect(cvssToSeverity(7.0)).toBe("high");
    expect(cvssToSeverity(7.2)).toBe("high");
    expect(cvssToSeverity(8.9)).toBe("high");
  });

  it("should return medium for score 4.0-6.9", () => {
    expect(cvssToSeverity(4.0)).toBe("medium");
    expect(cvssToSeverity(4.5)).toBe("medium");
    expect(cvssToSeverity(6.9)).toBe("medium");
  });

  it("should return low for score 0.1-3.9", () => {
    expect(cvssToSeverity(0.1)).toBe("low");
    expect(cvssToSeverity(2.1)).toBe("low");
    expect(cvssToSeverity(3.9)).toBe("low");
  });

  it("should return none for score 0", () => {
    expect(cvssToSeverity(0)).toBe("none");
  });
});

describe("extractCpeVendorProduct", () => {
  it("should extract vendor and product from CPE", () => {
    const result = extractCpeVendorProduct(
      "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*",
    );
    expect(result).toEqual({
      vendor: "apache",
      product: "log4j",
      version: "2.14.1",
    });
  });

  it("should return null for invalid CPE", () => {
    expect(extractCpeVendorProduct("invalid")).toBeNull();
  });
});

// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06]
//
// `sanitizeForPrompt` ist keine Blocklist mehr. Die drei geloeschten
// Tests haben eine Schutzwirkung geprueft, die es nie gab: der Audit hat
// die Blocklist mit deutschen und umformulierten Nutzlasten umgangen
// (`evidence/S05_prompt_injection_sanitizer.txt`), und das Loeschen von
// Treffern hat GRC-Fachtexte verfaelscht (aus dem Risiko "System:
// Kernbanksystem" wurde "Kernbanksystem").
//
// Die Injection-Abwehr ist jetzt strukturell und liegt in
// `@grc/ai` -> `prompt-safety.ts`; sie wird dort getestet
// (`packages/ai/tests/prompt-injection.test.ts`). Diese Funktion
// normalisiert nur noch Zeichen, die die Struktur des Prompts
// verfaelschen, und kappt die Laenge.
describe("sanitizeForPrompt", () => {
  it("laesst Fachtext unveraendert — auch Code-Fences und Doppelklammern", () => {
    expect(sanitizeForPrompt("test ```code``` after")).toBe(
      "test ```code``` after",
    );
    expect(sanitizeForPrompt("Platzhalter {{name}} im Template")).toBe(
      "Platzhalter {{name}} im Template",
    );
    // Der frueher zerstoerte Fall.
    expect(sanitizeForPrompt("System: Kernbanksystem")).toBe(
      "System: Kernbanksystem",
    );
  });

  it("entfernt Steuerzeichen und unsichtbare Bidi-/Zero-Width-Zeichen", () => {
    const rlo = String.fromCharCode(0x202e);
    const zwsp = String.fromCharCode(0x200b);
    const bell = String.fromCharCode(0x07);
    expect(sanitizeForPrompt("a" + rlo + "b")).toBe("ab");
    expect(sanitizeForPrompt("a" + zwsp + "b")).toBe("ab");
    expect(sanitizeForPrompt("a" + bell + "b")).toBe("a b");
  });

  it("normalisiert Unicode (NFKC)", () => {
    // Vollbreite Zeichen wuerden sonst als andere Zeichen gelesen.
    expect(sanitizeForPrompt("\uFF29\uFF47\uFF4E")).toBe("Ign");
  });

  it("should truncate long strings", () => {
    const longInput = "a".repeat(3000);
    expect(sanitizeForPrompt(longInput).length).toBe(2000);
    expect(sanitizeForPrompt(longInput, 50).length).toBe(50);
  });

  it("should handle empty strings", () => {
    expect(sanitizeForPrompt("")).toBe("");
  });
});
