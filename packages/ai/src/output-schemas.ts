// [ARCTOS-FULL-2026-08-31 / WP6 · S05-09]
//
// Ausgabeschemata für die AI-Routen.
//
// Befundlage: 18 von 23 Routen reichten `JSON.parse(cleaned)` unverändert
// an den Client durch. `optimize-diagram` konnte `severity: "kritisch!!!"`
// und erfundene `bpmnElementId`s liefern, `tprm/.../classify` eine
// DORA-Kritikalität ausserhalb des Enums. Der gravierendste Fall war der
// `regulatory-relevance-scorer`, der bei unparsebarer Antwort eine
// Ersatzbewertung von 50 als reguläre Bewertung persistierte.
//
// Grundregel dieser Datei: **Ein Schema beschreibt, was übernommen werden
// darf — nicht, was das Modell hoffentlich schickt.** Wo eine Ausgabe
// persistiert wird, ist `.strict()`-nahes Verhalten (unbekannte Felder
// werden verworfen, nicht durchgereicht) und ein Pflichtfeld ohne
// Default die richtige Wahl: ein fehlender Wert muss zum Scheitern
// führen, nicht zu einem Platzhalter.

import { z } from "zod";

const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();

// ── BPM ────────────────────────────────────────────────────────────
export const bpmnGenerationSchema = z.object({
  bpmnXml: z.string().min(20).max(400_000),
  summary: optionalText(1000),
  activities: z
    .array(
      z.object({
        name: shortText(300),
        type: z.enum(["task", "gateway", "event"]).optional(),
        description: optionalText(1000),
      }),
    )
    .max(200)
    .default([]),
});

export const riskSuggestionsSchema = z.object({
  risks: z
    .array(
      z.object({
        title: shortText(500),
        category: z
          .enum([
            "operational",
            "strategic",
            "financial",
            "compliance",
            "security",
            "reputational",
          ])
          .optional(),
        description: optionalText(4000),
        rationale: optionalText(4000),
      }),
    )
    .max(20),
});

export const processControlSuggestionsSchema = z.object({
  controls: z
    .array(
      z.object({
        title: shortText(500),
        controlType: z
          .enum(["preventive", "detective", "corrective", "directive"])
          .optional(),
        automationLevel: z
          .enum(["manual", "partially_automated", "automated"])
          .optional(),
        description: optionalText(4000),
        addressesRisks: z.array(z.string().max(500)).max(50).optional(),
      }),
    )
    .max(20),
});

export const frameworkMappingsSchema = z.object({
  mappings: z
    .array(
      z.object({
        frameworkCode: shortText(80),
        entryCode: optionalText(120),
        title: optionalText(500),
        mappingStrength: z
          .enum(["covers", "partial", "references"])
          .optional(),
        rationale: optionalText(2000),
      }),
    )
    .max(12),
});

export const diagramHintsSchema = z.object({
  hints: z
    .array(
      z.object({
        // Der Auslöser des Befunds: "kritisch!!!" ist hier kein gültiger Wert.
        severity: z.enum(["info", "warning", "error"]),
        kind: shortText(120),
        bpmnElementId: optionalText(200),
        message: shortText(2000),
        rationale: optionalText(2000),
      }),
    )
    .max(50),
});

// ── Audit ──────────────────────────────────────────────────────────
export const checklistItemsSchema = z.object({
  items: z
    .array(
      z.object({
        title: shortText(500),
        description: optionalText(4000),
        method: z
          .enum([
            "interview",
            "document_review",
            "observation",
            "technical_test",
            "sampling",
            "walkthrough",
            "reperformance",
          ])
          .optional(),
        framework: optionalText(120),
        frameworkReference: optionalText(200),
        riskRating: z.enum(["low", "medium", "high", "critical"]).optional(),
      }),
    )
    .max(25),
});

export const findingSuggestionsSchema = z.object({
  findings: z
    .array(
      z.object({
        title: shortText(500),
        description: optionalText(8000),
        severity: z.enum(["critical", "high", "medium", "low"]).optional(),
        evidenceSummary: optionalText(4000),
        remediationPlan: optionalText(4000),
        remediationDueDateRelativeDays: z
          .number()
          .int()
          .min(0)
          .max(3650)
          .optional(),
      }),
    )
    .max(50),
});

// ── TPRM ───────────────────────────────────────────────────────────
export const vendorClassificationSchema = z.object({
  category: z.enum([
    "it_services",
    "cloud_provider",
    "consulting",
    "facility",
    "logistics",
    "raw_materials",
    "financial",
    "hr_services",
    "other",
  ]),
  tier: z.enum(["critical", "important", "standard", "low_risk"]),
  doraCriticalIctCandidate: z.boolean(),
  lksgTier1Candidate: z.boolean(),
  rationale: shortText(2000),
});

export const ddQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        section: z.enum([
          "InfoSec",
          "Financial",
          "Legal",
          "HR",
          "Sustainability",
          "Operational",
          "DataProtection",
        ]),
        question: shortText(2000),
        questionType: z
          .enum(["boolean", "text", "number", "multi_choice"])
          .optional(),
        isMandatory: z.boolean().optional(),
        evidenceRequired: z.boolean().optional(),
      }),
    )
    .max(25),
});

// ── DPMS ───────────────────────────────────────────────────────────
export const ropaDraftSchema = z.object({
  purpose: optionalText(4000),
  legalBasis: z
    .enum([
      "consent",
      "contract",
      "legal_obligation",
      "vital_interest",
      "public_interest",
      "legitimate_interest",
    ])
    .optional(),
  legalBasisDetail: optionalText(4000),
  dataSubjectCategories: z.array(z.string().max(300)).max(50).default([]),
  personalDataCategories: z.array(z.string().max(300)).max(50).default([]),
  specialCategories: z.array(z.string().max(300)).max(50).default([]),
  recipients: z.array(z.string().max(300)).max(50).default([]),
  thirdCountryTransfers: z.boolean().optional(),
  retentionPeriodDescription: optionalText(2000),
  retentionPeriodMonths: z.number().int().min(0).max(1200).optional(),
  tomDescription: optionalText(4000),
});

