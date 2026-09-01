// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-17]
//
// Prompt-Builder für die beiden Pfade ausserhalb der Fachmodule:
//
//   * `regulatory-relevance-scorer` (Worker-Cron). Sein Prompt entstand
//     in der Cron-Datei per String-Interpolation aus Organisationsname,
//     Meldungstitel und Zusammenfassung — der einzige unbeaufsichtigte
//     KI-Pfad des Produkts, und damit der einzige, bei dem eine
//     manipulierte Ausgabe ohne menschliche Zwischenstufe in den
//     Datenbestand geht.
//   * GRC-Copilot. Der Endpunkt war ein Stub, der die Nutzereingabe
//     zurückspiegelte (S05-17).

import { buildDataPrompt, safeText } from "../prompt-safety";

export const GRC_MODULES = [
  "ERM",
  "ICS",
  "ISMS",
  "DPMS",
  "BCMS",
  "TPRM",
  "Audit",
  "ESG",
] as const;

export function buildRegulatoryRelevancePrompt(args: {
  orgName: string;
  orgIndustry?: string | null;
  item: {
    source: string;
    title: string;
    summary: string | null;
    category: string | null;
    jurisdictions: string[] | null;
    frameworks: string[] | null;
  };
}) {
  return buildDataPrompt({
    system: `You are a GRC regulatory expert. Score how relevant the regulatory update in the data envelope is for the organisation in the same envelope.
Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "relevanceScore": 0,
  "reasoning": "why this score",
  "affectedModules": ["ERM"]
}
Rules:
- "relevanceScore" is an integer between 0 (irrelevant) and 100 (critical).
- "reasoning" is one to three sentences, at most 1000 characters.
- "affectedModules" contains only values from this list: ${GRC_MODULES.join(", ")}. Use an empty array if none apply.
- If the envelope does not contain enough information to judge, return relevanceScore 0 and say so in "reasoning". Never guess a middle value.`,
    instruction:
      "Score the regulatory update in the data envelope for the given organisation.",
    data: {
      organisation: {
        name: safeText(args.orgName, 300),
        industry: safeText(args.orgIndustry, 200),
      },
      regulatoryUpdate: {
        source: safeText(args.item.source, 200),
        title: safeText(args.item.title, 500),
        summary: safeText(args.item.summary, 4000),
        category: safeText(args.item.category, 100),
        jurisdictions: (args.item.jurisdictions ?? [])
          .slice(0, 40)
          .map((j) => safeText(j, 80)),
        frameworks: (args.item.frameworks ?? [])
          .slice(0, 40)
          .map((f) => safeText(f, 120)),
      },
    },
    maxCharsPerField: 4000,
  });
}

export interface CopilotRagSnippet {
  sourceType: string;
  title: string;
  content: string;
}

export function buildCopilotPrompt(args: {
  question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  context: CopilotRagSnippet[];
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are the GRC copilot of the ARCTOS platform. You answer questions about the organisation's own governance, risk and compliance data.
Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "answer": "your answer as plain text",
  "usedSources": ["title of a context snippet you relied on"],
  "confidence": "high|medium|low"
}
Rules:
- Ground every statement in the "context" entries of the data envelope. If the context does not answer the question, say so plainly and set confidence to "low".
- Never invent record identifiers, figures, dates or control references.
- Plain text only in "answer" — no HTML, no markdown tables, no links.
- Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Answer the question in the data envelope using only the supplied context.",
    data: {
      question: safeText(args.question, 4000),
      conversation: (args.history ?? []).slice(-10).map((m) => ({
        role: m.role,
        content: safeText(m.content, 2000),
      })),
      context: (args.context ?? []).slice(0, 12).map((c) => ({
        sourceType: safeText(c.sourceType, 60),
        title: safeText(c.title, 300),
        content: safeText(c.content, 2000),
      })),
    },
    maxCharsPerField: 4000,
  });
}

// ── EAM ────────────────────────────────────────────────────────────
//
// [WP6 · S05-13.4, S05-06] Die EAM-Routen führten keinen Modellaufruf
// durch und antworteten trotzdem „executed through provider abstraction
// layer". Zusätzlich baute `generate-suggestions` den Prompt per
// `template.replace("{industry}", parsed.data.industry)` — der
// Nutzerwert landete unmaskiert im Instruktionstext einer aus der
// Datenbank geladenen Vorlage.

export function buildEamDescriptionPrompt(args: {
  elementName: string;
  elementType: string;
  existingDescription: string | null;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are an enterprise-architecture documentation assistant.
Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "description": "2-5 sentences describing the architecture element",
  "rationale": "why you described it this way"
}
Describe purpose, typical responsibilities and typical interfaces. Do not invent product names, vendors or version numbers.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Describe the architecture element in the data envelope.",
    data: {
      elementName: safeText(args.elementName, 300),
      elementType: safeText(args.elementType, 100),
      existingDescription: safeText(args.existingDescription, 2000),
    },
    maxCharsPerField: 2000,
  });
}

export function buildEamSuggestionsPrompt(args: {
  /** Betreiber-Vorlage aus `eam_ai_prompt_template` — Instruktionskanal. */
  templateText: string;
  objectType: string;
  industry: string;
  count: number;
  existingObjects: string[];
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    // Die Vorlage stammt vom Betreiber (bzw. aus dem Seed) und ist
    // Instruktion. Die NUTZERWERTE stehen ausschliesslich im
    // Datenumschlag — sie werden nicht mehr in die Vorlage interpoliert.
    system: `${args.templateText}

Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "suggestions": [
    { "name": "...", "objectType": "application|business_capability|it_component|data_object", "description": "..." }
  ]
}
Return at most the requested number of suggestions and never duplicate an entry from "existingObjects".
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Generate architecture object suggestions for the parameters in the data envelope.",
    data: {
      objectType: safeText(args.objectType, 60),
      industry: safeText(args.industry, 200),
      count: args.count,
      existingObjects: (args.existingObjects ?? [])
        .slice(0, 100)
        .map((o) => safeText(o, 300)),
    },
    maxCharsPerField: 300,
  });
}
