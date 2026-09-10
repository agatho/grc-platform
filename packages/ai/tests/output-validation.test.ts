// [ARCTOS-FULL-2026-08-31 / WP6 - S05-09]
//
// Ausgabevalidierung. Der Audit hat gezaehlt: 18 von 23 Routen reichten
// `JSON.parse(cleaned)` unveraendert an den Client durch. Die Beispiele
// aus dem Befund sind hier als Testfaelle abgebildet.

import { describe, expect, it } from "vitest";
import {
  diagramHintsSchema,
  vendorClassificationSchema,
  regulatoryRelevanceSchema,
  icsControlSuggestionsSchema,
  rcmGapsSchema,
  soaGapArraySchema,
  maturityRoadmapArraySchema,
  copilotAnswerSchema,
  parseJsonArray,
} from "../src/output-schemas";

describe("optimize-diagram (das Beispiel aus S05-09)", () => {
  it("lehnt severity 'kritisch!!!' ab", () => {
    const r = diagramHintsSchema.safeParse({
      hints: [
        { severity: "kritisch!!!", kind: "gateway", message: "zusammenlegen" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("akzeptiert die drei erlaubten Stufen", () => {
    for (const severity of ["info", "warning", "error"]) {
      const r = diagramHintsSchema.safeParse({
        hints: [{ severity, kind: "k", message: "m" }],
      });
      expect(r.success).toBe(true);
    }
  });
});

describe("tprm/classify — DORA-Kritikalitaet gegen das Enum", () => {
  it("lehnt eine erfundene Stufe ab", () => {
    const r = vendorClassificationSchema.safeParse({
      category: "cloud_provider",
      tier: "systemkritisch",
      doraCriticalIctCandidate: true,
      lksgTier1Candidate: false,
      rationale: "x",
    });
    expect(r.success).toBe(false);
  });

  it("lehnt eine erfundene Kategorie ab", () => {
    const r = vendorClassificationSchema.safeParse({
      category: "quantum_provider",
      tier: "critical",
      doraCriticalIctCandidate: true,
      lksgTier1Candidate: false,
      rationale: "x",
    });
    expect(r.success).toBe(false);
  });

  it("akzeptiert eine korrekte Klassifizierung", () => {
    const r = vendorClassificationSchema.safeParse({
      category: "cloud_provider",
      tier: "critical",
      doraCriticalIctCandidate: true,
      lksgTier1Candidate: false,
      rationale: "Betreibt die Kernbankplattform.",
    });
    expect(r.success).toBe(true);
  });
});

describe("regulatory-relevance-scorer — kein Platzhalter mehr", () => {
  it("lehnt eine Antwort ohne relevanceScore ab", () => {
    expect(
      regulatoryRelevanceSchema.safeParse({
        reasoning: "irgendwas",
        affectedModules: [],
      }).success,
    ).toBe(false);
  });

  it("lehnt NaN ab (die alte Kappung reichte NaN durch)", () => {
    // Math.max(0, Math.min(100, NaN)) === NaN — der Wert lief in die Spalte.
    expect(
      regulatoryRelevanceSchema.safeParse({
        relevanceScore: Number.NaN,
        reasoning: "x",
        affectedModules: [],
      }).success,
    ).toBe(false);
  });

  it("lehnt Werte ausserhalb 0..100 ab", () => {
    for (const relevanceScore of [-1, 101, 1000]) {
      expect(
        regulatoryRelevanceSchema.safeParse({
          relevanceScore,
          reasoning: "x",
          affectedModules: [],
        }).success,
      ).toBe(false);
    }
  });

  it("lehnt eine leere Begruendung ab", () => {
    expect(
      regulatoryRelevanceSchema.safeParse({
        relevanceScore: 50,
        reasoning: "",
        affectedModules: [],
      }).success,
    ).toBe(false);
  });

  it("lehnt unbekannte Module ab", () => {
    expect(
      regulatoryRelevanceSchema.safeParse({
        relevanceScore: 50,
        reasoning: "x",
        affectedModules: ["ERM", "QUANTUM"],
      }).success,
    ).toBe(false);
  });

  it("hat KEINEN Default fuer relevanceScore", () => {
    // Genau das war der Defekt: bei Parse-Fehler wurde 50 geschrieben.
    const r = regulatoryRelevanceSchema.safeParse({
      reasoning: "Unable to parse AI response",
      affectedModules: [],
    });
    expect(r.success).toBe(false);
  });

  it("akzeptiert eine brauchbare Bewertung", () => {
    const r = regulatoryRelevanceSchema.safeParse({
      relevanceScore: 82,
      reasoning: "NIS2 betrifft die Betreiberpflichten dieser Organisation.",
      affectedModules: ["ISMS", "ERM"],
    });
    expect(r.success).toBe(true);
    expect(r.data?.relevanceScore).toBe(82);
  });
});

describe("Weitere persistierende Pfade", () => {
  it("rcm-gap: verlangt eine UUID als riskId", () => {
    expect(
      rcmGapsSchema.safeParse({
        gaps: [
          {
            riskId: "risiko-42",
            gapType: "unmitigated",
            severity: "high",
            recommendation: "x",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("soa-gap: lehnt einen unbekannten gapType ab", () => {
    expect(
      soaGapArraySchema.safeParse([
        {
          controlRef: "A.5.1",
          gapType: "teilweise",
          confidence: 80,
          priority: "high",
        },
      ]).success,
    ).toBe(false);
  });

  it("maturity-roadmap: lehnt Level ausserhalb 1..5 ab", () => {
    expect(
      maturityRoadmapArraySchema.safeParse([
        {
          domain: "A.5",
          currentLevel: 0,
          targetLevel: 9,
          title: "t",
          effort: "M",
          effortFteMonths: 1,
          priority: 5,
          quarter: "Q1",
          isQuickWin: false,
        },
      ]).success,
    ).toBe(false);
  });

  it("ics-controls: lehnt eine unbekannte Frequenz ab", () => {
    expect(
      icsControlSuggestionsSchema.safeParse({
        suggestions: [
          {
            title: "t",
            controlType: "preventive",
            frequency: "immer",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("copilot: verlangt eine nicht leere Antwort", () => {
    expect(copilotAnswerSchema.safeParse({ answer: "" }).success).toBe(false);
    expect(copilotAnswerSchema.safeParse({ answer: "ok" }).success).toBe(true);
  });
});

describe("parseJsonArray", () => {
  it("liest ein nacktes Array", () => {
    expect(parseJsonArray('[{"a":1}]')).toEqual([{ a: 1 }]);
  });
  it("liest ein Array aus einem Markdown-Fence", () => {
    expect(parseJsonArray('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
  });
  it("liefert null bei Muell", () => {
    expect(parseJsonArray("Entschuldigung, ich kann das nicht.")).toBeNull();
  });

  // [CodeQL js/polynomial-redos] Die drei Faelle oben erreichen die
  // Extraktionszeile gar nicht: das nackte und das gefencte Array parsen
  // bereits im `try`, der Muell-Fall hat keine Klammer. Erst ein Array
  // MITTEN im Fliesstext faellt in den `catch`-Zweig und laeuft ueber die
  // geaenderte Zeile.
  it("liest ein Array aus umgebendem Fliesstext", () => {
    expect(parseJsonArray('Here you go: [{"a":1}] hope that helps')).toEqual([
      { a: 1 },
    ]);
  });

  it("liest bei mehreren Klammern bis zur letzten schliessenden", () => {
    // Der alte gierige Regex dehnte sich ebenfalls bis zur LETZTEN `]` aus.
    // Der Fall haelt diese Aequivalenz fest, statt sie nur zu behaupten.
    expect(parseJsonArray("Text [1, [2, 3]] Ende")).toEqual([1, [2, 3]]);
  });

  it("liefert null, wenn eine oeffnende Klammer ohne schliessende dasteht", () => {
    expect(parseJsonArray("Ich beginne mit [ und hoere dann auf")).toBeNull();
  });

  it("liefert null, wenn die schliessende Klammer vor der oeffnenden steht", () => {
    expect(parseJsonArray("] kommt vor [")).toBeNull();
  });

  // Zeitschranke, kein Verhaltenstest. Der alte Regex brauchte auf dieser
  // Eingabe ~1,1 s (gemessen: 20k -> 186 ms, 40k -> 734 ms, 50k -> 1124 ms —
  // sauber quadratisch), die lineare Fassung ~4 ms. Das Budget liegt so, dass
  // es die alte Fassung sicher reisst und der neuen ~50x Luft laesst.
  it("bleibt bei 50.000 oeffnenden Klammern unter dem Zeitbudget", () => {
    const pathological = "[".repeat(50_000);
    const started = performance.now();
    expect(parseJsonArray(pathological)).toBeNull();
    expect(performance.now() - started).toBeLessThan(250);
  });
});