export const dpiaMeasuresSchema = z.object({
  measures: z
    .array(
      z.object({
        title: shortText(300),
        description: optionalText(4000),
        measureType: z.enum(["technical", "organizational"]).optional(),
        addressesRiskTitle: optionalText(500),
        expectedResidualReductionPct: z
          .number()
          .min(0)
          .max(100)
          .optional(),
      }),
    )
    .max(50),
});

// ── ICS / ERM (die vier vormals inline gebauten Routen) ────────────
export const icsControlSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: shortText(500),
        controlType: z.enum(["preventive", "detective", "corrective"]),
        frequency: z.enum([
          "daily",
          "weekly",
          "monthly",
          "quarterly",
          "annually",
          "event_driven",
        ]),
        frameworkRef: optionalText(200),
        rationale: optionalText(4000),
      }),
    )
    .max(5),
});

export const testPlanSchema = z.object({
  objective: shortText(4000),
  scope: optionalText(4000),
  approach: optionalText(4000),
  sampleSize: optionalText(500),
  steps: z
    .array(
      z.object({
        step: z.number().int().min(1).max(200),
        action: shortText(2000),
        expectedEvidence: optionalText(2000),
      }),
    )
    .max(100)
    .default([]),
  focusAreas: z.array(z.string().max(500)).max(50).default([]),
  riskBasedConsiderations: optionalText(4000),
  estimatedDuration: optionalText(200),
});

export const rcmGapsSchema = z.object({
  gaps: z
    .array(
      z.object({
        riskId: z.string().uuid(),
        riskTitle: optionalText(500),
        gapType: z.enum([
          "unmitigated",
          "type_gap",
          "frequency_gap",
          "orphaned",
        ]),
        severity: z.enum(["high", "medium", "low"]),
        recommendation: shortText(4000),
      }),
    )
    .max(100),
});

export const rootCausePatternsSchema = z.object({
  patterns: z
    .array(
      z.object({
        pattern: shortText(1000),
        frequency: z.number().int().min(0).max(100_000).optional(),
        affectedFindingCount: z.number().int().min(0).max(100_000).optional(),
        severity: z.enum(["high", "medium", "low"]),
        systemicRecommendation: shortText(4000),
      }),
    )
    .max(5),
});

// ── Plattform ──────────────────────────────────────────────────────
//
// Bewusst OHNE Defaults: der Cron darf nichts schreiben, wenn das Modell
// keinen brauchbaren Score liefert (S05-09). `.int()` schliesst zugleich
// `NaN` aus, das die alte `Math.max(0, Math.min(100, NaN))`-Kappung
// unverändert durchgereicht hat.
export const regulatoryRelevanceSchema = z.object({
  relevanceScore: z.number().int().min(0).max(100),
  reasoning: z.string().trim().min(1).max(1000),
  affectedModules: z
    .array(
      z.enum(["ERM", "ICS", "ISMS", "DPMS", "BCMS", "TPRM", "Audit", "ESG"]),
    )
    .max(8),
});

export const copilotAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(20_000),
  usedSources: z.array(z.string().max(300)).max(20).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const eamDescriptionSchema = z.object({
  description: z.string().trim().min(1).max(4000),
  rationale: optionalText(2000),
});

export type BpmnGeneration = z.infer<typeof bpmnGenerationSchema>;
export type RegulatoryRelevance = z.infer<typeof regulatoryRelevanceSchema>;
export type CopilotAnswer = z.infer<typeof copilotAnswerSchema>;

// ── ISMS-Intelligence ──────────────────────────────────────────────
//
// Beide Ausgaben werden PERSISTIERT (`soa_ai_suggestion`,
// `maturity_roadmap_action`). `parseSoaGapResponse`/
// `parseMaturityRoadmapResponse` lieferten bei kaputtem JSON ein leeres
// Array — von „keine Lücke gefunden" nicht zu unterscheiden. Mit diesen
// Schemata scheitert der Aufruf stattdessen sichtbar, und es wird nichts
// geschrieben.
export const soaGapArraySchema = z
  .array(
    z.object({
      controlRef: z.string().trim().min(1).max(100),
      controlTitle: z.string().trim().max(500).default(""),
      gapType: z.enum(["not_covered", "partial", "full"]),
      confidence: z.number().min(0).max(100),
      reasoning: z.string().trim().max(2000).default(""),
      priority: z.enum(["critical", "high", "medium", "low"]),
    }),
  )
  .max(500);

export const maturityRoadmapArraySchema = z
  .array(
    z.object({
      domain: z.string().trim().min(1).max(200),
      currentLevel: z.number().int().min(1).max(5),
      targetLevel: z.number().int().min(1).max(5),
      title: z.string().trim().min(1).max(500),
      description: z.string().trim().max(2000).default(""),
      effort: z.enum(["S", "M", "L"]),
      effortFteMonths: z.number().min(0).max(1000),
      priority: z.number().int().min(1).max(100),
      quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
      isQuickWin: z.boolean(),
    }),
  )
  .max(200);

/** Extrahiert das erste JSON-Array aus einer Modellantwort. */
export function parseJsonArray(text: string): unknown {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export const eamSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(300),
        objectType: z.enum([
          "application",
          "business_capability",
          "it_component",
          "data_object",
        ]),
        description: z.string().trim().max(4000).optional().nullable(),
      }),
    )
    .max(20),
});
