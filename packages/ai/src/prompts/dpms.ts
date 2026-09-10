// DPMS Overhaul: AI prompt builders for ROPA + DPIA drafting.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06] Beide Builder gaben
// `JSON.stringify(args)` roh weiter — auf genau den beiden Pfaden, die
// `containsPersonalData: true` setzen. Jetzt Datenumschlag; zusätzlich
// weist der Systemtext das Modell an, keine personenbezogenen Angaben aus
// dem Umschlag in die Ausgabe zu kopieren (Datenminimierung, S05-23).

import { buildDataPrompt, safeText } from "../prompt-safety";

const MINIMISE =
  "Do not copy names, e-mail addresses, phone numbers or other identifiers " +
  "of natural persons out of the envelope into your output. Describe " +
  "categories of data subjects instead.";

export function buildRopaFieldDraftPrompt(args: {
  ropaTitle: string;
  processingDescription: string | null;
  hint?: string | null;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a GDPR Art. 30 compliance assistant. Draft missing ROPA fields based on the brief.
Output ONLY a JSON object of this exact shape:
{
  "purpose": "...",
  "legalBasis": "consent|contract|legal_obligation|vital_interest|public_interest|legitimate_interest",
  "legalBasisDetail": "...",
  "dataSubjectCategories": ["..."],
  "personalDataCategories": ["..."],
  "specialCategories": [],
  "recipients": ["..."],
  "thirdCountryTransfers": false,
  "retentionPeriodDescription": "...",
  "retentionPeriodMonths": 60,
  "tomDescription": "..."
}
${MINIMISE}
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Draft the missing ROPA fields for the processing activity in the data envelope.",
    data: {
      ropaTitle: safeText(args.ropaTitle, 300),
      processingDescription: safeText(args.processingDescription, 4000),
      hint: safeText(args.hint, 1000),
    },
    maxCharsPerField: 4000,
  });
}

export function buildDpiaMeasureDraftPrompt(args: {
  dpiaTitle: string;
  processingDescription: string | null;
  identifiedRisks: Array<{
    title: string;
    description?: string | null;
    inherentRiskScore?: number | null;
  }>;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a privacy-by-design measures drafter (GDPR Art. 25 / Art. 35(7)(d)). For each identified risk, propose technical or organizational mitigation measures.
Output ONLY a JSON object of this exact shape:
{
  "measures": [
    {
      "title": "short label",
      "description": "what + how",
      "measureType": "technical|organizational",
      "addressesRiskTitle": "exact risk title from input",
      "expectedResidualReductionPct": 50
    }
  ]
}
${MINIMISE}
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Draft mitigation measures for the DPIA risks in the data envelope.",
    data: {
      dpiaTitle: safeText(args.dpiaTitle, 300),
      processingDescription: safeText(args.processingDescription, 4000),
      identifiedRisks: (args.identifiedRisks ?? []).slice(0, 100).map((r) => ({
        title: safeText(r.title, 300),
        description: safeText(r.description, 2000),
        inherentRiskScore:
          typeof r.inherentRiskScore === "number" ? r.inherentRiskScore : null,
      })),
    },
    maxCharsPerField: 4000,
  });
}
